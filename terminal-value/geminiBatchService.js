import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Helper to fetch ALL pages from the API
 */
async function fetchAllPages(params) {
  let allItems = [];
  let pageToken = undefined;

  do {
    const currentParams = pageToken ? { ...params, pageToken } : params;
    const response = await genAI.batches.list(currentParams);

    const items = response.pageInternal?.length > 0 
      ? response.pageInternal 
      : (response.batches || []);
    
    allItems = allItems.concat(items);
    pageToken = response.nextPageToken;

  } while (pageToken);

  return allItems;
}

/**
 * Creates a batch job with a SINGLE prompt request.
 * Newlines in the input are preserved as part of the text, not split into new requests.
 */
export async function createBatchJob(promptText) {
  const fileName = `request-${Date.now()}.jsonl`;
  const modelName = "models/gemini-3-pro-preview";

  try {
    // Single Request Logic: Wrap the entire text (including newlines) into one object
    const batchData = [{
      request: { contents: [{ parts: [{ text: promptText }] }] }
    }];
    
    fs.writeFileSync(fileName, batchData.map(d => JSON.stringify(d)).join("\n"));

    const uploadResult = await genAI.files.upload({
      file: fileName,
      config: { mimeType: "text/plain" }
    });

    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: `Web_Job_${Date.now()}` }
    });

    return batchJob;

  } catch (err) {
    console.error("❌ Service Error:", err);
    throw err;
  } finally {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
  }
}

/**
 * Lists ALL jobs (Active & History) by iterating through pagination.
 */
export async function getAllJobs() {
  try {
    const activeJobsPromise = fetchAllPages({
      pageSize: 100,
      filter: 'state="JOB_STATE_PENDING" OR state="JOB_STATE_RUNNING"'
    });

    const historyJobsPromise = fetchAllPages({
      pageSize: 100 
    });

    const [activeJobs, historyJobs] = await Promise.all([activeJobsPromise, historyJobsPromise]);

    const jobMap = new Map();
    [...activeJobs, ...historyJobs].forEach(j => jobMap.set(j.name, j));
    
    const allJobs = Array.from(jobMap.values()).sort((a, b) => 
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );

    return allJobs.map(job => ({
      id: job.name.split("/").pop(),
      fullId: job.name,
      status: job.state.replace("JOB_STATE_", ""),
      created: new Date(job.createTime).toLocaleString(),
      model: job.model?.split("/").pop() || "Unknown",
      outputFile: job.outputFile || job.outputConfig?.filePath || null
    }));

  } catch (err) {
    console.error("❌ Dashboard Error:", err);
    return [];
  }
}