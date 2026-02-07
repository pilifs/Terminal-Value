import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import 'dotenv/config';
import GOOGLE_AI_MODELS from './constants/geminiModels.js';
import { generateValueResults } from '../../examples/ski-shop/memoizedResults/generateValueResults.js';
// import verifyExternalConfidence from '../../examples/ski-shop/verifyExternalConfidence.js';

// --- Path Resolution Logic ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_INPUTS_DIR = path.join(__dirname, 'local-inputs');
const RESULTS_FILE_PATH = path.join(__dirname, 'skiShopResults.js');
const GENERATE_VALUE_PATH = path.join(
  __dirname,
  '../../examples/ski-shop/memoizedResults/generateValueResults.js'
);

if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY is missing. Please check your .env file.');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Ensure local storage directory exists
if (!fs.existsSync(LOCAL_INPUTS_DIR)) {
  fs.mkdirSync(LOCAL_INPUTS_DIR, { recursive: true });
}

// --- Helper: Get Hash of Generate Value Input ---
function getGenerateValueHash() {
  try {
    if (fs.existsSync(GENERATE_VALUE_PATH)) {
      const content = fs.readFileSync(GENERATE_VALUE_PATH, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    }
  } catch (e) {
    console.warn('⚠️ Could not calculate hash for generateValueResults.js', e);
  }
  return null;
}

// --- Helper: Ski Shop Results Persistence ---

function readResultsFile() {
  if (!fs.existsSync(RESULTS_FILE_PATH)) {
    return {};
  }
  try {
    const content = fs.readFileSync(RESULTS_FILE_PATH, 'utf-8');
    let objectLiteral = content.replace(/^export\s+const\s+results\s*=\s*/, '');
    objectLiteral = objectLiteral.replace(/;\s*$/, '');
    return new Function('return ' + objectLiteral)();
  } catch (err) {
    console.error(
      '⚠️ Error parsing skiShopResults.js. Ensure it is valid JavaScript syntax.',
      err
    );
    return {};
  }
}

function saveResultsFile(data) {
  const fileContent = `export const results = ${JSON.stringify(
    data,
    null,
    2
  )};`;
  fs.writeFileSync(RESULTS_FILE_PATH, fileContent);
  console.log('📝 Updated skiShopResults.js');
}

function logJobToHistory(
  job,
  promptText,
  customId,
  modelName,
  localFileName,
  pageType,
  valueInputHash // New Parameter
) {
  const results = readResultsFile();
  const promptHash = crypto
    .createHash('sha256')
    .update(promptText)
    .digest('hex');
  const batchId = job.name.split('/').pop();

  const record = {
    batchId: batchId,
    googleAIModel: modelName,
    timestamp: new Date().toISOString(),
    clientId: customId || 'UNKNOWN',
    pageType: pageType || 'generic',
    inputPrompt: promptText,
    inputPromptHash: promptHash,
    inputFileName: localFileName,
    valueInputHash: valueInputHash || null, // Store the hash
    status: 'SUBMITTED',
    outputFileId: null,
    fileOutputResult: null,
  };

  results[batchId] = record;
  saveResultsFile(results);
}

// --- Core Service Functions ---

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

export async function createBatchJob(
  promptText,
  customId = null,
  pageType = 'generic',
  valueInputHash = null // New Parameter
) {
  const tempFileName = `temp-${Date.now()}.jsonl`;
  const modelName = GOOGLE_AI_MODELS.PREVIEW.GEMINI_3_PRO;

  try {
    const batchData = [
      {
        request: { contents: [{ parts: [{ text: promptText }] }] },
      },
    ];

    fs.writeFileSync(
      tempFileName,
      batchData.map((d) => JSON.stringify(d)).join('\n')
    );

    const uploadResult = await genAI.files.upload({
      file: tempFileName,
      config: { mimeType: 'text/plain' },
    });

    const googleFileId = uploadResult.name.split('/').pop();

    let localFileName = `${googleFileId}.jsonl`;
    if (customId) {
      const safeId = customId.replace(/[^a-zA-Z0-9-_]/g, '_');
      localFileName = `${googleFileId}-${safeId}.jsonl`;
    }

    const localPath = path.join(LOCAL_INPUTS_DIR, localFileName);
    fs.renameSync(tempFileName, localPath);
    console.log(`💾 Saved local input: ${localPath}`);

    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: `Web_Job_${Date.now()}` },
    });

    logJobToHistory(
      batchJob,
      promptText,
      customId,
      modelName,
      localFileName,
      pageType,
      valueInputHash // Pass to logger
    );

    return batchJob;
  } catch (err) {
    console.error('❌ Service Error:', err);
    if (fs.existsSync(tempFileName)) fs.unlinkSync(tempFileName);
    throw err;
  }
}

function getSkiShopContext() {
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
        if (entry.name === 'dynamicOrder' || entry.name === 'dynamicHome') {
          continue;
        }
        readDirRecursive(fullPath);
      } else {
        const relativePath = path.relative(skiShopPublicDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        fileContents.push(`\n// --- FILE: ${relativePath} ---\n${content}`);
      }
    }
  }

  readDirRecursive(skiShopPublicDir);
  return fileContents.join('\n');
}

export async function createSkiShopWebComponentPrompt(
  promptText,
  customId,
  pageType,
  valueInputHash = null
) {
  const fileContext = getSkiShopContext();

  const combinedPrompt = `
${promptText}

================================================================================
BELOW IS THE EXISTING CODEBASE FOR THE SKI SHOP SITE (excluding dynamic folders)
================================================================================
${fileContext}
`;

  console.log(
    `🚀 Creating Ski Shop Component Job (Client: ${
      customId || 'Unknown'
    }, Type: ${pageType})...`
  );
  return createBatchJob(combinedPrompt, customId, pageType, valueInputHash);
}

