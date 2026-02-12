import { testGenerateValue } from './generateValueTests.js';
import { testParseValue } from './parseValueTests.js';

/**
 * Executes all functional tests for the project.
 * Exits with code 0 if all tests pass, 1 otherwise.
 */
const runTests = () => {
  console.log('--------------------------------------------------');
  console.log('Starting Functional Tests...');
  console.log('--------------------------------------------------');

  // Run tests sequentially
  const parsePassed = testParseValue();
  console.log('--------------------------------------------------');
  const generatePassed = testGenerateValue();
  console.log('--------------------------------------------------');

  if (parsePassed && generatePassed) {
    console.log('🎉 All tests passed');
    // process.exit(0);
  } else {
    console.error('❌ Some tests failed');
    process.exit(1);
  }
};

// Execute the runner
runTests();
