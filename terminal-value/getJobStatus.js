import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌ GEMINI_API_KEY is missing. Please check your .env file.");
}

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function showJobDashboard() {
  console.log("🔍 Scanning Batch Jobs Dashboard...");

  try {
    // --- PREPARE REQUESTS ---
    const activeFilter = 'state="JOB_STATE_PENDING" OR state="JOB_STATE_RUNNING"';
    
    console.log("\n📡 [REQUEST 1] Fetching Active Jobs (Filter Bypass)...");
    const activePromise = genAI.batches.list({
      pageSize: 100,
      filter: activeFilter
    });

    console.log("📡 [REQUEST 2] Fetching Job History (Recent)...");
    const historyPromise = genAI.batches.list({
      pageSize: 50
    });

    // --- EXECUTE REQUESTS ---
    const [activeRes, historyRes] = await Promise.all([activePromise, historyPromise]);

    // --- HELPER: ROBUST EXTRACTION ---
    // Fix: Checks 'pageInternal' if 'batches' is empty
    const extractJobs = (response) => {
      if (response.pageInternal && response.pageInternal.length > 0) {
        return response.pageInternal;
      }
      return response.batches || [];
    };

    const activeJobs = extractJobs(activeRes);
    const historyJobs = extractJobs(historyRes);

    // --- LOGGING FOR VERIFICATION ---
    console.log(`\n📥 [DEBUG] Found ${activeJobs.length} Active Jobs.`);
    console.log(`📥 [DEBUG] Found ${historyJobs.length} History Jobs.`);

    // --- MERGE & DEDUPLICATE ---
    const jobMap = new Map();

    const addJobs = (list) => {
      if (!list) return;
      list.forEach(job => jobMap.set(job.name, job));
    };

    addJobs(activeJobs);
    addJobs(historyJobs);

    const allJobs = Array.from(jobMap.values());

    // --- SORT & DISPLAY ---
    allJobs.sort((a, b) => {
      return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
    });

    if (allJobs.length === 0) {
      console.log("\n✅ No jobs found (checked both active queue and history).");
      return;
    }

    const tableData = allJobs.map(job => {
      let statusIcon = "❓";
      if (job.state === "JOB_STATE_SUCCEEDED") statusIcon = "✅";
      else if (job.state === "JOB_STATE_FAILED") statusIcon = "❌";
      else if (job.state === "JOB_STATE_PENDING") statusIcon = "⏳";
      else if (job.state === "JOB_STATE_RUNNING") statusIcon = "🔄";

      let duration = "---";
      if (job.endTime && job.createTime) {
        const diffMs = new Date(job.endTime) - new Date(job.createTime);
        duration = `${Math.floor(diffMs / 1000)}s`;
      }

      return {
        "Job ID": job.name.split("/").pop(),
        "Status": `${statusIcon} ${job.state.replace("JOB_STATE_", "")}`,
        "Created At": new Date(job.createTime).toLocaleString(),
        "Duration": duration,
        "Model": job.model ? job.model.split("/").pop() : "Unknown"
      };
    });

    const pendingCount = allJobs.filter(j => j.state === "JOB_STATE_PENDING").length;
    const runningCount = allJobs.filter(j => j.state === "JOB_STATE_RUNNING").length;

    console.log(`\n📊 FINAL DASHBOARD:`);
    console.log(`   Active: ${pendingCount + runningCount} (⏳ ${pendingCount} Queued, 🔄 ${runningCount} Running)`);
    console.log(`   Total Visible: ${allJobs.length}`);
    console.log(""); 

    console.table(tableData);

  } catch (err) {
    console.error("\n❌ Error loading dashboard:", err);
  }
}

showJobDashboard();