import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listCompletedJobs() {
  try {
    console.log("🔍 Fetching all batch jobs history...");

    let allJobs = [];
    let pageToken = undefined;

    // 1. Pagination Loop: Fetch ALL jobs (not just the first page)
    do {
      const response = await genAI.batches.list({
        pageSize: 100, // Max page size
        pageToken: pageToken
      });

      // The SDK returns 'batches' array
      if (response.batches && response.batches.length > 0) {
        allJobs = allJobs.concat(response.batches);
      }
      
      pageToken = response.nextPageToken;
    } while (pageToken);

    // 2. Filter specifically for SUCCEEDED jobs
    const completedJobs = allJobs.filter(job => job.state === "JOB_STATE_SUCCEEDED");

    console.log(`\n📊 Summary:`);
    console.log(`- Total Jobs Found: ${allJobs.length}`);
    console.log(`- Completed Jobs:   ${completedJobs.length}`);

    if (completedJobs.length === 0) {
      console.log("No completed jobs found.");
      return;
    }

    // 3. Display formatted details
    console.log("\n✅ Completed Batch Jobs:");
    const tableData = completedJobs.map(job => {
      // Extract just the filename from the full path if possible
      const outputFile = job.outputFile ? job.outputFile.split("/").pop() : "N/A";
      
      return {
        "Job ID": job.name.split("/").pop(),
        "Created At": job.createTime ? new Date(job.createTime).toLocaleDateString() : "N/A",
        "Output File": outputFile,
        "Model": job.model.split("/").pop()
      };
    });

    console.table(tableData);

  } catch (error) {
    console.error("❌ Error listing jobs:", error);
  }
}

listCompletedJobs();