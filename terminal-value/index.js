import { getAllJobs, getBatchResults, createBatchJob, getJob, getRawJob } from './geminiBatchService.js';

// Sample completed job ID for smoke testing: maipmv7s3fmn90r7o86seuhw7dsyap1mwoym

const testPrompt = "This is a test prompt. What do you say Gemini? Give me something I can render in my app with Markdown that doesn't cost me too much to run :)"

const command = process.argv[2];
// const command = 'input'
const input = process.argv[3];

async function main() {
  switch (command) {
    case 'createbatch':
      const job = await createBatchJob(testPrompt);
      console.log(job);
      break;
    
    case 'job':
      const jobDetails = await getJob(input);
      console.log(jobDetails);
      break;

    case 'rawjob':
      console.log(rawJob);
      break;
    
    // case 'input':
    //   const inputFile = await getInputFile(`maipmv7s3fmn90r7o86seuhw7dsyap1mwoym`);
    //   console.log(inputFile);
    //   break;
    
    case 'list':
      const list = await getAllJobs();
      console.log(list);
      break;
    
    case 'results':
      const details = await getBatchResults(`batch-${input}`);
      console.log(details);
      break;
  }
}

main();
