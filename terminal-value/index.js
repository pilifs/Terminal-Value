import { createAndRunBatch, listJobDashboard } from "./geminiBatchService.js";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "create":
      await createAndRunBatch([
        "Explain Node.js streams in 1 sentence.",
        "What is the capital of Canada?"
      ]);
      break;
      
    case "list":
      await listJobDashboard();
      break;

    default:
      console.log("Usage:");
      console.log("  node index.js create  -> Run a new batch job");
      console.log("  node index.js list    -> Show job dashboard");
  }
}

main();