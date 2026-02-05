import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';
import GOOGLE_AI_MODELS from './constants/geminiModels.js';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY is missing. Please check your .env file.');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const LOCAL_INPUTS_DIR = 'local-inputs';

// Ensure local storage directory exists
if (!fs.existsSync(LOCAL_INPUTS_DIR)) {
  fs.mkdirSync(LOCAL_INPUTS_DIR);
}

/**
 * Helper to fetch ALL pages from the API
 */
async function fetchAllPages() {
  let allItems = [];
  const params = {};
  params.config = { pageSize: 50 };

  const response = await genAI.batches.list(params);
  
  const items =
    response.pageInternal?.length > 0
      ? response.pageInternal
      : response.batches || [];

  allItems = allItems.concat(items);
  return allItems;
}

/**
 * Creates a batch job and SAVES the input file locally using the Google File ID.
 */
export async function createBatchJob(promptText) {
  const tempFileName = `temp-${Date.now()}.jsonl`;
  const modelName = GOOGLE_AI_MODELS.STABLE.GEMINI_2_5_FLASH_LITE;

  try {
    // 1. Create Single Request JSONL
    const batchData = [
      {
        request: { contents: [{ parts: [{ text: promptText }] }] },
      },
    ];

    fs.writeFileSync(
      tempFileName,
      batchData.map((d) => JSON.stringify(d)).join('\n')
    );

    // 2. Upload to Gemini
    const uploadResult = await genAI.files.upload({
      file: tempFileName,
      config: { mimeType: 'text/plain' },
    });

    // 3. Rename/Move temp file to persistent storage using the Google File ID
    // uploadResult.name format is "files/unique-id"
    const googleFileId = uploadResult.name.split('/').pop();
    const localPath = path.join(LOCAL_INPUTS_DIR, `${googleFileId}.jsonl`);
    
    fs.renameSync(tempFileName, localPath);
    console.log(`💾 Saved local input: ${localPath}`);

    // 4. Create Batch Job
    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: `Web_Job_${Date.now()}` },
    });

    return batchJob;
  } catch (err) {
    console.error('❌ Service Error:', err);
    // Cleanup temp file if it still exists (i.e. upload failed)
    if (fs.existsSync(tempFileName)) fs.unlinkSync(tempFileName);
    throw err;
  }
}

/**
 * Lists ALL jobs.
 */
export async function getAllJobs() {
  try {
    const allJobs = await fetchAllPages();
    const jobMap = new Map();
    allJobs.forEach((j) => jobMap.set(j.name, j));

    const sortedJobs = Array.from(jobMap.values()).sort(
      (a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );

    return sortedJobs.map((job) => ({
      id: job.name.split('/').pop(),
      fullId: job.name,
      status: job.state.replace('JOB_STATE_', ''),
      created: new Date(job.createTime).toLocaleString(),
      model: job.model?.split('/').pop() || 'Unknown',
      outputFile: job.outputFile || job.outputConfig?.filePath || (job.dest && job.dest.fileName) || null,
    }));
  } catch (err) {
    console.error('❌ Dashboard Error:', err);
    return [];
  }
}

/**
 * Downloads Batch Job Output Results.
 */
export async function getBatchResults(fileId) {
  try {
    let resourceName = !fileId.startsWith('files/') ? `files/${fileId}` : fileId;
    
    // Pattern: https://generativelanguage.googleapis.com/v1beta/files/batch-<JOB_ID>:download?alt=media
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const downloadUrl = `${baseUrl}/${resourceName}:download?alt=media`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    const text = await response.text();
    return text.trim().split('\n').map((line) => {
        try { return line ? JSON.parse(line) : null; } catch (e) { return null; }
      }).filter(item => item !== null);

  } catch (err) {
    console.error('❌ Error in getBatchResults:', err);
    throw err;
  }
}

/**
 * Gets Raw Job Details.
 */
export async function getRawJob(batchId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/batches/${batchId}?key=${process.env.GEMINI_API_KEY}`;
  try {
    const response = await fetch(url);
    return await response.json();
  } catch (e) {
    console.error('Error fetching raw job:', e);
    return null;
  }
}

/**
 * Retrieves the LOCAL input file content for a given batch job.
 */
export async function getJobInput(batchId) {
  try {
    const job = await getRawJob(batchId);
    if (!job) throw new Error("Job not found");

    // Extract input filename from job metadata
    const inputConfig = job.metadata?.inputConfig || job.inputConfig;
    if (!inputConfig || !inputConfig.fileName) {
      // This might happen for very old jobs or failed jobs
      return null; 
    }

    // fileName is "files/xyz". We need "xyz".
    const googleFileId = inputConfig.fileName.split('/').pop();
    const localPath = path.join(LOCAL_INPUTS_DIR, `${googleFileId}.jsonl`);

    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️ Local input file not found: ${localPath}`);
      return null;
    }

    const content = fs.readFileSync(localPath, 'utf-8');
    return content.trim().split('\n').map(line => JSON.parse(line));
  } catch (error) {
    console.error('❌ Error in getJobInput:', error);
    throw error;
  }
}

export async function getJob(batchId) {
  const job = await genAI.batches.get({ name: `batches/${batchId}` });
  return job;
}