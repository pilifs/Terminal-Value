import { testParseValue } from './parseValueTests.js';
import { testGenerateValue } from './generateValueTests.js';

const runUpdate = () => {
  console.log('--------------------------------------------------');
  console.log('🔄 Updating Functional Test Data...');
  console.log('--------------------------------------------------');

  try {
    // 1. Run parseValue logic and write to fixedMocks/parseValueResults.js
    // We capture the fresh result to pass immediately to the next step
    const freshParseResults = testParseValue(true);

    // 2. Run generateValue logic using the FRESH parse results
    // and write to fixedMocks/generateValueResults.js
    testGenerateValue(true, freshParseResults);

    console.log('--------------------------------------------------');
    console.log('🎉 Successfully updated all functional test data mocks.');
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('❌ Failed to update test data.');
    console.error(err);
    process.exit(1);
  }
};

runUpdate();
