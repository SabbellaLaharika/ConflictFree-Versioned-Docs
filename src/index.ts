import express from 'express';
import { connectDB } from './db';
import { runSeed } from './seed';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

async function start() {
  console.log('Starting application...');
  
  // Connect to DB
  await connectDB();
  
  // Run seeding
  try {
    await runSeed();
  } catch (error) {
    console.error('Seeding during startup failed:', error);
    // Continue anyway, maybe DB is already seeded but count check failed or network issue
  }

  // Basic health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

start();
