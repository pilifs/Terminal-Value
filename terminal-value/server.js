import express from 'express';
import { createBatchJob, getAllJobs, getBatchResults } from './geminiBatchService.js';
import path from 'path';
import morgan from 'morgan';

const __dirname = path.resolve();
const app = express();
const PORT = 3001;

// Middleware to parse JSON and serve static files
app.use(express.json());

// Middleware to log reqeusts
app.use(morgan('dev'));

// Fix node relative paths later so this doesn't break if folder structure changes
app.use(express.static(path.join(__dirname, './terminal-value/public')));

// GET: List all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await getAllJobs();
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Create a new job
app.post('/api/jobs', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const job = await createBatchJob(prompt);
    res.json(job);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// GET: Fetch results for a specific file
app.get('/api/jobs/results/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    const results = await getBatchResults(fileId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});