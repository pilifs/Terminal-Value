import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import 'dotenv/config';
import { getModelResource } from './geminiModels';

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
  
  // Google API returns an error (filename > 40 chars) when requesting response with 3-preview model
  // Use 2-5 lite for testing
  const modelName = getModelResource('gemini-2-5-flash-lite');

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
      outputFile: job.outputFile || job.outputConfig?.filePath || null,
    }));
  } catch (err) {
    console.error('❌ Dashboard Error:', err);
    return [];
  }
}

/**
 * Fetches the content of an output file (JSONL).
 */
// export async function getJobResults(fileId) {
//   try {
//     // 1. Get the file metadata to find the URI
//     // Note: The SDK's files.get returns metadata (name, uri, state), not content.
//     const fileMetadata = await genAI.files.get({ name: fileId });
    
//     // 2. Construct the download URL
//     // The URI looks like: https://generativelanguage.googleapis.com/v1beta/files/abc-123
//     // You MUST append your API key to download the content.
//     const downloadUrl = `${fileMetadata.uri}?key=${process.env.GEMINI_API_KEY}`;

//     // 3. Fetch the actual content using standard fetch
//     const response = await fetch(downloadUrl);

//     if (!response.ok) {
//       throw new Error(`Failed to download file: ${response.statusText}`);
//     }

//     // 4. Parse the JSONL content
//     const text = await response.text();
    
//     // JSONL is one JSON object per line, so we split by newline and parse
//     const results = text
//       .trim()
//       .split('\n')
//       .map(line => JSON.parse(line));

//     return results;

//   } catch (err) {
//     console.error('❌ Error fetching results:', err);
//     throw err;
//   }
// }

/**
 * Fetches and parses the JSONL results from a Gemini Batch Job file.
 * @param {string} resourceName - The full file resource name (e.g., "files/batch-abc123...")
 */
// export async function getJobResults(resourceName) {
//   try {
//     console.log(`🔍 Getting metadata for: ${resourceName}`);

//     // 1. Get the download URI from the metadata
//     // We use the SDK here just to find the correct Google Cloud storage URI
//     const fileMetadata = await genAI.files.get({ name: resourceName });
    
//     // 2. Construct the authenticated download URL
//     // You MUST append the API key to the URI provided by the metadata
//     const downloadUrl = `${fileMetadata.uri}?key=${process.env.GEMINI_API_KEY}`;

//     console.log(`⬇️ Downloading content...`);

//     // 3. Fetch the content
//     const response = await fetch(downloadUrl);

//     if (!response.ok) {
//       throw new Error(`Download failed: ${response.status} ${response.statusText}`);
//     }

//     // 4. Parse the JSONL (JSON Lines) content
//     const text = await response.text();
    
//     // Split by newline, parse each line as JSON, and filter out empty lines
//     const results = text
//       .trim()
//       .split('\n')
//       .map((line) => {
//         try {
//           return line ? JSON.parse(line) : null;
//         } catch (e) {
//           console.warn('Skipping invalid JSON line:', line);
//           return null;
//         }
//       })
//       .filter(item => item !== null);

//     return results;

//   } catch (err) {
//     console.error('❌ Error in getJobResults:', err);
//     throw err;
//   }
// }

export async function getJobResults(resourceName) {
  try {
    console.log(`⚠️ Bypassing SDK metadata due to ID length bug.`);
    console.log(`🎯 Target Resource: ${resourceName}`);

    // 1. Manually construct the URL
    // The SDK fails because the ID is >40 chars. 
    // We construct the URL manually to skip the validation check.
    // Base: https://generativelanguage.googleapis.com/v1beta/
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    const downloadUrl = `${baseUrl}/${resourceName}?key=${process.env.GEMINI_API_KEY}&alt=media`;

    console.log(`⬇️ Fetching directly from URL...`);

    // 2. Fetch content directly
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Download failed: ${response.status} ${response.statusText} - ${errText}`);
    }

    // 3. Parse JSONL
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
    console.error('❌ Error in getJobResults:', err);
    throw err;
  }
}

/**
 * Workaround for the "40 Character ID" bug.
 * Lists recent files to find the batch output without triggering the ID validator.
 */
export async function recoverBatchResult(targetFileName) {
  try {
    console.log(`🔍 Searching for file in recent list: ${targetFileName}`);

    // 1. List the most recent 100 files
    // We bypass 'files.get' which triggers the 40-char limit error
    const listResponse = await genAI.files.list({
      pageSize: 100,
      orderBy: "createTime desc"
    });

    // 2. Find the matching file object manually
    const targetFile = listResponse.files.find(f => f.name === targetFileName);

    if (!targetFile) {
      console.error('❌ File not found in recent list. It may have been deleted or is inaccessible.');
      console.log('Recent files found:', listResponse.files.map(f => f.name));
      return;
    }

    console.log(`✅ Found file in list!`);
    console.log(`   URI: ${targetFile.uri}`);

    // 3. Download using the URI from the list response
    // The URI is usually a Google Cloud Storage link that doesn't trigger the API validator
    const downloadUrl = `${targetFile.uri}?key=${process.env.GEMINI_API_KEY}`;
    
    const response = await fetch(downloadUrl);
    
    if (!response.ok) {
       const errText = await response.text();
       throw new Error(`Download failed: ${response.status} ${errText}`);
    }

    const text = await response.text();
    
    // 4. Parse results
    const results = text
      .trim()
      .split('\n')
      .map(line => {
          try { return JSON.parse(line); } catch(e) { return null; }
      })
      .filter(x => x !== null);

    console.log('🎉 RECOVERY SUCCESSFUL');
    console.log('Results sample:', results.slice(0, 2));
    return results;

  } catch (err) {
    console.error('❌ Recovery failed:', err);
  }
}

// RUN THE RECOVERY
// const badFileId = 'files/batch-maipmv7s3fmn90r7o86seuhw7dsyap1mwoym';
// recoverBatchResult(badFileId);

export async function inspectJob(batchId) {
  const job = await genAI.batches.get({ name: `batches/${batchId}` });
  return job;
}
