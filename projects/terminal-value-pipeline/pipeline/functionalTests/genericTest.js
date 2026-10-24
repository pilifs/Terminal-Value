import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import generateValue from '../generateValue.js';

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tests the generateValue function by comparing its output
 * against the expected memoized results.
 * * @param {Object} config - Configuration options.
 * @param {boolean} [config.writeResults=false] - If true, writes actual output to mock file instead of testing.
 * @param {Array} [config.inputData=null] - Optional raw input data to use instead of importing a file.
 * @param {string} [config.inputPath='./fixedMocks/parseValueResults.js'] - Path to the input mock file.
 * @param {string} [config.expectedPath='./fixedMocks/generateValueResults.js'] - Path to the expected output mock file.
 * @returns {Promise<boolean|Array>} True/False for test status, or the actual data object if writing.
 */
export async function genericTest(config = {}) {
  // Merge defaults with provided config
  const {
    writeResults = false,
    inputData = null,
    inputPath = './fixedMocks/db.js',
    expectedPath = './fixedMocks/batchJobMetadata.js',
  } = config;

  console.log('Running test: testGenerateValue');

  try {
    // --- LOAD INPUT ---
    // Use injected input data if available, otherwise dynamically import the mock file
    let sourceData = inputData;
    if (!sourceData) {
      try {
        const resolvedInputPath = path.resolve(__dirname, inputPath);
        const inputModule = await import(resolvedInputPath);
        // Handle named exports or default exports
        sourceData = inputModule.default || Object.values(inputModule)[0];
      } catch (err) {
        console.error(`❌ Failed to load input file: ${inputPath}`);
        throw err;
      }
    }

    // Execute the function under test
    const actual = generateValue(sourceData);

    // --- UPDATE MODE ---
    if (writeResults) {
      const resolvedOutputPath = path.resolve(__dirname, expectedPath);

      // Determine a safe variable name from the filename (e.g., 'myResults.js' -> 'myResults')
      const fileName = path.basename(
        resolvedOutputPath,
        path.extname(resolvedOutputPath)
      );
      const variableName = fileName.replace(/[^a-zA-Z0-9_$]/g, '_');

      const fileContent = `export const ${variableName} = ${JSON.stringify(
        actual,
        null,
        2
      )};\n`;

      fs.writeFileSync(resolvedOutputPath, fileContent, 'utf8');
      console.log(`✅ Updated mock file: ${resolvedOutputPath}`);
      return actual;
    }

    // --- TEST MODE ---
    let expected;
    try {
      const resolvedExpectedPath = path.resolve(__dirname, expectedPath);
      const expectedModule = await import(resolvedExpectedPath);
      // Handle named exports or default exports
      expected = expectedModule.default || Object.values(expectedModule)[0];
    } catch (err) {
      console.error(`❌ Failed to load expected output file: ${expectedPath}`);
      throw err;
    }

    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr === expectedStr) {
      console.log(`✅ PASS: Output matches ${expectedPath}`);
      return true;
    } else {
      console.error('❌ FAIL: Output does not match expected results.');

      // Iterate up to the length of the longer array to catch all edge cases
      const limit = Math.max(actual.length, expected.length);

      for (let i = 0; i < limit; i++) {
        const actItem = actual[i];
        const expItem = expected[i];

        // Case 1: Length Mismatch (Actual has extra items)
        if (!expItem) {
          console.log(`\n⚠️ Length Mismatch at index ${i}:`);
          console.log(`Expected array ended. Actual array has extra item:`);
          console.log(JSON.stringify(actItem, null, 2));
          break;
        }

        // Case 2: Length Mismatch (Actual is missing items)
        if (!actItem) {
          console.log(`\n⚠️ Length Mismatch at index ${i}:`);
          console.log(`Actual array ended. Expected array has extra item:`);
          console.log(JSON.stringify(expItem, null, 2));
          break;
        }

        // Case 3: Content Mismatch
        if (JSON.stringify(actItem) !== JSON.stringify(expItem)) {
          console.log(`\nDATA MISMATCH at index ${i}:`);
          console.log(`(ClientId: ${actItem.clientId || 'N/A'})`);

          console.log('\n--- EXPECTED ---');
          console.log(JSON.stringify(expItem, null, 2));

          console.log('\n--- ACTUAL ---');
          console.log(JSON.stringify(actItem, null, 2));

          // Stop at the first error to avoid console flooding
          break;
        }
      }
      return false;
    }
  } catch (err) {
    console.error('❌ ERROR: An unexpected error occurred during testing.');
    console.error(err);
    return false;
  }
}
