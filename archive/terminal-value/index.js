import {
  executeValueChain,
  verifyExternalConfidenceMethod,
} from './coreServices.js';

const command = 'execute'; // process.argv[2];
const argument = process.argv[3];

async function main() {
  if (!command) {
    console.log(`
🤖 Terminal Value CLI
=====================
Usage: node index.js <command> <argument>

Commands:
  execute                    - Execute value chain and submit all requests to Gemini Batch API
  verify-external-confidence - Verify external confidence for generated components
`);
    return;
  }

  try {
    switch (command) {
      case 'execute':
        console.log('🚀 Executing value chain to generate code via LLM...');
        await executeValueChain();
        break;

      case 'verify-external-confidence':
        console.log(
          '🚀 Verifying external confidence for generated Home page components...'
        );
        await verifyExternalConfidenceMethod(argument);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "node index.js" without arguments to see usage.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

main();
