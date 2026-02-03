import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import "dotenv/config";

// Ensure API key is loaded
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function main() {
  const fileName = "requests.jsonl";
  const modelName = "models/gemini-3-pro-preview"; 

  try {
    // --- PHASE 1: PREPARE DATA ---
    console.log("🛠  [REQUEST] Preparing batch file payload...");
    
    const prompts = [
      "Explain Node.js streams in 1 sentence.",
      "What is the capital of Canada?"
    ];

    const batchData = prompts.map(text => ({
      request: {
        contents: [{ parts: [{ text: text }] }]
      }
    }));

    console.log("📄 [PAYLOAD] JSONL Content Preview:");
    console.log(JSON.stringify(batchData, null, 2));

    fs.writeFileSync(fileName, batchData.map(d => JSON.stringify(d)).join("\n"));

    // --- PHASE 2: UPLOAD FILE ---
    console.log("\n📤 [REQUEST] Uploading to Gemini File API...");
    const uploadResult = await genAI.files.upload({
      file: fileName,
      config: { mimeType: "text/plain" }
    });
    
    console.log("📥 [RESPONSE] Upload Result:");
    console.log(JSON.stringify(uploadResult, null, 2));

    // --- PHASE 3: CREATE JOB ---
    console.log(`\n🚀 [REQUEST] Creating Batch Job using ${modelName}...`);
    const batchJob = await genAI.batches.create({
      model: modelName,
      src: uploadResult.name,
      config: { displayName: "Deep_Log_Test" }
    });

    console.log("📥 [RESPONSE] Create Job Result:");
    console.log(JSON.stringify(batchJob, null, 2));

    console.log(`\n⏳ Job ID: ${batchJob.name}`);
    console.log("   Waiting for completion (polls every 10s)...");

    // --- PHASE 4: POLL STATUS (UPDATED) ---
    let status = "JOB_STATE_PENDING";
    let completedJob = null;

    while (status !== "JOB_STATE_SUCCEEDED" && status !== "JOB_STATE_FAILED") {
      await new Promise(r => setTimeout(r, 10000)); // Poll every 10s
      
      const check = await genAI.batches.get({ name: batchJob.name });
      status = check.state;
      
      // LOGGING: Full Dump of the Status Response
      console.log(`\n🔄 [POLL] Status: ${status}`);
      console.log("👇 [RESPONSE] Full API Response Object:");
      console.log(JSON.stringify(check, null, 2)); 

      if (status === "JOB_STATE_FAILED") {
        console.error("❌ Job Failed.");
        return;
      }

      if (status === "JOB_STATE_SUCCEEDED") {
        completedJob = check;
        break;
      }
    }

    // --- PHASE 5: DOWNLOAD RESULTS ---
    const outputFileName = completedJob.outputFile || completedJob.outputConfig?.filePath;

    if (outputFileName) {
        console.log(`\n📥 [REQUEST] Downloading Results from: ${outputFileName}`);
        await processResults(outputFileName, prompts);
    } else {
        console.error("❌ Job finished but no output file found.");
    }

  } catch (err) {
    console.error("❌ Critical Error:", err);
  } finally {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
  }
}

async function processResults(outputFileName, originalPrompts) {
  try {
    const fileResponse = await genAI.files.download({ name: outputFileName });
    const text = await fileResponse.text();

    console.log("\n📄 [RESPONSE] Raw Output File Content:");
    console.log("---------------------------------------------------");
    console.log(text.trim());
    console.log("---------------------------------------------------\n");
    
    const lines = text.split("\n").filter(line => line.trim() !== "");
    
    console.log("--- PARSED RESULTS ---");
    lines.forEach((line, index) => {
        const entry = JSON.parse(line);
        const resultText = entry.response?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        console.log(`\n[Prompt ${index + 1}]: ${originalPrompts[index]}`);
        console.log(`[Answer]: ${resultText ? resultText.trim() : "No text returned"}`);
    });

  } catch (e) {
      console.error("Error parsing results:", e);
  }
}

main();