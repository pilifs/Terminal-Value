import { generateValueResults } from './memoizedResults/generateValueResults.js';
import { parseValueResults } from './memoizedResults/parseValueResults.js';
import generateValue from './generateValue.js';

/**
 * Tests the generateValue function by comparing its output
 * against the expected memoized results.
 * @returns {boolean} True if test passes, False otherwise.
 */
export function testGenerateValue() {
  console.log('Running test: testGenerateValue');

  try {
    const actual = generateValue(parseValueResults);
    const expected = generateValueResults;

    // Basic Deep Equality Check using JSON serialization
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr === expectedStr) {
      console.log(
        '✅ PASS: Output matches ./memoizedResults/generateValueResults.js'
      );
      return true;
    } else {
      console.error('❌ FAIL: Output does not match expected results.');

      // Basic debugging info
      console.log(`Expected items: ${expected.length}`);
      console.log(`Actual items: ${actual.length}`);

      if (actual.length === expected.length) {
        for (let i = 0; i < actual.length; i++) {
          if (JSON.stringify(actual[i]) !== JSON.stringify(expected[i])) {
            console.log(
              `Mismatch found at index ${i} (ClientId: ${actual[i].clientId})`
            );
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
