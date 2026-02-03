import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Creates a batch job and returns the job metadata immediately.
 * Does NOT wait for completion (async).
 */
export async function createBatchJob(promptText) {
  const fileName = `request-${Date.now()}.jsonl`;
  const modelName = "models/gemini-3-pro-preview";

  try {
    // 1. Prepare Data
    const batchData = [{
      request: { contents: [{ parts: [{ text: promptText }] }] }
    }];
    
    fs.writeFileSync(fileName, batchData.map(d => JSON.stringify(d)).join("\n"));

    // 2. Upload
    const uploadResult = await genAI.files.upload({
      file: fileName,
      config: { mimeType: "text/plain" }
    });

    // 3. Create Job
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
 * Lists all jobs (Active & History)
 */
export async function getAllJobs() {
  try {
    const [activeRes, historyRes] = await Promise.all([
      genAI.batches.list({
        pageSize: 100,
        filter: 'state="JOB_STATE_PENDING" OR state="JOB_STATE_RUNNING"'
      }),
      genAI.batches.list({ pageSize: 50 })
    ]);

    const extract = (res) => res.pageInternal?.length > 0 ? res.pageInternal : (res.batches || []);
    
    const jobMap = new Map();
    [...extract(activeRes), ...extract(historyRes)].forEach(j => jobMap.set(j.name, j));
    
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