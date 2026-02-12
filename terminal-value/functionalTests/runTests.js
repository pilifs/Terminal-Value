import { testGenerateValue } from './integrationTests.js';

const passed = testGenerateValue();

if (passed) {
  console.log('pass');
  process.exit(0);
} else {
  console.log('fail');
  process.exit(1);
}
