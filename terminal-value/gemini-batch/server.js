import express from 'express';
import { createBatchJob, getAllJobs, getBatchResults, getJobInput } from './geminiBatchService.js';
import path from 'path';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

// Resolve directory of THIS file (gemini-batch/server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, './public')));

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

// GET: Fetch output results for a specific file
app.get('/api/jobs/results/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const results = await getBatchResults(fileId);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Fetch input prompt for a specific job
app.get('/api/jobs/:jobId/input', async (req, res) => {
  try {
    const {XH} = req.params;
    const inputs = await getJobInput(req.params.jobId);
    if (inputs === null) {
      // Not found (probably old job without local file)
      return res.status(404).json({ error: "Input file not found locally" });
    }
    res.json(inputs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});