"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSeed = runSeed;
const axios_1 = __importDefault(require("axios"));
const zlib_1 = __importDefault(require("zlib"));
const sax_1 = __importDefault(require("sax"));
const slugify_1 = __importDefault(require("slugify"));
const db_1 = require("./db");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
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
function runSeed() {
    return __awaiter(this, void 0, void 0, function* () {
        const db = yield (0, db_1.connectDB)();
        const collection = db.collection('documents');
        const count = yield collection.countDocuments();
        if (count > 0) {
            console.log('Database already seeded. Skipping.');
            return;
        }
        console.log('Seeding metadata and creating indexes...');
        yield collection.createIndex({ slug: 1 }, { unique: true });
        yield collection.createIndex({ title: 'text', content: 'text' });
        console.log(`Starting download from ${URL}...`);
        try {
            const response = yield (0, axios_1.default)({
                method: 'get',
                url: URL,
                responseType: 'stream'
            });
            const gunzip = zlib_1.default.createGunzip();
            const saxStream = sax_1.default.createStream(true, { trim: true });
            let currentTag = '';
            let currentTitle = '';
            let currentText = '';
            let docCount = 0;
            let batch = [];
            const flushBatch = () => __awaiter(this, void 0, void 0, function* () {
                if (batch.length > 0) {
                    yield collection.insertMany(batch);
                    docCount += batch.length;
                    console.log(`Inserted ${docCount}/${TARGET_DOC_COUNT} documents...`);
                    batch = [];
                }
            });
            return new Promise((resolve, reject) => {
                saxStream.on('opentag', (node) => {
                    currentTag = node.name;
                });
                saxStream.on('text', (t) => {
                    if (currentTag === 'title')
                        currentTitle += t;
                    if (currentTag === 'text')
                        currentText += t;
                });
                saxStream.on('closetag', (name) => __awaiter(this, void 0, void 0, function* () {
                    if (name === 'page') {
                        if (docCount + batch.length < TARGET_DOC_COUNT) {
                            const doc = createDocument(currentTitle, currentText);
                            batch.push(doc);
                            if (batch.length >= BATCH_SIZE) {
                                response.data.pause();
                                yield flushBatch();
                                response.data.resume();
                            }
                        }
                        else if (docCount + batch.length === TARGET_DOC_COUNT) {
                            yield flushBatch();
                            console.log('Seed completed successfully.');
                            resolve();
                        }
                        currentTitle = '';
                        currentText = '';
                    }
                    currentTag = '';
                }));
                saxStream.on('error', (e) => {
                    console.error('SAX Error:', e);
                    reject(e);
                });
                saxStream.on('end', () => __awaiter(this, void 0, void 0, function* () {
                    yield flushBatch();
                    resolve();
                }));
                response.data.pipe(gunzip).pipe(saxStream);
            });
        }
        catch (error) {
            console.error('Seeding failed:', error);
            throw error;
        }
    });
}
function createDocument(title, content) {
    const slug = (0, slugify_1.default)(title.toLowerCase()).replace(/[^a-z0-9-]/g, '');
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
