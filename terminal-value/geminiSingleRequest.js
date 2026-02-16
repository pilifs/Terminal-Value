import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import Together from 'together-ai';

// Keep existing local imports
import { generateValueMetadataRealtime } from './coreServices.js';
import { parseValueResults } from './functionalTests/fixedMocks/parseValueResults.js';

// --- Configuration & Setup ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db-two.js');

// Configuration Constants
const ITERATIONS_PER_PROMPT = 10;
const MAX_CONCURRENCY_PER_MODEL = 10;

// Initialize clients
const together = new Together(); // Requires process.env.TOGETHER_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the list of models
const modelConfigs = [
  // {
  //   id: 'gemini-3-pro-preview',
  //   generate: async (prompt) => {
  //     return await ai.models.generateContent({
  //       model: 'gemini-3-pro-preview',
  //       contents: prompt,
  //     });
  //   },
  //   extract: (response) => {
  //     return response.candidates?.[0]?.content?.parts?.[0]?.text;
  //   },
  // },
  // {
  //   id: 'gemini-3-flash-preview',
  //   generate: async (prompt) => {
  //     return await ai.models.generateContent({
  //       model: 'gemini-3-flash-preview',
  //       contents: prompt,
  //     });
  //   },
  //   extract: (response) => {
  //     return response.candidates?.[0]?.content?.parts?.[0]?.text;
  //   },
  // },
  // {
  //   id: 'gemini-2-flash',
  //   generate: async (prompt) => {
  //     return await ai.models.generateContent({
  //       model: 'gemini-2.0-flash',
  //       contents: prompt,
  //     });
  //   },
  //   extract: (response) => {
  //     return response.candidates?.[0]?.content?.parts?.[0]?.text;
  //   },
  // },
  {
    id: 'llama-4-maverick',
    generate: async (prompt) => {
      return await together.chat.completions.create({
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: 'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8',
      });
    },
    extract: (response) => {
      return response.choices?.[0]?.message?.content;
    },
  },
];

// --- Helper Functions ---

/**
 * Simple concurrency limiter (p-limit style) to strictly control
 * active requests per model.
 */
function pLimit(concurrency) {
  const queue = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()();
    }
  };

  return (fn) => {
    const run = async () => {
      activeCount++;
      try {
        return await fn();
      } finally {
        next();
      }
    };

    if (activeCount < concurrency) {
      return run();
    } else {
      return new Promise((resolve) => {
        queue.push(() => resolve(run()));
      });
    }
  };
}

/**
 * Parses the AI response to separate file content, code snippets, and conversational text.
 */
function extractFileFromText(text) {
  if (!text) return { snippets: [], otherContent: '' };

  let remainingText = text;
  const snippets = [];

  // --- PASS 1: Explicit <file> Tags ---
  const fileTagRegex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
  remainingText = remainingText.replace(
    fileTagRegex,
    (match, fileName, content) => {
      snippets.push({
        fileName,
        content: content.trim(),
        type: 'xml_tag',
        lang: fileName.split('.').pop() || 'text',
      });
      return '';
    }
  );

  // --- PASS 2: Markdown Code Blocks ---
  const markdownRegex = /```(\w+)?\s*([\s\S]*?)```/g;
  remainingText = remainingText.replace(
    markdownRegex,
    (match, lang, content) => {
      const trimmedContent = content.trim();
      let detectedFileName = null;

      if (
        trimmedContent.includes('<!DOCTYPE html>') ||
        trimmedContent.includes('<html')
      ) {
        detectedFileName = 'index.html';
      }

      if (!detectedFileName) {
        const firstLine = trimmedContent.split('\n')[0].trim();
        const commentFileRegex =
          /^(?:\/\/|\/\*|#)?\s*([\w.-]+\.\w+)\s*(?:\*\/)?$/;
        const commentMatch = firstLine.match(commentFileRegex);
        if (commentMatch && commentMatch[1]) {
          detectedFileName = commentMatch[1];
        }
      }

      if (!detectedFileName) {
        detectedFileName = lang || 'unknown';
      }

      snippets.push({
        fileName: detectedFileName,
        lang: lang || 'text',
        content: trimmedContent,
        type: 'markdown_block',
      });

      return '';
    }
  );

  return {
    snippets: snippets,
    otherContent: remainingText.replace(/\n\s*\n/g, '\n').trim(),
  };
}

function parseAndSaveResponse(responseObj) {
  try {
    const extractedData = extractFileFromText(responseObj.responseResult);
    const { snippets, otherContent } = extractedData;
    const extractedFiles = [];

    snippets.forEach((snippet) => {
      if (snippet.fileName) {
        extractedFiles.push({
          ...snippet,
          outputName: `${responseObj.customId}_${responseObj.modelId}_${snippet.fileName}`,
        });
      }
    });

    if (extractedFiles.length === 0) {
      // console.warn optional to reduce noise during high concurrency
    }

    return {
      ...responseObj,
      extractedFiles: extractedFiles,
      conversationalText: otherContent,
    };
  } catch (error) {
    console.error('Error parsing response object:', error.message);
    return null;
  }
}

/**
 * Writes to DB immediately.
 * Sync operations are safe here as Node is single-threaded;
 * fs.writeFileSync acts as a natural mutex for file access.
 */
function writeToDbImmediate(newItem) {
  let existingData = [];

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileContent = fs.readFileSync(DB_PATH, 'utf8');
      const jsonContent = fileContent
        .replace('export const db = ', '')
        .replace(/;$/, '');
      existingData = JSON.parse(jsonContent);
    } catch (err) {
      console.warn(`Could not parse existing db.js. Starting fresh.`);
    }
  }

  existingData.push(newItem);
  const dbContent = `export const db = ${JSON.stringify(
    existingData,
    null,
    2
  )};`;

  try {
    fs.writeFileSync(DB_PATH, dbContent, 'utf8');
    // Log less frequently or use shorter logs to avoid console flooding
    // console.log(`[Saved] ${newItem.customId} | ${newItem.modelId} (#${newItem.iterationIndex})`);
  } catch (err) {
    console.error(`Error writing to db.js:`, err.message);
  }
}

