import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createBatchJob } from '../apps/gemini-batch/geminiBatchService.js';

// TODO: implement parseValue and generateValue methods for real, mock only used in hash logic for now
import { generateValueResults as generateValueResultsMock } from './memoizedResults/generateValueResults.js';
import { parseValueResults as parseValueResultsMock } from './memoizedResults/parseValueResults.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. CORE VALUE CHAIN ORCHESTRATION
// ============================================================================

/**
 * Orchestrates the entire value creation chain for the project.
 *
 * This method serves as the high-level roadmap. It delegates the creation of
 * domain metadata and job configurations to `generateValueMetadata` and then
 * handles the side-effect of submitting those jobs to the external service.
 */
export async function executeValueChain() {
  // 1-4. Generate all metadata and batch job configurations (Pure extraction)
  const batchJobsConfig = generateValueMetadata();

  // 4b. Create Batch Job Metadata (Pure transformation)
  const batchJobMetadata = createBatchJobMetadata(batchJobsConfig);

  // 5. Submit all prepared jobs to the Gemini Batch API
  await submitBatchJobs(batchJobMetadata);

  // 6. Poll results and verify (Future Implementation)
  // await verifyExternalConfidence(results);
}

/**
 * Generates the metadata and job configurations required for the value chain.
 *
 * This pure function abstracts the first 4 steps of the value chain:
 * 1. Retrieving parsed domain entities.
 * 2. Generating enriched value results.
 * 3. Creating job configs for Home Page components.
 * 4. Creating job configs for Order Page components.
 *
 * @returns {Array<Object>} A combined list of all batch job configurations.
 */
export function generateValueMetadata() {
  // 1. Parse raw data source into domain entities (Mocked)
  // const db = getParseValueResults();
  // (Note: parseValueResults is not currently used by the generators, skipping for now)

  // 2. Generate enriched content/prompts based on domain entities (Mocked)
  const generateValueResults = getGenerateValueResults();

  // 3. Prepare batch jobs for Home Page web components
  const homePageJobs = generateAllHomePageComponents(generateValueResults);

  // 4. Prepare batch jobs for Order Page web components
  const orderPageJobs = generateAllOrderPageComponents(generateValueResults);

  return [...homePageJobs, ...orderPageJobs];
}

/**
 * Creates the batch job metadata required for execution.
 * This is a pure function that formats the request body for the Gemini Batch API.
 *
 * @param {Array<Object>} jobConfigs - The list of job configuration objects.
 * @returns {Array<Object>} A list of metadata objects ready for submission.
 */
export function createBatchJobMetadata(jobConfigs) {
  return jobConfigs.map((config) => {
    const { combinedPrompt, customId, pageType, valueInputHash } = config;

    // Logic extracted from geminiBatchService.js
    const batchData = [
      {
        request: { contents: [{ parts: [{ text: combinedPrompt }] }] },
      },
    ];

    return {
      batchData,
      customId,
      pageType,
      valueInputHash,
    };
  });
}

/**
 * Generates batch job configurations specifically for the "Home Page" web components.
 * @type {function(Array): Array<Object>}
 */
export const generateAllHomePageComponents = createPageGenerator('home');

/**
 * Generates batch job configurations specifically for the "Order Page" web components.
 * @type {function(Array): Array<Object>}
 */
export const generateAllOrderPageComponents = createPageGenerator('order');

/**
 * Submits a list of configured jobs to the batch processing service.
 *
 * @param {Array<Object>} jobMetadataList - A list of prepared job metadata objects (from createBatchJobMetadata).
 * @returns {Promise<Array<Object>>} A summary of submitted jobs and their statuses.
 */
export async function submitBatchJobs(jobMetadataList) {
  console.log(`🚀 Submitting ${jobMetadataList.length} batch jobs...`);

  const jobs = [];

  for (const meta of jobMetadataList) {
    const { batchData, customId, pageType, valueInputHash } = meta;
    const clientId = customId;

    console.log(`\n▶️ Processing ${pageType} Page for: ${clientId}`);
    try {
      const job = await createBatchJob(
        batchData,
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

// ============================================================================
// 2. HIGHER-ORDER FACTORIES
// ============================================================================

/**
 * Higher-Order Function (Factory) to create specialized page component generators.
 *
 * @param {string} pageType - The type of page to generate (e.g., 'home' or 'order').
 * @returns {function(Array): Array} A function that accepts value results and returns job configs.
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

// ============================================================================
// 3. UTILITIES & HELPERS
// ============================================================================

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

export function getGenerateValueResults() {
  return generateValueResultsMock;
}

export function getParseValueResults() {
  return parseValueResultsMock;
}

export async function verifyExternalConfidenceMethod(hash) {
  // Implement logic to verify external confidence
}
