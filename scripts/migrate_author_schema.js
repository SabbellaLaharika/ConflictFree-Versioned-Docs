const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative_docs';
const dbName = 'collaborative_docs';
const BATCH_SIZE = 1000;

async function migrate() {
  const client = new MongoClient(url);

  try {
    await client.connect();
    console.log('Connected to MongoDB for background migration.');
    const db = client.db(dbName);
    const collection = db.collection('documents');

    // Find documents with author as string
    const query = { 'metadata.author': { $type: 'string' } };
    const cursor = collection.find(query).batchSize(BATCH_SIZE);

    let totalMigrated = 0;
    let batch = [];

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              'metadata.author': {
                id: null,
                name: doc.metadata.author,
                email: null
              }
            }
          }
        }
      });

      if (batch.length >= BATCH_SIZE) {
        const result = await collection.bulkWrite(batch);
        totalMigrated += result.modifiedCount;
        console.log(`Migrated ${totalMigrated} documents...`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      const result = await collection.bulkWrite(batch);
      totalMigrated += result.modifiedCount;
    }

    console.log(`Migration complete. Total documents updated: ${totalMigrated}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrate();
