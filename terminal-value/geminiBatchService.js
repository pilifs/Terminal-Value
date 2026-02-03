import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
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
        pageSize: 50
    }

    // 2. Make the API request
    // Note: We pass currentParams directly (no 'config' wrapper) to avoid fetch errors
    const response = await genAI.batches.list(params);

    // 3. Extract items from SDK's specific response structure
    const items = response.pageInternal?.length > 0 
    ? response.pageInternal 
    : (response.batches || []);
    
    allItems = allItems.concat(items);

    return allItems;
}

/**
 * Creates a batch job with a SINGLE prompt request.
 * Newlines in the input are preserved as part of the text.
 */
export async function createBatchJob(promptText) {
  const fileName = `request-${Date.now()}.jsonl`;
  const modelName = "models/gemini-3-pro-preview";

  try {
    // Single Request Logic: Wrap the entire text into one request object
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
 * Lists ALL jobs by fetching the full history.
 */
export async function getAllJobs() {
  try {
    // Fetch everything in one go (Server-side filtering is not supported)
    const allJobs = await fetchAllPages();

    // Sort by creation time (Newest First)
    // We use a Map to deduplicate just in case, though the linear fetch should be unique
    const jobMap = new Map();
    allJobs.forEach(j => jobMap.set(j.name, j));
    
    const sortedJobs = Array.from(jobMap.values()).sort((a, b) => 
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );

    return sortedJobs.map(job => ({
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