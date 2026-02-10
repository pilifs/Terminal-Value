import {
  generateAllHomePageComponents,
  generateAllOrderPageComponents,
  verifyExternalConfidenceMethod,
  generateValueMetadata,
} from './coreServices.js';

const command = 'generate-metadata'; // process.argv[2];
const argument = process.argv[3];

async function main() {
  if (!command) {
    console.log(`
🤖 Terminal Value CLI
=====================
Usage: node index.js <command> <argument>

Commands:
  generate-home              - Generate Home Page components for all clients
  generate-order             - Generate Order Page components for all clients
  verify-external-confidence - Verify external confidence for generated components
  generate-metadata          - Generate metadata for batch jobs (no submission)
`);
    return;
  }

  try {
    switch (command) {
      case 'generate-home':
        console.log(
          '🚀 Initiating batch generation for Ski Shop Home Pages...'
        );
        await generateAllHomePageComponents();
        break;

      case 'generate-order':
        console.log(
          '🚀 Initiating batch generation for Ski Shop ORDER Pages...'
        );
        await generateAllOrderPageComponents();
        break;

      case 'verify-external-confidence':
        console.log(
          '🚀 Verifying external confidence for generated Home page components...'
        );
        await verifyExternalConfidenceMethod(argument);
        break;

      case 'generate-metadata':
        console.log('🚀 Generating metadata input into batch job');
        let metadata = generateValueMetadata();
        console.log('Metadata generation complete');
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
