import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import parseValue from '../parseValue.js';
import db from './fixedMocks/db.js';
import { parseValueResults } from './fixedMocks/parseValueResults.js';

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Tests the parseValue function by comparing its output
 * against the expected fixed mock results.
 * @param {boolean} writeResults - If true, writes actual output to mock file instead of testing.
 * @returns {boolean|Array} True/False for test status, or the actual data object if writing.
 */
export function testParseValue(writeResults = false) {
  console.log('Running test: testParseValue');

  try {
    const actual = parseValue(db);

    // --- UPDATE MODE ---
    if (writeResults) {
      const outputPath = path.join(
        __dirname,
        'fixedMocks/parseValueResults.js'
      );
      const fileContent = `export const parseValueResults = ${JSON.stringify(
        actual,
        null,
        2
      )};\n`;

      fs.writeFileSync(outputPath, fileContent, 'utf8');
      console.log(`✅ Updated mock file: ${outputPath}`);
      return actual;
    }

    // --- TEST MODE ---
    const expected = parseValueResults;

    // Basic Deep Equality Check using JSON serialization
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr === expectedStr) {
      console.log('✅ PASS: Output matches ./fixedMocks/parseValueResults.js');
      return true;
    } else {
      console.error('❌ FAIL: Output does not match expected results.');

      // Basic debugging info
      console.log(`Expected items: ${expected.length}`);
      console.log(`Actual items: ${actual.length}`);

      if (actual.length === expected.length) {
        for (let i = 0; i < actual.length; i++) {
          if (JSON.stringify(actual[i]) !== JSON.stringify(expected[i])) {
            // Note: parseValue output structure has ID nested in profile
            const id = actual[i].profile ? actual[i].profile.id : 'Unknown';
            console.log(`Mismatch found at index ${i} (ClientId: ${id})`);
          }
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
