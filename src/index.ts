import express from 'express';
import { connectDB } from './db';
import { runSeed } from './seed';
import router from './routes';
import dotenv from 'dotenv';

import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api', router);
app.use(express.static(path.join(__dirname, '../public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  console.log('Starting application...');
  
  // Connect to DB
  await connectDB();
  
  // Run seeding in background (non-blocking)
  runSeed()
    .then(() => console.log('Database seeding process completed.'))
    .catch((error) => console.error('Seeding during startup failed:', error));

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  start();
}

export { app };
 
