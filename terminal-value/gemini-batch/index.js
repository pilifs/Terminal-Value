import {
  getAllJobs,
  getBatchResults,
  createBatchJob,
  getJob,
  getRawJob,
  getJobInput,
  generateAllHomePageComponents,
  generateAllOrderPageComponents,
} from './geminiBatchService.js';

const command = process.argv[2];
const argument = process.argv[3];

async function main() {
  if (!command) {
    console.log(`
🤖 Gemini Batch Smoke Test CLI
=============================
Usage: node index.js <command> <argument>

Commands:
  list                  - List all batch jobs (summary)
  create "<prompt>"     - Create a new batch job with the given prompt
  job <jobId>           - Get details of a specific job (SDK method)
  rawjob <jobId>        - Get raw details of a specific job (REST API method)
  input <jobId>         - Get the input file content for a job (Locally stored)
  results <fileId>      - Get the output results for a specific file or job ID
  generate-home         - Generate Home Page components for all clients in mock data
`);
    return;
  }

  try {
    switch (command) {
      case 'list':
        console.log('🔄 Fetching all jobs...');
        const list = await getAllJobs();
        console.log(JSON.stringify(list, null, 2));
        break;

      case 'create':
        if (!argument)
          throw new Error('Prompt argument is required for "create"');
        console.log(`🚀 Creating job with prompt: "${argument}"...`);
        const newJob = await createBatchJob(argument);
        console.log('✅ Job Created:', JSON.stringify(newJob, null, 2));
        break;

      case 'job':
        if (!argument) throw new Error('Job ID is required for "job"');
        console.log(`🔍 Fetching SDK job details for: ${argument}...`);
        const jobDetails = await getJob(argument);
        console.log(JSON.stringify(jobDetails, null, 2));
        break;

      case 'rawjob':
        if (!argument) throw new Error('Job ID is required for "rawjob"');
        console.log(`🔍 Fetching REST API job details for: ${argument}...`);
        const rawJob = await getRawJob(argument);
        console.log(JSON.stringify(rawJob, null, 2));
        break;

      case 'input':
        if (!argument) throw new Error('Job ID is required for "input"');
        console.log(`Pb Fetching local input file for job: ${argument}...`);
        const inputContent = await getJobInput(argument);
        if (inputContent) {
          console.log(JSON.stringify(inputContent, null, 2));
        } else {
          console.log('⚠️ Input file not found locally.');
        }
        break;

      case 'results':
        if (!argument)
          throw new Error('File ID (or Job ID) is required for "results"');
        console.log(`⬇️ Fetching results for: ${argument}...`);
        const results = await getBatchResults(argument);
        console.log(JSON.stringify(results, null, 2));
        break;

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

      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Run "node index.js" without arguments to see usage.');
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

main();
