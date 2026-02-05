import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import 'dotenv/config';
import GOOGLE_AI_MODELS from './constants/geminiModels.js';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('❌ GEMINI_API_KEY is missing. Please check your .env file.');
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to fetch ALL pages from the API
 * Iterates through nextPageToken to retrieve the full history.
 */
async function fetchAllPages() {
  let allItems = [];

  const params = {};

  params.config = {
    pageSize: 50,
  };

  // 2. Make the API request
  // Note: We pass currentParams directly (no 'config' wrapper) to avoid fetch errors
  const response = await genAI.batches.list(params);

  // 3. Extract items from SDK's specific response structure
  const items =
    response.pageInternal?.length > 0
      ? response.pageInternal
      : response.batches || [];

  allItems = allItems.concat(items);

  return allItems;
}

/**
 * Creates a batch job with a SINGLE prompt request.
 * Newlines in the input are preserved as part of the text.
 */
export async function createBatchJob(promptText) {
  const fileName = `request-${Date.now()}.jsonl`;
  
  // Use 2-5 flash lite for testing
  const modelName = GOOGLE_AI_MODELS.STABLE.GEMINI_2_5_FLASH_LITE;

  try {
    // Single Request Logic: Wrap the entire text into one request object
    const batchData = [
      {
        request: { contents: [{ parts: [{ text: promptText }] }] },
      },
    ];

    fs.writeFileSync(
      fileName,
      batchData.map((d) => JSON.stringify(d)).join('\n')
    );

    const uploadResult = await genAI.files.upload({
      file: fileName,
      config: { mimeType: 'text/plain' },
    });

    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: `Web_Job_${Date.now()}` },
    });

    return batchJob;
  } catch (err) {
    console.error('❌ Service Error:', err);
    throw err;
  } finally {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
  }
}

/**
 * Lists ALL jobs by fetching the full history.
 */
export async function getAllJobs() {
  try {
    // Fetch everything in one go (Server-side filtering is not supported)
    const allJobs = await fetchAllPages();

    // Sort by creation time (Newest First)
    // We use a Map to deduplicate just in case, though the linear fetch should be unique
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
 * Downloads Batch Job results by manually constructing the :download endpoint
 * to bypass SDK validation bugs (file name is > 40 chars).
 * * @param {string} fileId - The full file resource name (e.g. 'files/batch-abc...') 
 * OR just the Batch Job ID.
 */
export async function getBatchResults(fileId) {
  try {
    // 1. Sanitize the input to ensure we have the correct resource name
    // If user passed just the Job ID (e.g. 'maip...'), convert it to 'files/batch-maip...'
    let resourceName = !fileId.startsWith('files/') ? `files/${fileId}` : fileId;


    console.log(`🎯 Target Resource: ${resourceName}`);

    // 2. Construct the URL following the CURL pattern
    // Pattern: https://generativelanguage.googleapis.com/v1beta/files/batch-<JOB_ID>:download?alt=media
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const downloadUrl = `${baseUrl}/${resourceName}:download?alt=media`;

    console.log(`⬇️ Fetching from: ${downloadUrl}`);

    // 3. Perform the fetch using the API Key header (mirroring -H "x-goog-api-key: ...")
    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY,
        // Optional: 'Content-Type': 'application/json' usually not needed for GET
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    // 4. Parse the JSONL content
    const text = await response.text();
    
    const results = text
      .trim()
      .split('\n')
      .map((line) => {
        try {
          return line ? JSON.parse(line) : null;
        } catch (e) {
          return null;
        }
      })
      .filter(item => item !== null);

    return results;

  } catch (err) {
    console.error('❌ Error in getBatchResults:', err);
    throw err;
  }
}

export async function getJob(batchId) {
  const job = await genAI.batches.get({ name: `batches/${batchId}` });
  return job;
}

/**
 * Fetches the RAW batch job JSON directly from the REST API.
 * Bypass SDK to retrieve additional fields (like inputFileId).
 */
export async function getRawJob(batchId) {
  // Use v1beta endpoint specifically for preview models
  const url = `https://generativelanguage.googleapis.com/v1beta/batches/${batchId}?key=${process.env.GEMINI_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (e) {
    console.error('Error fetching raw job:', e);
  }
}