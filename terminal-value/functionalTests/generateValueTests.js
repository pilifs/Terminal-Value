import generateValue from '../generateValue.js';
import { parseValueResults } from './fixedMocks/parseValueResults.js';
import { generateValueResults } from './fixedMocks/generateValueResults.js';

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

    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);

    if (actualStr === expectedStr) {
      console.log(
        '✅ PASS: Output matches ./memoizedResults/generateValueResults.js'
      );
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
