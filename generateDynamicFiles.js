const fs = require('fs');
const path = require('path');
const { results } = require('./terminal-value/gemini-batch/skiShopResults.js');

/**
 * Iterates through LLM batch results and generates standalone JS files
 * for dynamic web components.
 */
function generateDynamicFiles(results) {
  Object.keys(results).forEach((key) => {
    const job = results[key];

    // Guard: Only process successful jobs
    if (job.status !== 'SUCCEEDED') return;

    // Guard: Skip if fileOutputResult does not exist
    if (!job.fileOutputResult || !job.fileOutputResult.length) return;

    try {
      const clientId = job.clientId; // e.g., 'CLIENT-004'
      const type = job.pageType; // e.g., 'home' or 'order'

      // Determine componentType (capitalized for folder) and specific filename
      const componentType = type.charAt(0).toUpperCase() + type.slice(1);
      const fileName = `${type}Page-${clientId}.js`;

      // Construct the absolute path
      const dirPath = path.join(
        __dirname,
        'examples',
        'ski-shop',
        'public',
        'components',
        `dynamic${componentType}`
      );
      const filePath = path.join(dirPath, fileName);

      // Guard: Do not overwrite if file already exists
      if (fs.existsSync(filePath)) {
        console.log(`Skipped existing file: ${fileName}`);
        return;
      }

      // Extract parts[1].text as requested
      // Path: fileOutputResult[0].response.candidates[0].content.parts[1].text
      const output = job.fileOutputResult[0].response.candidates[0];
      const parts = output.content ? output.content.parts : output.parts; // Handle variations in structure

      if (!parts || !parts[0]) {
        console.warn(`No content found in parts[0] for job ${key}`);
        return;
      }

      let rawText = parts[0].text;

      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      /**
       * Regex Logic:
       * Matches everything between ```javascript and ```
       * s flag allows . to match newlines
       */
      const codeBlockRegex = /```javascript\n([\s\S]*?)```/;
      const match = rawText.match(codeBlockRegex);

      if (match && match[1]) {
        const cleanCode = match[1].trim();

        // Ensure directory exists
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        fs.writeFileSync(filePath, cleanCode, 'utf8');
        console.log(`Successfully generated: ${filePath}`);
      } else {
        console.warn(
          `Could not find a javascript code block in parts[1] for ${clientId}`
        );
      }
    } catch (err) {
      console.error(`Error processing job ${key}:`, err.message);
    }
  });
}

// Execute the helper
generateDynamicFiles(results);
