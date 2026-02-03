import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Function 1: Create, Poll, and Download a Batch Job
 */
export async function createAndRunBatch(prompts) {
  const fileName = "requests.jsonl";
  const modelName = "models/gemini-3-pro-preview";

  try {
    // 1. Prepare Data
    console.log("🛠  [1/5] Preparing batch file payload...");
    const batchData = prompts.map(text => ({
      request: { contents: [{ parts: [{ text: text }] }] }
    }));
    fs.writeFileSync(fileName, batchData.map(d => JSON.stringify(d)).join("\n"));

    // 2. Upload
    console.log("📤 [2/5] Uploading to Gemini File API...");
    const uploadResult = await genAI.files.upload({
      file: fileName,
      config: { mimeType: "text/plain" }
    });

    // 3. Create Job
    console.log(`🚀 [3/5] Creating Batch Job (${modelName})...`);
    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: "Refactored_Batch_Run" }
    });
    console.log(`   Job ID: ${batchJob.name}`);

    // 4. Poll
    console.log("⏳ [4/5] Waiting for completion (polling 10s)...");
    let status = "JOB_STATE_PENDING";
    let completedJob = null;

    while (status !== "JOB_STATE_SUCCEEDED" && status !== "JOB_STATE_FAILED") {
      await new Promise(r => setTimeout(r, 10000));
      const check = await genAI.batches.get({ name: batchJob.name });
      status = check.state;
      process.stdout.write(`   Status: ${status}\r`);

      if (status === "JOB_STATE_FAILED") {
        console.error("\n❌ Job Failed:", check.error);
        return;
      }
      if (status === "JOB_STATE_SUCCEEDED") {
        completedJob = check;
        console.log("\n✅ Job Succeeded!");
        break;
      }
    }

    // 5. Download & Parse
    const outputFile = completedJob.outputFile || completedJob.outputConfig?.filePath;
    if (outputFile) {
      console.log(`\nmn [5/5] Downloading Results: ${outputFile}`);
      const fileResponse = await genAI.files.download({ name: outputFile });
      const text = await fileResponse.text();
      
      // FIXED: Corrected syntax error here
      const lines = text.split("\n").filter(line => line.trim() !== "");

      console.log("--- BATCH RESULTS ---");
      lines.forEach((line, index) => {
        const entry = JSON.parse(line);
        const result = entry.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`\nQs: ${prompts[index]}`);
        console.log(`Ks: ${result ? result.trim() : "N/A"}`);
      });
    }

  } catch (err) {
    console.error("❌ Service Error:", err);
  } finally {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
  }
}

/**
 * Function 2: List All Active and Completed Jobs
 */
export async function listJobDashboard() {
  console.log("🔍 Scanning Batch Jobs Dashboard...");

  try {
    // Run queries in parallel for speed
    const [activeRes, historyRes] = await Promise.all([
      genAI.batches.list({
        pageSize: 100,
        filter: 'state="JOB_STATE_PENDING" OR state="JOB_STATE_RUNNING"'
      }),
      genAI.batches.list({ pageSize: 50 })
    ]);

    // Robust extraction helper
    const extract = (res) => res.pageInternal?.length > 0 ? res.pageInternal : (res.batches || []);
    
    const jobMap = new Map();
    [...extract(activeRes), ...extract(historyRes)].forEach(j => jobMap.set(j.name, j));
    
    const allJobs = Array.from(jobMap.values()).sort((a, b) => 
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime()
    );

    if (allJobs.length === 0) {
      console.log("✅ No jobs found.");
      return;
    }

    // Formatted Table Data
    const tableData = allJobs.map(job => {
      const statusIcon = {
        "JOB_STATE_SUCCEEDED": "✅",
        "JOB_STATE_FAILED": "❌",
        "JOB_STATE_PENDING": "⏳",
        "JOB_STATE_RUNNING": "🔄"
      }[job.state] || "❓";

      return {
        "Job ID": job.name.split("/").pop(),
        "Status": `${statusIcon} ${job.state.replace("JOB_STATE_", "")}`,
        "Created": new Date(job.createTime).toLocaleString(),
        "Model": job.model?.split("/").pop() || "Unknown"
      };
    });

    // Summary Stats
    const activeCount = allJobs.filter(j => 
      ["JOB_STATE_PENDING", "JOB_STATE_RUNNING"].includes(j.state)
    ).length;

    console.log(`\n📊 Dashboard: ${allJobs.length} Visible | ${activeCount} Active`);
    console.table(tableData);

  } catch (err) {
    console.error("❌ Dashboard Error:", err);
  }
}