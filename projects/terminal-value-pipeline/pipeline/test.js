import { generateValueMetadataRealtime } from './coreServices.js';

import { parseValueResults } from './functionalTests/fixedMocks/parseValueResults.js';

const test = generateValueMetadataRealtime(parseValueResults[0]);

debugger;

test;