// --- Main Execution Logic ---

/**
 * Runs models in parallel.
 * Each model manages its own queue of tasks with strict concurrency limits.
 */
async function runBatch(models, metadataItems) {
  console.log(
    `🚀 Starting batch: ${models.length} models, ${metadataItems.length} items, ${ITERATIONS_PER_PROMPT} iterations each.`
  );
  console.log(`⚡ Max concurrency per model: ${MAX_CONCURRENCY_PER_MODEL}`);

  // Map Model To Standalone Async Chain
  const modelQueues = models.map(async (modelConfig) => {
    console.log(`🏁 [Start] Queue for Model: ${modelConfig.id}`);

    // Create a concurrency limiter for this specific model
    const limit = pLimit(MAX_CONCURRENCY_PER_MODEL);
    const tasks = [];

    // Create tasks for every item X every iteration
    for (const item of metadataItems) {
      for (let i = 1; i <= ITERATIONS_PER_PROMPT; i++) {
        // Wrap the task in the limiter
        const task = limit(async () => {
          try {
            // 1. Generate Response
            const response = await modelConfig.generate(item.promptText);
            const resultText = modelConfig.extract(response);
            const usageMetadata =
              response.usageMetadata || response.usage || null;

            // 2. Destructure Inputs
            const { promptText, ...rest } = item;

            const rawResult = {
              ...rest,
              inputPrompt: promptText,
              responseResult: resultText,
              modelId: modelConfig.id,
              usageMetadata,
              iterationIndex: i, // Track which iteration this is
            };

            // 3. Parse Response
            const parsedResult = parseAndSaveResponse(rawResult);

            if (parsedResult) {
              // 4. Write To DB (Sync)
              writeToDbImmediate(parsedResult);
              process.stdout.write('.'); // Simple progress indicator
              return parsedResult;
            }
          } catch (error) {
            console.error(
              `\n❌ [Error] ${modelConfig.id} | ${item.customId} (#${i}):`,
              error.message
            );
            return null;
          }
        });

        tasks.push(task);
      }
    }

    // Wait for all tasks for this model to complete
    const modelResults = await Promise.all(tasks);
    console.log(`\n✅ [Complete] Queue for Model: ${modelConfig.id} finished.`);

    // Filter out nulls (errors)
    return modelResults.filter(Boolean);
  });

  // Wait for all model queues to finish
  const allResults = await Promise.all(modelQueues);
  return allResults.flat();
}

// --- Script Entry Point ---

// 1. Select the first 10 clients
const targetClients = parseValueResults.slice(0, 10);

// 2. Generate tasks (metadata) for each of the 10 clients
const clientMetadata = targetClients.flatMap((client) =>
  generateValueMetadataRealtime(client)
);

console.log(
  `Generated ${clientMetadata.length} unique prompts. Total requests will be ${
    clientMetadata.length * ITERATIONS_PER_PROMPT * modelConfigs.length
  }.`
);

// 3. Run Batch
await runBatch(modelConfigs, clientMetadata);

console.log(`\n🎉 All batch processing complete.`);
