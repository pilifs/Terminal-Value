import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';
import Together from 'together-ai';

// Keep existing local imports (ensure these files exist relative to this script)
import { generateValueMetadataRealtime } from './coreServices.js';
import { parseValueResults } from './functionalTests/fixedMocks/parseValueResults.js';

// --- Configuration & Setup ---

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.js');

// Initialize clients
const together = new Together(); // Requires process.env.TOGETHER_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define the list of models with their specific strategies
const modelConfigs = [
  {
    id: 'gemini-3-pro-preview',
    generate: async (prompt) => {
      return await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
      });
    },
    extract: (response) => {
      return response.candidates?.[0]?.content?.parts?.[0]?.text;
    },
  },
  {
    id: 'gemini-3-flash-preview',
    generate: async (prompt) => {
      return await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
    },
    extract: (response) => {
      return response.candidates?.[0]?.content?.parts?.[0]?.text;
    },
  },
  {
    id: 'gemini-2-flash',
    generate: async (prompt) => {
      return await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
    },
    extract: (response) => {
      return response.candidates?.[0]?.content?.parts?.[0]?.text;
    },
  },
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

// --- Helper Functions (File System) ---

/**
 * parses the AI response to separate file content, code snippets, and conversational text.
 * * Logic:
 * 1. Prioritizes explicit <file name="..."> tags.
 * 2. Fallbacks to Markdown code blocks.
 * 3. Identifies "index.html" automatically if raw HTML tags are found.
 * 4. Scans Markdown blocks for filenames in comments (e.g. "// app.js").
 * 5. Fallback: Uses the markdown language tag as the filename (e.g. "javascript"), or "unknown".
 * 6. Aggregates all remaining text into 'otherContent'.
 * * @param {string} text - The raw response string from the AI.
 * @returns {object} - { snippets: [], otherContent: string }
 */
