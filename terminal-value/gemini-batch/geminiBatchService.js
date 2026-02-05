import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import GOOGLE_AI_MODELS from './constants/geminiModels.js';
import { generateValueResults } from '../../examples/ski-shop/devMocks/generateValueResults.js';

// --- Path Resolution Logic ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_INPUTS_DIR = path.join(__dirname, 'local-inputs');

if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY is missing. Please check your .env file.');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Ensure local storage directory exists
if (!fs.existsSync(LOCAL_INPUTS_DIR)) {
  fs.mkdirSync(LOCAL_INPUTS_DIR, { recursive: true });
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
export async function createBatchJob(promptText, customId = null) {
  // We create the temp file in the CWD (wherever the script runs)
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

    // 3. Rename/Move temp file to persistent storage
    // uploadResult.name format is "files/unique-id"
    const googleFileId = uploadResult.name.split('/').pop();

    // Construct local filename: "googleId-customId.jsonl" or "googleId.jsonl"
    let localFileName = `${googleFileId}.jsonl`;
    if (customId) {
      // Sanitize customId to avoid filesystem issues
      const safeId = customId.replace(/[^a-zA-Z0-9-_]/g, '_');
      localFileName = `${googleFileId}-${safeId}.jsonl`;
    }

    const localPath = path.join(LOCAL_INPUTS_DIR, localFileName);

    // We use renameSync. Since tempFileName is likely in the project root (CWD)
    // and LOCAL_INPUTS_DIR is in the project folder, this works fine.
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
 * Helper to read Ski Shop public files recursively, excluding dynamic folders.
 */
function getSkiShopContext() {
  // Resolve path relative to: full-project/terminal-value/gemini-batch/geminiBatchService.js
  // Target: full-project/examples/ski-shop/public
  const skiShopPublicDir = path.resolve(
    __dirname,
    '../../examples/ski-shop/public'
  );

  if (!fs.existsSync(skiShopPublicDir)) {
    console.warn(`⚠️ Ski Shop Directory not found at: ${skiShopPublicDir}`);
    return '';
  }

  let fileContents = [];

  function readDirRecursive(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Exclude specific dynamic folders
        if (entry.name === 'dynamicOrder' || entry.name === 'dynamicHome') {
          continue;
        }
        readDirRecursive(fullPath);
      } else {
        // Read file content
        const relativePath = path.relative(skiShopPublicDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        fileContents.push(`\n// --- FILE: ${relativePath} ---\n${content}`);
      }
    }
  }

  readDirRecursive(skiShopPublicDir);
  return fileContents.join('\n');
}

/**
 * Creates a batch job specifically for any Ski Shop Web Component.
 * Combines the user's prompt with the relevant codebase files.
 */
export async function createSkiShopWebComponentPrompt(promptText, customId) {
  const fileContext = getSkiShopContext();

  const combinedPrompt = `
${promptText}

================================================================================
BELOW IS THE EXISTING CODEBASE FOR THE SKI SHOP SITE (excluding dynamic folders)
================================================================================
${fileContext}
`;

  console.log(
    `🚀 Creating Ski Shop Component Job (Client: ${customId || 'Unknown'})...`
  );
  return createBatchJob(combinedPrompt, customId);
}

/**
 * Iterates through the mocked value results and creates a batch job for each Client's HOME Page.
 */
export async function generateAllHomePageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Home Pages...`
  );
  const jobs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentHome;

    if (!promptText) continue;

    console.log(`\n▶️ Processing Home Page for: ${clientId}`);
    try {
      // Pass clientId as the customId
      const job = await createSkiShopWebComponentPrompt(promptText, clientId);
      jobs.push({
        clientId,
        type: 'HOME',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);

      // Optional delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Failed for ${clientId}:`, err.message);
      jobs.push({
        clientId,
        type: 'HOME',
        status: 'FAILED',
        error: err.message,
      });
    }
  }
  console.table(jobs);
  return jobs;
}

/**
 * Iterates through the mocked value results and creates a batch job for each Client's ORDER Page.
 */
export async function generateAllOrderPageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Order Pages...`
  );
  const jobs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentOrder;

    if (!promptText) {
      console.warn(
        `⚠️ Skipping ${clientId}: No 'webComponentOrder' prompt found.`
      );
      continue;
    }

    console.log(`\n▶️ Processing Order Page for: ${clientId}`);
    try {
      // Pass clientId as the customId
      const job = await createSkiShopWebComponentPrompt(promptText, clientId);
      jobs.push({
        clientId,
        type: 'ORDER',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);

      // Optional delay
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Failed for ${clientId}:`, err.message);
      jobs.push({
        clientId,
        type: 'ORDER',
        status: 'FAILED',
        error: err.message,
      });
    }
  }
  console.table(jobs);
  return jobs;
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
      outputFile:
        job.outputFile ||
        job.outputConfig?.filePath ||
        (job.dest && job.dest.fileName) ||
        null,
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
    let resourceName = !fileId.startsWith('files/')
      ? `files/${fileId}`
      : fileId;

    // Pattern: https://generativelanguage.googleapis.com/v1beta/files/batch-<JOB_ID>:download?alt=media
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const downloadUrl = `${baseUrl}/${resourceName}:download?alt=media`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `Download failed: ${response.status} ${response.statusText} - ${errText}`
      );
    }

    const text = await response.text();
    return text
      .trim()
      .split('\n')
      .map((line) => {
        try {
          return line ? JSON.parse(line) : null;
        } catch (e) {
          return null;
        }
      })
      .filter((item) => item !== null);
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
    if (!job) throw new Error('Job not found');

    // Extract input filename from job metadata
    const inputConfig = job.metadata?.inputConfig || job.inputConfig;
    if (!inputConfig || !inputConfig.fileName) {
      // This might happen for very old jobs or failed jobs
      return null;
    }

    // fileName is "files/xyz". We need "xyz".
    const googleFileId = inputConfig.fileName.split('/').pop();

    // Search for the file in LOCAL_INPUTS_DIR that starts with this ID
    // matches: "xyz.jsonl" OR "xyz-myClientId.jsonl"
    const files = fs.readdirSync(LOCAL_INPUTS_DIR);
    const foundFile = files.find((file) => {
      return file.startsWith(googleFileId) && file.endsWith('.jsonl');
    });

    if (!foundFile) {
      console.warn(
        `⚠️ Local input file not found for ID prefix: ${googleFileId}`
      );
      return null;
    }

    const localPath = path.join(LOCAL_INPUTS_DIR, foundFile);
    const content = fs.readFileSync(localPath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
  } catch (error) {
    console.error('❌ Error in getJobInput:', error);
    throw error;
  }
}

export async function getJob(batchId) {
  const job = await genAI.batches.get({ name: `batches/${batchId}` });
  return job;
}
