// npm run software-factory:refresh -- [--ref REF | --sha SHA] [--checkout PATH]
// npm run software-factory:validate
//
// Owned by the coordinator; the work is import.mjs's and validate.mjs's.

import { refresh } from './import.mjs';
import { DATA_DIR } from './index.mjs';
import { validateSnapshotDir } from './validate.mjs';
import fs from 'node:fs';
import path from 'node:path';

const [command, ...args] = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

if (command === 'validate') {
  if (!fs.existsSync(path.join(DATA_DIR, 'latest.json'))) {
    console.error('no snapshot in blog/software-factory/data/ yet: run npm run software-factory:refresh');
    process.exit(1);
  }
  const problems = validateSnapshotDir(DATA_DIR);
  for (const p of problems) console.error(`ERROR ${p}`);
  console.log(problems.length ? `${problems.length} problem(s)` : 'the committed snapshot is valid');
  process.exit(problems.length ? 1 : 0);
} else if (command === 'refresh') {
  const result = await refresh({ ref: opt('--ref'), sha: opt('--sha'), checkout: opt('--checkout'), dataDir: DATA_DIR });
  console.log(JSON.stringify(result));
  process.exit(result.outcome === 'failed' ? 1 : 0);
} else {
  console.error('usage: cli.mjs refresh [--ref REF | --sha SHA] [--checkout PATH] | validate');
  process.exit(2);
}
