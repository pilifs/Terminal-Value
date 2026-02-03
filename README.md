# Terminal Value

A project demonstrating the value of exposing an LLM as close to the end user as possible.

To get started, create a .env file in the folder of the project you intend to run and add your Google Gemini API key

.env
GEMINI_API_KEY=AIzaSyD...YourActualKey...

---

## Running the two projects independently ✅

Both the example app (ski-shop) and the CLI `terminal-value` tool are runnable on their own — they have separate package.json files and do not conflict.

1. Run the CLI examples (root-level)

```bash
# from repo root
cd terminal-value
npm install
# run the full demo (uploads a JSONL, creates a batch, polls results)
npm start

n# or run helpers:
npm run get-job-status -- <optional:full-batch-resource-name>
npm run check-job-status -- <batches/your-id>
npm run list-completed-jobs
```

2. Run the ski-shop example (isolated)

```bash
cd examples/ski-shop
npm install
npm start
```

Notes:
- Both projects use their own node_modules and package.json. They require Node >=20.
- Keep a separate `.env` in whichever folder you run from (or set GEMINI_API_KEY in your environment).
- If you want me to install dependencies and run a smoke test for either project, tell me which one and I'll run it for you. 🚀