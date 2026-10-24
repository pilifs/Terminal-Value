import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createBatchJob } from '../apps/gemini-batch/geminiBatchService.js';

import db from './functionalTests/fixedMocks/db.js';
import generateValue from './generateValue.js';
import parseValue from './parseValue.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. CORE VALUE CHAIN ORCHESTRATION
// ============================================================================

/**
 * Orchestrates the entire value creation chain for the project.
 *
 * This method serves as the high-level roadmap. It delegates the creation of
 * domain metadata and fully prepared job configurations to `generateValueMetadata`
 * and then handles the side-effect of submitting those jobs to the external service.
 */
export async function executeValueChain(metadata) {
  metadata = metadata || generateValueMetadata(db);

  await submitBatchJobs(metadata);

  // Poll results and verify (Future Implementation)
  // await verifyExternalConfidence(results);
}

/**
 * Generates the metadata and job configurations required for the value chain.
 *
 * This pure function abstracts the first 4 steps of the value chain:
 * 1. Retrieving parsed domain entities.
 * 2. Generating enriched value results.
 * 3. Creating job configs for Home Page components.
 * 4. Transforming configs into Batch API Metadata.
 *
 * @returns {Array<Object>} A combined list of all batch job metadata ready for submission.
 */
export function generateValueMetadata(fullDb) {
  // 1. Parse raw data source into domain entities (Mocked)
  const parsedData = getParseValueResults(fullDb);

  // 2. Generate enriched content/prompts based on domain entities (Mocked)
  const generateValueResults = getGenerateValueResults(parsedData);

  // 3. Prepare batch jobs for Home Page web components
  const homePageJobs = generateAllHomePageComponents(generateValueResults);

  const rawConfigs = [...homePageJobs];

  // 4. Convert raw configs into Batch API metadata
  return createBatchJobMetadata(rawConfigs);
}

/**
 * Generates the metadata and job configurations for a single client in real-time.
 *
 * @param {Object} client - A single client object (one item from parsedData).
 * @returns {Array<Object>} A list of batch job metadata for this specific client.
 */
export function generateValueMetadataRealtime(client) {
  // 1. Generate enriched content/prompts based on the single domain entity
  const generateValueResults = getGenerateValueResults([client]);

  // 2. Prepare single send jobs for Home Page web components
  const homePageJobs = generateAllHomePageComponents(generateValueResults);

  const rawConfigs = [...homePageJobs];

  // 3. Convert raw configs into Batch API metadata
  const clientMetadata = createGeminiApiRequestMetadata(rawConfigs);

  // 4. Include original client profile data to render in front-end
  clientMetadata.profile = client.profile;

  return clientMetadata;
}

/**
 * Helper to map job configurations to a specific output format.
 * Reduces duplication between Batch and Realtime metadata creation.
 *
 * @param {Array<Object>} jobConfigs - List of job configurations.
 * @param {Function} payloadBuilder - Function(prompt) that returns the specific payload object.
 * @returns {Array<Object>}
 */
function mapJobConfigs(jobConfigs, payloadBuilder) {
  return jobConfigs.map((config) => {
    const { combinedPrompt, customId, pageType, fileHash, promptId } = config;
    return {
      ...payloadBuilder(combinedPrompt),
      customId,
      pageType,
      fileHash,
      promptId,
    };
  });
}

/**
 * @param {Array<Object>} jobConfigs - The list of job configuration objects.
 * @returns {Array<Object>} A list of metadata objects ready for submission.
 */
export function createBatchJobMetadata(jobConfigs) {
  return mapJobConfigs(jobConfigs, (prompt) => ({
    batchData: [
      {
        request: { contents: [{ parts: [{ text: prompt }] }] },
      },
    ],
  }));
}

/**
 * Creates metadata required to submit a request to Gemini LLM API.
 *
 * @param {Array<Object>} jobConfigs - The list of job configuration objects.
 * @returns {Array<Object>} A list of metadata objects ready for submission.
 */