export async function generateAllHomePageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Home Pages...`
  );

  // Calculate hash once for this batch run
  const valueInputHash = getGenerateValueHash();

  const jobs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentHome;

    if (!promptText) continue;

    console.log(`\n▶️ Processing Home Page for: ${clientId}`);
    try {
      const job = await createSkiShopWebComponentPrompt(
        promptText,
        clientId,
        'home',
        valueInputHash // Pass Hash
      );
      jobs.push({
        clientId,
        type: 'HOME',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);
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

export async function generateAllOrderPageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Order Pages...`
  );

  // Calculate hash once for this batch run
  const valueInputHash = getGenerateValueHash();

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
      const job = await createSkiShopWebComponentPrompt(
        promptText,
        clientId,
        'order',
        valueInputHash // Pass Hash
      );
      jobs.push({
        clientId,
        type: 'ORDER',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);
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

export async function getAllJobs() {
  try {
    const allJobs = await fetchAllPages();

    // --- Sync with skiShopResults.js ---
    const results = readResultsFile();
    let hasUpdates = false;

    // We only update if we have a local record for this batch ID
    allJobs.forEach((job) => {
      const batchId = job.name.split('/').pop();

      if (results[batchId]) {
        const newState = job.state.replace('JOB_STATE_', '');

        // Extract output file ID if it exists
        const rawPath =
          job.outputFile ||
          job.outputConfig?.filePath ||
          (job.dest && job.dest.fileName);
        const newOutputId = rawPath ? rawPath.split('/').pop() : null;

        // Update if changed
        if (
          results[batchId].status !== newState ||
          results[batchId].outputFileId !== newOutputId
        ) {
          results[batchId].status = newState;
          results[batchId].outputFileId = newOutputId;
          hasUpdates = true;
        }
      }
    });

    if (hasUpdates) {
      saveResultsFile(results);
    }
    // -----------------------------------

    const jobMap = new Map();
    allJobs.forEach((j) => jobMap.set(j.name, j));

    const sortedJobs = Array.from(jobMap.values()).sort(
      (a, b) =>
        new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );

    return sortedJobs.map((job) => {
      const rawPath =
        job.outputFile ||
        job.outputConfig?.filePath ||
        (job.dest && job.dest.fileName);
      return {
        id: job.name.split('/').pop(),
        fullId: job.name,
        status: job.state.replace('JOB_STATE_', ''),
        created: new Date(job.createTime).toLocaleString(),
        model: job.model?.split('/').pop() || 'Unknown',
        outputFileId: rawPath ? rawPath.split('/').pop() : null,
      };
    });
  } catch (err) {
    console.error('❌ Dashboard Error:', err);
    return [];
  }
}

export async function getBatchResults(fileId) {
  try {
    let resourceName = !fileId.startsWith('files/')
      ? `files/${fileId}`
      : fileId;
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
    const parsedResults = text
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

    // --- Sync with skiShopResults.js ---
    const results = readResultsFile();
    const cleanFileId = fileId.replace('files/', '');
    let foundBatchId = null;

    // Find the batch record that has this outputFileId
    for (const [batchId, record] of Object.entries(results)) {
      if (record.outputFileId === cleanFileId) {
        foundBatchId = batchId;
        break;
      }
    }

    if (foundBatchId) {
      results[foundBatchId].fileOutputResult = parsedResults;
      saveResultsFile(results);
      console.log(`📝 Saved results to history for Batch ${foundBatchId}`);
    } else {
      console.warn(
        `⚠️ Loaded results for ${cleanFileId}, but could not link to a local Batch ID history record (run 'list' first?).`
      );
    }
    // -----------------------------------

    return parsedResults;
  } catch (err) {
    console.error('❌ Error in getBatchResults:', err);
    throw err;
  }
}

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

export async function getJobInput(batchId) {
  try {
    const job = await getRawJob(batchId);
    if (!job) throw new Error('Job not found');

    const inputConfig = job.metadata?.inputConfig || job.inputConfig;
    if (!inputConfig || !inputConfig.fileName) {
      return null;
    }

    const googleFileId = inputConfig.fileName.split('/').pop();
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

export async function populateFileOutputResult() {
  console.log('🔄 Checking for completed jobs to fetch results...');

  // 1. Refresh Job Statuses from API (Syncs status and outputFileId to local history)
  await getAllJobs();

  // 2. Read latest state
  const results = readResultsFile();
  let fetchCount = 0;

  for (const [batchId, record] of Object.entries(results)) {
    // Check criteria: Succeeded, has output ID, but no results yet
    if (
      record.status === 'SUCCEEDED' &&
      record.outputFileId &&
      !record.fileOutputResult
    ) {
      console.log(
        `⬇️ Fetching results for Batch ${batchId} (File: ${record.outputFileId})...`
      );
      try {
        await getBatchResults(record.outputFileId);
        fetchCount++;
        // Optional delay to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(
          `❌ Failed to fetch results for ${batchId}:`,
          err.message
        );
      }
    }
  }

  if (fetchCount === 0) {
    console.log('✅ No new results to fetch.');
  } else {
    console.log(`🎉 Successfully fetched results for ${fetchCount} jobs.`);
  }
}

export async function verifyExternalConfidenceMethod(hash) {
  // Implement logic to verify external confidence for generated components based on the provided hash
  // This function can read the generated components for the given hash, compare them to the default implementation,
  // and use a Gemini model to assess confidence and safety. The results can be logged or stored as needed.
}
