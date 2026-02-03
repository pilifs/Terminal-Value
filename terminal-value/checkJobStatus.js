import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

// Ensure API key is loaded
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Checks the status of a specific Batch Job
 * @param {string} batchId - The full resource name (e.g., "batches/abcdef12345")
 */
async function getBatchStatus(batchId) {
  if (!batchId) {
    console.error("❌ Error: Please provide a Batch ID.");
    console.log("Usage: node get-batch-status.js batches/your-id-here");
    return;
  }

  try {
    console.log(`🔍 Checking status for: ${batchId}...`);

    // IMPORTANT: Pass the ID as an object property { name: ... }
    const jobStatus = await genAI.batches.get({ name: batchId });

    // 1. Print High-Level Status
    console.log(`\n✅ Status: ${jobStatus.state}`);
    console.log(`📅 Created: ${jobStatus.createTime}`);
    
    if (jobStatus.state === "JOB_STATE_SUCCEEDED") {
        console.log(`📂 Output:  ${jobStatus.outputFile || jobStatus.outputConfig?.filePath}`);
    } else if (jobStatus.state === "JOB_STATE_FAILED") {
        console.log(`❌ Error:   ${jobStatus.error?.message}`);
    }

    // 2. Print Full Debug Response
    console.log("\n👇 [FULL API RESPONSE]");
    console.log(JSON.stringify(jobStatus, null, 2));

  } catch (error) {
    console.error("❌ API Error:", error.message);
  }
}

// Get the Batch ID from the command line arguments
const args = process.argv.slice(2);
const batchIdFromCmd = args[0];

getBatchStatus(batchIdFromCmd);