import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Handles memoization of expensive function results to a file.
 * Checks input hash; returns cached data on hit, computes and saves on miss.
 * @param {Object} options
 * @param {string} options.filePath - Absolute path to the memoized results file.
 * @param {any} options.inputData - The data to hash (determines cache validity).
 * @param {Function} options.computeFn - The function to run if cache is missed.
 * @param {string} options.variableName - The variable name to use in the generated JS file.
 * @param {boolean} [options.useDefaultExport=false] - Whether to include 'export default varName'.
 * @returns {any} The computed or cached data.
 */
export function getMemoizedResult({
  filePath,
  inputData,
  computeFn,
  variableName,
  useDefaultExport = false,
}) {
  // 1. Compute Hash of Input
  const currentHash = crypto
    .createHash('sha256')
    .update(JSON.stringify(inputData))
    .digest('hex');
  const fileName = path.basename(filePath);

  // 2. Try to Retrieve Memoized Result
  try {
    if (fs.existsSync(filePath)) {
      let fileContent = fs.readFileSync(filePath, 'utf-8');

      const hashMatch = fileContent.match(
        /export const inputHash = '([a-f0-9]+)';/
      );
      const storedHash = hashMatch ? hashMatch[1] : null;

      if (storedHash === currentHash) {
        console.log(
          `⚡ ${variableName}: Cache Hit. Returning memoized results.`
        );

        // Clean up file content to extract JSON
        // 1. Remove hash line
        fileContent = fileContent.replace(
          /export const inputHash = '([a-f0-9]+)';/,
          ''
        );

        // 2. Remove variable declaration (matches "export const x =" or "const x =")
        const declRegex = new RegExp(
          `(export\\s+)?const\\s+${variableName}\\s+=\\s+`
        );
        fileContent = fileContent.replace(declRegex, '');

        // 3. Remove export default if used
        if (useDefaultExport) {
          const exportRegex = new RegExp(
            `export\\s+default\\s+${variableName};`
          );
          fileContent = fileContent.replace(exportRegex, '');
        }

        // 4. Remove trailing semicolon and whitespace
        fileContent = fileContent.replace(/;\s*$/, '').trim();

        return JSON.parse(fileContent);
      }
    }
  } catch (err) {
    console.warn(`⚠️ ${variableName}: Error reading cache, re-computing.`, err);
  }

  console.log(`🔄 ${variableName}: Cache Miss. Computing new results...`);

  // 3. Compute Logic
  const results = computeFn();

  // 4. Write Memoized Result to File
  let outputFileContent = `export const inputHash = '${currentHash}';\n\n`;

  if (useDefaultExport) {
    // Format: const var = ...; export default var;
    outputFileContent += `const ${variableName} = ${JSON.stringify(
      results,
      null,
      2
    )};\n\n`;
    outputFileContent += `export default ${variableName};`;
  } else {
    // Format: export const var = ...;
    outputFileContent += `export const ${variableName} = ${JSON.stringify(
      results,
      null,
      2
    )};`;
  }

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, outputFileContent);
    console.log(`✅ ${variableName}: Results cached to ${fileName}.`);
  } catch (err) {
    console.error(`❌ ${variableName}: Failed to write cache.`, err);
  }

  return results;
}
