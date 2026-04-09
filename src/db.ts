import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.MONGODB_URI || 'mongodb://localhost:27017/collaborative_docs';
const dbName = 'collaborative_docs';

let client: MongoClient;
let db: Db;

export async function connectDB(): Promise<Db> {
  if (db) return db;

  try {
    client = await MongoClient.connect(url);
    db = client.db(dbName);
    console.log('Connected to MongoDB');
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
}

export function getDB(): Db {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
}
