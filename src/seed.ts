import axios from 'axios';
import zlib from 'zlib';
import sax from 'sax';
import slugify from 'slugify';
import { connectDB } from './db';
import dotenv from 'dotenv';
import { Collection } from 'mongodb';

dotenv.config();

const URL = process.env.WIKI_STUB_URL || 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-stub-articles1.xml.gz';
const TARGET_DOC_COUNT = 10000;
const BATCH_SIZE = 1000;

const TAGS_POOL = ['mongodb', 'wiki', 'guide', 'api-design', 'concurrency', 'docker', 'database', 'backend', 'collaboration', 'search'];
const AUTHORS_POOL = [
  { id: 'user-001', name: 'Alice Smith', email: 'alice@example.com' },
  { id: 'user-002', name: 'Bob Johnson', email: 'bob@example.com' },
  { id: 'user-003', name: 'Charlie Brown', email: 'charlie@example.com' },
  { id: 'user-004', name: 'Diana Prince', email: 'diana@example.com' },
  { id: 'user-005', name: 'Edward Norton', email: 'edward@example.com' }
];

export async function runSeed() {
  const db = await connectDB();
  const collection = db.collection('documents');

  const count = await collection.countDocuments();
  if (count > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding metadata and creating indexes...');
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ title: 'text', content: 'text' });

  console.log(`Starting download from ${URL}...`);

  try {
    const response = await axios({
      method: 'get',
      url: URL,
      responseType: 'stream'
    });

    const gunzip = zlib.createGunzip();
    const saxStream = sax.createStream(true, { trim: true });

    let currentTag = '';
    let currentTitle = '';
    let currentText = '';
    let docCount = 0;
    let isResolved = false;
    let batch: any[] = [];

    const flushBatch = async (batchToInsert: any[]) => {
      if (batchToInsert.length === 0) return;
      try {
        await collection.insertMany(batchToInsert, { ordered: false });
        docCount += batchToInsert.length;
        console.log(`Progress: ${docCount}/${TARGET_DOC_COUNT} documents seeded.`);
      } catch (err: any) {
        console.error('Batch insert warning (duplicate keys skipped):', err.message);
        // MongoDB insertMany with ordered: false returns insertedCount in the error result
        if (err.result && err.result.insertedCount) {
          docCount += err.result.insertedCount;
        }
      }
    };

    return new Promise<void>((resolve, reject) => {
      const handleResolve = () => {
        if (!isResolved) {
          isResolved = true;
          resolve();
        }
      };

      saxStream.on('opentag', (node) => {
        currentTag = node.name;
      });

      saxStream.on('text', (t) => {
        if (currentTag === 'title') currentTitle += t;
        if (currentTag === 'text') currentText += t;
      });

      saxStream.on('closetag', async (name) => {
        if (name === 'page') {
          if (docCount + batch.length < TARGET_DOC_COUNT) {
            const doc = createDocument(currentTitle, currentText);
            batch.push(doc);

            if (batch.length >= BATCH_SIZE) {
              const batchToInsert = batch;
              batch = []; // Reassign immediately so concurrent events don't append to the active batch

              response.data.pause();
              await flushBatch(batchToInsert);
              response.data.resume();
            }
          }
          
          if (docCount + batch.length >= TARGET_DOC_COUNT) {
            if (batch.length > 0) {
              const batchToInsert = batch;
              batch = [];
              await flushBatch(batchToInsert);
            }
            console.log('Seed completed successfully.');
            response.data.destroy();
            handleResolve();
          }

          currentTitle = '';
          currentText = '';
        }
        currentTag = '';
      });

      saxStream.on('error', (e) => {
        console.error('SAX Error:', e);
        if (!isResolved) {
          reject(e);
        }
      });

      saxStream.on('end', async () => {
        if (batch.length > 0) {
          const batchToInsert = batch;
          batch = [];
          await flushBatch(batchToInsert);
        }
        handleResolve();
      });

      response.data.pipe(gunzip).pipe(saxStream);
    });

  } catch (error) {
    console.error('Seeding failed:', error);
    throw error;
  }
}

function createDocument(title: string, content: string) {
  const slug = slugify(title.toLowerCase()).replace(/[^a-z0-9-]/g, '');
  const finalSlug = slug || `doc-${Math.random().toString(36).substr(2, 9)}`;
  
  const tagsCount = Math.floor(Math.random() * 3) + 1;
  const tags = [...TAGS_POOL].sort(() => 0.5 - Math.random()).slice(0, tagsCount);
  
  const isOldSchema = Math.random() < 0.1; // 10% old schema
  const author = AUTHORS_POOL[Math.floor(Math.random() * AUTHORS_POOL.length)];
  
  return {
    slug: finalSlug,
    title,
    content: content.slice(0, 5000),
    version: 1,
    tags,
    metadata: {
      author: isOldSchema ? author.name : author,
      createdAt: new Date(),
      updatedAt: new Date(),
      wordCount: content.split(/\s+/).length
    },
    revision_history: []
  };
}

if (require.main === module) {
  runSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
