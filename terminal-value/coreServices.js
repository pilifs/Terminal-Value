import fs from 'fs';
import path, { parse } from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createBatchJob } from '../apps/gemini-batch/geminiBatchService.js';

// TODO: implement parseValue and generateValue methods for real, mock only used in hash logic for now
import { generateValueResults as generateValueResultsMock } from './memoizedResults/generateValueResults.js';
import { parseValueResults as parseValueResultsMock } from './memoizedResults/parseValueResults.js';

parseValueResultsMock;

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

export function getParseValueResults() {
  return parseValueResultsMock;
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

/**
 * Higher Order Function to create page component generators.
 * @param {string} pageType - 'home' or 'order'
 * @returns {function} Function that accepts results and returns job configs
 */
function createPageGenerator(pageType) {
  return (generateValueResults) => {
    console.log(
      `🚀 Preparing batch configuration for ${generateValueResults.length} ${
        pageType.charAt(0).toUpperCase() + pageType.slice(1)
      } Pages...`
    );

    const valueInputHash = getGenerateValueHash();
    const jobConfigs = [];

    // Map 'home' -> 'webComponentHome', 'order' -> 'webComponentOrder'
    const promptKey = `webComponent${
      pageType.charAt(0).toUpperCase() + pageType.slice(1)
    }`;

    for (const clientData of generateValueResults) {
      const clientId = clientData.clientId;
      const promptText = clientData.prompts?.[promptKey];

      if (!promptText) {
        if (pageType === 'order') {
          console.warn(
            `⚠️ Skipping ${clientId}: No '${promptKey}' prompt found.`
          );
        }
        continue;
      }

      const config = createSkiShopWebComponentPrompt(
        promptText,
        clientId,
        pageType,
        valueInputHash
      );
      jobConfigs.push(config);
    }

    return jobConfigs;
  };
}

export const generateAllHomePageComponents = createPageGenerator('home');
export const generateAllOrderPageComponents = createPageGenerator('order');

export async function submitBatchJobs(jobConfigs) {
  console.log(`🚀 Submitting ${jobConfigs.length} batch jobs...`);

  const jobs = [];

  for (const config of jobConfigs) {
    const { combinedPrompt, customId, pageType, valueInputHash } = config;
    const clientId = customId;

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
  // Implement logic to verify external confidence
}
