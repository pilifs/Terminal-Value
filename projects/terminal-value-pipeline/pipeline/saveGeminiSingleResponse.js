import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parses and saves the Gemini response object to be served from Worker.
 * @param {Object} responseObj - The response object structure from the API.
 * @returns {Object|null} An object with { fileName, content } or null if invalid.
 */
function parseAndSaveResponse(responseObj) {
  try {
    const fileData = extractFileFromText(responseObj.promptText);

    if (!fileData) {
      console.warn('⚠️ No <file> tags found in the generated text.');
      return null;
    }

    saveFile(fileData);

    return {
      ...responseObj,
    };
  } catch (error) {
    console.error('❌ Error parsing response object:', error.message);
    return null;
  }
}

/**
 * Extracts file name and content from a raw text string using XML-like tags.
 * @param {string} text - The raw string containing <file name="...">...</file> tags.
 * @returns {Object|null} An object with { fileName, content } or null if no match found.
 */
function extractFileFromText(text) {
  // Regex to capture the filename attribute and the content between tags
  const regex = /<file name="([^"]+)">([\s\S]*?)<\/file>/;
  const match = text.match(regex);

  if (!match) {
    return null;
  }

  return {
    fileName: match[1],
    content: match[2].trim(), // Remove leading/trailing whitespace/newlines
  };
}

/**
 * Writes text content to a specific file in the current directory.
 * @param {string} fileName - The output file name.
 * @param {string} content - The file content.
 */
function saveFile({ fileName, content }) {
  try {
    const outputPath = path.join(__dirname, fileName);
    fs.writeFileSync(outputPath, content, 'utf8');

    console.log(`✅ Successfully wrote to disk.`);
    console.log(`📄 File: ${fileName}`);
    console.log(`📍 Path: ${outputPath}`);
  } catch (error) {
    console.error(`❌ Error writing file ${fileName}:`, error.message);
  }
}

export default parseAndSaveResponse;
