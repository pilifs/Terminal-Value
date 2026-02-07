import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createBatchJob, getGenerateValueHash } from './geminiBatchService.js';
// UPDATED: Point to ../../terminal-value/memoizedResults/generateValueResults.js
import { generateValueResults } from '../../terminal-value/memoizedResults/generateValueResults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSkiShopContext() {
  // UPDATED: Point to ../example-ski-shop/public (sibling app in apps/ folder)
  const skiShopPublicDir = path.resolve(
    __dirname,
    '../example-ski-shop/public'
  );

  if (!fs.existsSync(skiShopPublicDir)) {
    console.warn(`⚠️ Ski Shop Directory not found at: ${skiShopPublicDir}`);
    return '';
  }

  let fileContents = [];

  function readDirRecursive(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'dynamicOrder' || entry.name === 'dynamicHome') {
          continue;
        }
        readDirRecursive(fullPath);
      } else {
        const relativePath = path.relative(skiShopPublicDir, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        fileContents.push(`\n// --- FILE: ${relativePath} ---\n${content}`);
      }
    }
  }

  readDirRecursive(skiShopPublicDir);
  return fileContents.join('\n');
}

export async function createSkiShopWebComponentPrompt(
  promptText,
  customId,
  pageType,
  valueInputHash = null
) {
  const fileContext = getSkiShopContext();

  const combinedPrompt = `
${promptText}

================================================================================
BELOW IS THE EXISTING CODEBASE FOR THE SKI SHOP SITE (excluding dynamic folders)
================================================================================
${fileContext}
`;

  console.log(
    `🚀 Creating Ski Shop Component Job (Client: ${
      customId || 'Unknown'
    }, Type: ${pageType})...`
  );
  return createBatchJob(combinedPrompt, customId, pageType, valueInputHash);
}

export async function generateAllHomePageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Home Pages...`
  );

  // Calculate hash once for this batch run
  const valueInputHash = getGenerateValueHash();

  const jobs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentHome;

    if (!promptText) continue;

    console.log(`\n▶️ Processing Home Page for: ${clientId}`);
    try {
      const job = await createSkiShopWebComponentPrompt(
        promptText,
        clientId,
        'home',
        valueInputHash // Pass Hash
      );
      jobs.push({
        clientId,
        type: 'HOME',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Failed for ${clientId}:`, err.message);
      jobs.push({
        clientId,
        type: 'HOME',
        status: 'FAILED',
        error: err.message,
      });
    }
  }
  console.table(jobs);
  return jobs;
}

export async function generateAllOrderPageComponents() {
  console.log(
    `🚀 Starting batch generation for ${generateValueResults.length} Order Pages...`
  );

  // Calculate hash once for this batch run
  const valueInputHash = getGenerateValueHash();

  const jobs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentOrder;

    if (!promptText) {
      console.warn(
        `⚠️ Skipping ${clientId}: No 'webComponentOrder' prompt found.`
      );
      continue;
    }

    console.log(`\n▶️ Processing Order Page for: ${clientId}`);
    try {
      const job = await createSkiShopWebComponentPrompt(
        promptText,
        clientId,
        'order',
        valueInputHash // Pass Hash
      );
      jobs.push({
        clientId,
        type: 'ORDER',
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Failed for ${clientId}:`, err.message);
      jobs.push({
        clientId,
        type: 'ORDER',
        status: 'FAILED',
        error: err.message,
      });
    }
  }
  console.table(jobs);
  return jobs;
}
