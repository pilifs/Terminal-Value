import fs from 'fs';
import path from 'path';

/**
 * Extracts generated view code into a folder structure organized by File Hash.
 * * Directory Structure:
 * ./outputDir/
 * └── {fullFileHash}/
 * ├── homePage-{clientId}.js    <-- The component code
 * └── homePage-{clientId}.md    <-- The strategic explanation
 * * @param {Object} finalViews - The map returned by generateFinalDynamicViews
 * @param {String} outputDir - The root directory to save files (default: './views')
 */
export function extractViewsToFolder(finalViews, outputDir = './views') {
  // Ensure the output root exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  Object.values(finalViews).forEach((view) => {
    const { metadata, content } = view;

    // 1. Create Directory using the Full File Hash
    // This groups all clients sharing the exact same generated code version
    const hashDir = path.join(outputDir, metadata.fileHash);

    if (!fs.existsSync(hashDir)) {
      fs.mkdirSync(hashDir, { recursive: true });
    }

    // 2. Construct Filename
    // Logic: maps 'home' -> 'homePage', 'order' -> 'orderPage'
    // Result: homePage-CLIENT-010.js
    const pagePrefix =
      metadata.pageType === 'home'
        ? 'homePage'
        : metadata.pageType === 'order'
        ? 'orderPage'
        : `${metadata.pageType}Page`;

    const baseName = `${pagePrefix}-${metadata.clientId}`;

    // 3. Write Component Code (.js)
    if (content.code) {
      const jsPath = path.join(hashDir, `${baseName}.js`);
      fs.writeFileSync(jsPath, content.code, 'utf8');
      console.log(`Saved: ${jsPath}`);
    }

    // 4. Write Strategy (.md)
    // Saved alongside the code for easy reference to the "why" behind the code
    if (content.strategy) {
      const mdPath = path.join(hashDir, `${baseName}.md`);
      const strategyContent = [
        `# Strategy for ${metadata.nickname} (${metadata.clientId})`,
        `**Model:** ${metadata.model}`,
        `**Prompt ID:** ${metadata.promptId || 'N/A'}`,
        `**Generated At:** ${metadata.generatedAt}`,
        `---`,
        content.strategy,
      ].join('\n\n');

      fs.writeFileSync(mdPath, strategyContent, 'utf8');
    }
  });

  console.log(`Extraction complete. Views organized by hash in: ${outputDir}`);
}
