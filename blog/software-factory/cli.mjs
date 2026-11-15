// npm run software-factory:refresh -- [--ref REF | --sha SHA] [--checkout PATH]
// npm run software-factory:validate
// npm run software-factory:publish -- --destination preview|production [--ref REF | --sha SHA] [--checkout PATH]
//   with SOFTWARE_FACTORY_R2_ACCOUNT_ID, SOFTWARE_FACTORY_R2_ACCESS_KEY_ID and
//   SOFTWARE_FACTORY_R2_SECRET_ACCESS_KEY set (GITHUB_TOKEN optional, for the
//   compare API's rate limit). Prints the result as JSON, never a credential.
//
// Owned by the coordinator; the work is import.mjs's and validate.mjs's.

import { refresh } from './import.mjs';
import { DATA_DIR } from './index.mjs';
import { DESTINATIONS, credentialsFromEnv, publish, s3Store, sourceOrder } from './publish.mjs';
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
} else if (command === 'publish' && Object.hasOwn(DESTINATIONS, opt('--destination') ?? '')) {
  // Missing variables or a malformed account id stop it here, named, never a value.
  let store;
  try {
    store = s3Store({ ...credentialsFromEnv(), bucket: DESTINATIONS[opt('--destination')] });
  } catch (e) {
    console.error(`ERROR ${e.message}`);
    process.exit(1);
  }
  const checkout = opt('--checkout');
  const result = await publish({
    store,
    order: sourceOrder({ checkout, token: process.env.GITHUB_TOKEN }),
    ref: opt('--ref'),
    sha: opt('--sha'),
    checkout,
  });
  console.log(JSON.stringify({ destination: opt('--destination'), ...result }));
  process.exit(result.outcome === 'new-snapshot' || result.outcome === 'unchanged' ? 0 : 1);
} else {
  console.error('usage: cli.mjs refresh [--ref REF | --sha SHA] [--checkout PATH] | validate');
  console.error('       cli.mjs publish --destination preview|production [--ref REF | --sha SHA] [--checkout PATH]');
  process.exit(2);
}