export function createGeminiApiRequestMetadata(jobConfigs) {
  return mapJobConfigs(jobConfigs, (prompt) => ({
    promptText: prompt,
  }));
}

/**
 * Generates batch job configurations specifically for the "Home Page" web components.
 * @type {function(Array): Array<Object>}
 */
export const generateAllHomePageComponents = createPageGenerator('home');

/**
 * Submits a list of configured jobs to the batch processing service.
 *
 * @param {Array<Object>} jobMetadataList - A list of prepared job metadata objects.
 * @returns {Promise<Array<Object>>} A summary of submitted jobs and their statuses.
 */
export async function submitBatchJobs(jobMetadataList) {
  console.log(`🚀 Submitting ${jobMetadataList.length} batch jobs...`);

  const jobs = [];

  for (const meta of jobMetadataList) {
    const { batchData, customId, pageType, fileHash } = meta;
    const clientId = customId;

    console.log(`\n▶️ Processing ${pageType} Page for: ${clientId}`);
    try {
      const job = await createBatchJob(batchData, customId, pageType, fileHash);

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
      `🚀 Preparing batch configuration for ${generateValueResults.length} clients (${pageType} Page)...`
    );

    const jobConfigs = [];

    for (const clientData of generateValueResults) {
      const clientId = clientData.clientId;
      const prompts = clientData.prompts || {};

      // Iterate over all generated prompts for this client
      // Each value is expected to be: { promptId: string, text: string }
      Object.values(prompts).forEach((promptData) => {
        const { promptId, text } = promptData;

        // Currently, our experiment prompts are designed for the Home Page.
        // We filter based on pageType to ensure we don't duplicate jobs or use wrong prompts.
        if (pageType === 'home') {
          const config = createSkiShopWebComponentPrompt(
            text,
            clientId,
            pageType,
            null, // Legacy to not fully break batch support, replace with hash of file bundle in next call
            promptId
          );
          jobConfigs.push(config);
        }
      });
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
  fileHash,
  promptId
) {
  const fileContext = getSkiShopContext();

  // Hash the file contents for version/change tracking
  const contextHash = crypto
    .createHash('sha256')
    .update(fileContext)
    .digest('hex');

  // fileHash is always null unless in case of batch job retrieval where it was previously generated
  fileHash = fileHash || contextHash;

  const combinedPrompt = `${promptText}

${fileContext}`;

  return {
    combinedPrompt,
    customId,
    pageType,
    fileHash,
    promptId,
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

  function readDirRecursive(dir, indentLevel = 0) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    // Sort entries to ensure deterministic output (folders first or alphabetical)
    entries.sort((a, b) => a.name.localeCompare(b.name));

    let xmlOutput = '';
    const indent = '  '.repeat(indentLevel);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === 'dynamicOrder' || entry.name === 'dynamicHome') {
          continue;
        }
        // Normalize tag name (replace non-alphanumeric with _)
        const tagName = entry.name.replace(/[^a-zA-Z0-9-_]/g, '_');

        xmlOutput += `${indent}<${tagName}>\n`;
        xmlOutput += readDirRecursive(fullPath, indentLevel + 1);
        xmlOutput += `${indent}</${tagName}>\n`;
      } else {
        // Skip admin.html to avoid leaking admin logic or confusing the LLM
        if (entry.name === 'admin.html') {
          continue;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        xmlOutput += `${indent}<file name="${entry.name}">\n`;
        xmlOutput += content;
        // Ensure content ends with newline for cleaner XML
        if (!content.endsWith('\n')) xmlOutput += '\n';
        xmlOutput += `${indent}</file>\n`;
      }
    }
    return xmlOutput;
  }

  return readDirRecursive(skiShopPublicDir);
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

export function getGenerateValueResults(parsedData) {
  return generateValue(parsedData);
}

export function getParseValueResults(rawData) {
  return parseValue(rawData);
}

export async function verifyExternalConfidenceMethod(hash) {
  // Implement logic to verify external confidence
}
