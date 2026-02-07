// This is a temporary util that was used to migrate pre-hash results to include the hash of the value input.
// Leaving here for posterity, or in case any similar backfill is needed. Not intended for long term use.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Paths
const RESULTS_FILE_PATH = path.join(
  __dirname,
  'terminal-value/gemini-batch/skiShopResults.js'
);
const GENERATE_VALUE_PATH = path.join(
  __dirname,
  'examples/ski-shop/memoizedResults/generateValueResults.js'
);

function updateHash() {
  console.log('🔄 Starting Results Hash Backfill...');

  // 1. Calculate Hash of current generateValueResults.js
  if (!fs.existsSync(GENERATE_VALUE_PATH)) {
    console.error(
      '❌ Could not find generateValueResults.js at:',
      GENERATE_VALUE_PATH
    );
    return;
  }
  const valueContent = fs.readFileSync(GENERATE_VALUE_PATH, 'utf-8');
  const currentHash = crypto
    .createHash('sha256')
    .update(valueContent)
    .digest('hex');
  console.log(`🔑 Current Hash calculated: ${currentHash}`);

  // 2. Read existing results
  if (!fs.existsSync(RESULTS_FILE_PATH)) {
    console.error('❌ Could not find skiShopResults.js');
    return;
  }

  let results;
  try {
    const content = fs.readFileSync(RESULTS_FILE_PATH, 'utf-8');
    // Extract object literal safely
    let objectLiteral = content
      .replace(/^export\s+const\s+results\s*=\s*/, '')
      .replace(/;\s*$/, '');
    results = new Function('return ' + objectLiteral)();
  } catch (e) {
    console.error('❌ Error reading results file:', e);
    return;
  }

  // 3. Update entries
  let updateCount = 0;
  Object.keys(results).forEach((key) => {
    const record = results[key];
    if (!record.valueInputHash) {
      record.valueInputHash = currentHash;
      updateCount++;
    }
  });

  if (updateCount === 0) {
    console.log('✅ All records already have a hash. No changes made.');
    return;
  }

  // 4. Save back to file
  const fileContent = `export const results = ${JSON.stringify(
    results,
    null,
    2
  )};`;
  fs.writeFileSync(RESULTS_FILE_PATH, fileContent);
  console.log(
    `✅ Successfully updated ${updateCount} records with the current hash.`
  );
}

updateHash();
