const fs = require('fs');
const path = require('path');
// UPDATED: Point to ../apps/gemini-batch/skiShopResults.js
const { results } = require('../apps/gemini-batch/skiShopResults.js');

/**
 * Extracts JS code from LLM parts and saves them as web component files.
 * Organizes files into folders based on valueInputHash.
 */
function saveDynamicComponents(results) {
  console.log('📂 Starting Component Generation...');

  Object.keys(results).forEach((key) => {
    const job = results[key];

    // Guard: Only process successful jobs with results
    if (job.status !== 'SUCCEEDED') return;
    if (!job.fileOutputResult || job.fileOutputResult.length === 0) return;

    try {
      const { clientId, pageType, valueInputHash } = job;

      // Use 'legacy' folder if no hash was recorded for the job
      const versionFolder = valueInputHash || 'legacy';

      // Determine directories
      const componentType =
        pageType.charAt(0).toUpperCase() + pageType.slice(1); // Home or Order
      const fileName = `${pageType}Page-${clientId}.js`;

      // UPDATED: Path: ../apps/example-ski-shop/public/components/dynamic{Type}/{hash}/
      const baseDir = path.join(
        __dirname,
        '../apps',
        'example-ski-shop',
        'public',
        'components',
        `dynamic${componentType}`
      );
      const targetDir = path.join(baseDir, versionFolder);
      const filePath = path.join(targetDir, fileName);

      // Access parts[1].text
      const candidates = job.fileOutputResult[0].response.candidates;
      const parts = candidates[0].content
        ? candidates[0].content.parts
        : candidates[0].parts;
      const rawText = parts[0] ? parts[0].text : '';

      if (!rawText) {
        console.warn(`⚠️ No text in parts for ${clientId} (Batch: ${key})`);
        return;
      }

      // Regex to extract code block
      const codeBlockRegex = /```javascript\n([\s\S]*?)```/;
      const match = rawText.match(codeBlockRegex);

      if (match && match[1]) {
        const cleanCode = match[1].trim();

        // Ensure target directory exists (including hash folder)
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true });
        }

        // Write file (overwrite is allowed here as hashes imply unique versions)
        fs.writeFileSync(filePath, cleanCode, 'utf8');
        console.log(
          `✅ Saved: dynamic${componentType}/${versionFolder}/${fileName}`
        );
      } else {
        console.warn(`⚠️ No JS block found for ${clientId}`);
      }
    } catch (err) {
      console.error(`❌ Error processing ${key}:`, err.message);
    }
  });
  console.log('🎉 Generation Complete.');
}

// Run the generator
saveDynamicComponents(results);
