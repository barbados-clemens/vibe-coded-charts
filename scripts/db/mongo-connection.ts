import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const DB_URL = process.env.DB_URL;

if (!DB_URL) {
  throw new Error('DB_URL environment variable is not set');
}

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (client && db) {
    return { client, db };
  }

  try {
    client = new MongoClient(DB_URL);
    await client.connect();
    
    // Extract database name from connection string
    const dbName = DB_URL.split('/').pop()?.split('?')[0] || 'nrwl-api';
    db = client.db(dbName);
    
    console.log(`✅ Connected to MongoDB database: ${dbName}`);
    return { client, db };
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    console.log('✅ Disconnected from MongoDB');
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database not connected. Call connectToDatabase() first.');
  }
  return db;
}