function extractFileFromText(text) {
  if (!text) return { snippets: [], otherContent: '' };

  let remainingText = text;
  const snippets = [];

  // --- PASS 1: Explicit <file> Tags ---
  // Matches <file name="example.js">content</file>
  const fileTagRegex = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;

  remainingText = remainingText.replace(
    fileTagRegex,
    (match, fileName, content) => {
      // Add directly to snippets
      snippets.push({
        fileName,
        content: content.trim(),
        type: 'xml_tag',
        lang: fileName.split('.').pop() || 'text',
      });
      return ''; // Remove code from conversational text
    }
  );

  // --- PASS 2: Markdown Code Blocks ---
  // Matches ```javascript ... ```
  const markdownRegex = /```(\w+)?\s*([\s\S]*?)```/g;

  remainingText = remainingText.replace(
    markdownRegex,
    (match, lang, content) => {
      const trimmedContent = content.trim();
      let detectedFileName = null;

      // Heuristic A: Is this an implicit index.html?
      if (
        trimmedContent.includes('<!DOCTYPE html>') ||
        trimmedContent.includes('<html')
      ) {
        detectedFileName = 'index.html';
      }

      // Heuristic B: Look for filename in first-line comments
      if (!detectedFileName) {
        const firstLine = trimmedContent.split('\n')[0].trim();
        // Matches start, optional comment chars, whitespace, filename.ext, optional end comment
        const commentFileRegex =
          /^(?:\/\/|\/\*|#)?\s*([\w.-]+\.\w+)\s*(?:\*\/)?$/;
        const commentMatch = firstLine.match(commentFileRegex);

        if (commentMatch && commentMatch[1]) {
          detectedFileName = commentMatch[1];
        }
      }

      // --- NEW LOGIC START ---
      // Fallback: Use lang or 'unknown' if no specific filename found
      if (!detectedFileName) {
        detectedFileName = lang || 'unknown';
      }
      // --- NEW LOGIC END ---

      // Add to snippets
      snippets.push({
        fileName: detectedFileName,
        lang: lang || 'text',
        content: trimmedContent,
        type: 'markdown_block',
      });

      return ''; // Remove code from conversational text
    }
  );

  return {
    snippets: snippets,
    otherContent: remainingText.replace(/\n\s*\n/g, '\n').trim(),
  };
}

/**
 * Parses the AI response and extracts files/snippets without writing to disk.
 * @param {object} responseObj - The response object containing responseResult, modelId, etc.
 * @returns {object|null} - The augmented response object or null on error.
 */
function parseAndSaveResponse(responseObj) {
  try {
    // 1. Extract content using our updated logic
    const extractedData = extractFileFromText(responseObj.responseResult);
    const { snippets, otherContent } = extractedData;

    // 2. Prepare a list of files that *would* be saved (for metadata/DB purposes)
    const extractedFiles = [];

    snippets.forEach((snippet) => {
      if (snippet.fileName) {
        extractedFiles.push({
          ...snippet,
          // Generate unique name for reference
          outputName: `${responseObj.customId}_${responseObj.modelId}_${snippet.fileName}`,
        });
      }
    });

    if (extractedFiles.length === 0) {
      console.warn(
        `No valid files found in response for ${responseObj.modelId} (Client: ${responseObj.customId}).`
      );
    }

    // 3. Return augmented response
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
 * Reads the current DB, checks for duplicates, and appends the new item.
 * Writes back to disk immediately.
 */
function writeToDbImmediate(newItem) {
  let existingData = [];

  // 1. Read existing DB
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

  // 2. Check for Duplicates
  const isDuplicate = existingData.some(
    (existingItem) =>
      existingItem.customId === newItem.customId &&
      existingItem.fileHash === newItem.fileHash &&
      existingItem.modelId === newItem.modelId &&
      existingItem.promptId === newItem.promptId
  );

  if (isDuplicate) {
    console.log(
      `Duplicate detected (${newItem.customId}/${newItem.modelId}), skipping save.`
    );
    return;
  }

  // 3. Append and Save
  existingData.push(newItem);
  const dbContent = `export const db = ${JSON.stringify(
    existingData,
    null,
    2
  )};`;

  try {
    fs.writeFileSync(DB_PATH, dbContent, 'utf8');
    console.log(
      `[Saved to DB] Client: ${newItem.customId} | Model: ${newItem.modelId}`
    );
  } catch (err) {
    console.error(`Error writing to db.js:`, err.message);
  }
}

// --- Main Execution Logic ---

/**
 * Runs models in parallel.
 * Each model processes the list of metadataItems sequentially within its own "thread" (Promise chain).
 * This allows fast models to finish all items without waiting for slow models.
 */
async function runBatch(models, metadataItems) {
  console.log(`🚀 Starting parallel execution for ${models.length} models...`);

  // Map Model To Standalone Async Chain
  const modelQueues = models.map(async (modelConfig) => {
    console.log(`🏁 [Start] Queue for Model: ${modelConfig.id}`);
    const modelResults = [];

    // Process Items Sequentially Per Model
    for (const item of metadataItems) {
      try {
        console.log(
          `   ⏳ [${modelConfig.id}] Processing Client: ${item.customId}...`
        );

        // 1. Generate Response
        const response = await modelConfig.generate(item.promptText);
        const resultText = modelConfig.extract(response);
        const usageMetadata = response.usageMetadata || response.usage || null;

        // 2. Destructure Inputs To Prepare Raw Result
        const { promptText, ...rest } = item;
        const rawResult = {
          ...rest,
          inputPrompt: promptText,
          responseResult: resultText,
          modelId: modelConfig.id,
          usageMetadata,
        };

        // 3. Parse Response
        const parsedResult = parseAndSaveResponse(rawResult);

        if (parsedResult) {
          // 4. Write To DB Immediately
          // Since writeToDbImmediate is synchronous (fs.writeFileSync),
          // it is safe to call from concurrent model promises without mutexes.
          writeToDbImmediate(parsedResult);
          modelResults.push(parsedResult);
        }
      } catch (error) {
        console.error(
          `❌ [Error] Model: ${modelConfig.id} | Client: ${item.customId}:`,
          error.message
        );
      }
    }

    console.log(`✅ [Complete] Queue for Model: ${modelConfig.id} finished.`);
    return modelResults;
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
  `Starting processing for ${clientMetadata.length} items (from ${targetClients.length} clients) across ${modelConfigs.length} models...`
);

// 3. Run Batch
// Note: We no longer need the 'throttle' flag as concurrency is handled per-model.
await runBatch(modelConfigs, clientMetadata);

console.log(`\n🎉 All batch processing complete.`);
