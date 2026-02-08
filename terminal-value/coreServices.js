import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createBatchJob } from '../apps/gemini-batch/geminiBatchService.js';

// TODO: implement generateValue method for real, mock only used in hash logic for now
import { generateValueResults as generateValueResultsMock } from './memoizedResults/generateValueResults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function executeValueChain() {
  // parseValue(db)
  // generateValue(parseValueResults)
  // const homePageJobs = generateAllHomePageComponents(generateValueResults)
  // const orderPageJobs = generateAllOrderPageComponents(generateValueResults)
  // await submitBatchJobs([...homePageJobs, ...orderPageJobs])
  // poll / pull results (TODO)
  // verify confidence (TODO)
}

export function getGenerateValueResults() {
  return generateValueResultsMock;
}

// TODO: update this to hash actual result from getGenerateValueResults
export function getGenerateValueHash() {
  const GENERATE_VALUE_PATH = path.join(
    __dirname,
    'memoizedResults/generateValueResults.js'
  );

  try {
    if (fs.existsSync(GENERATE_VALUE_PATH)) {
      const content = fs.readFileSync(GENERATE_VALUE_PATH, 'utf-8');
      return crypto.createHash('sha256').update(content).digest('hex');
    }
  } catch (e) {
    console.warn('⚠️ Could not calculate hash for generateValueResults.js', e);
  }
  return null;
}

function getSkiShopContext() {
  const skiShopPublicDir = path.resolve(
    __dirname,
    '../apps/example-ski-shop/public'
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

export function createSkiShopWebComponentPrompt(
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

  return {
    combinedPrompt,
    customId,
    pageType,
    valueInputHash,
  };
}

export function generateAllHomePageComponents(generateValueResultsMock) {
  console.log(
    `🚀 Preparing batch configuration for ${generateValueResultsMock.length} Home Pages...`
  );

  const valueInputHash = getGenerateValueHash();
  const jobConfigs = [];

  for (const clientData of generateValueResultsMock) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentHome;

    if (!promptText) continue;

    const config = createSkiShopWebComponentPrompt(
      promptText,
      clientId,
      'home',
      valueInputHash
    );
    jobConfigs.push(config);
  }

  return jobConfigs;
}

export function generateAllOrderPageComponents(generateValueResults) {
  console.log(
    `🚀 Preparing batch configuration for ${generateValueResults.length} Order Pages...`
  );

  const valueInputHash = getGenerateValueHash();
  const jobConfigs = [];

  for (const clientData of generateValueResults) {
    const clientId = clientData.clientId;
    const promptText = clientData.prompts?.webComponentOrder;

    if (!promptText) {
      console.warn(
        `⚠️ Skipping ${clientId}: No 'webComponentOrder' prompt found.`
      );
      continue;
    }

    const config = createSkiShopWebComponentPrompt(
      promptText,
      clientId,
      'order',
      valueInputHash
    );
    jobConfigs.push(config);
  }

  return jobConfigs;
}

export async function submitBatchJobs(jobConfigs) {
  console.log(`🚀 Submitting ${jobConfigs.length} batch jobs...`);

  const jobs = [];

  for (const config of jobConfigs) {
    const { combinedPrompt, customId, pageType, valueInputHash } = config;
    const clientId = customId; // Assuming customId maps to clientId for logging

    console.log(`\n▶️ Processing ${pageType} Page for: ${clientId}`);
    try {
      const job = await createBatchJob(
        combinedPrompt,
        customId,
        pageType,
        valueInputHash
      );

      jobs.push({
        clientId,
        type: pageType.toUpperCase(),
        jobId: job.name,
        status: 'SUBMITTED',
      });
      console.log(`✅ Job created: ${job.name.split('/').pop()}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`❌ Failed for ${clientId}:`, err.message);
      jobs.push({
        clientId,
        type: pageType.toUpperCase(),
        status: 'FAILED',
        error: err.message,
      });
    }
  }

  console.table(jobs);
  return jobs;
}

export async function verifyExternalConfidenceMethod(hash) {
  // Implement logic to verify external confidence for generated components based on the provided hash
  // This function can read the generated components for the given hash, compare them to the default implementation,
  // and use a Gemini model to assess confidence and safety. The results can be logged or stored as needed.
}
