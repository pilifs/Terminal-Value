import { getAllJobs, getBatchResults, createBatchJob, getJob, getRawJob } from './geminiBatchService.js';

const command = process.argv[2];
const input = process.argv[3];

async function main() {
  switch (command) {
    case 'prompt':
      const job = await createBatchJob(input);
      console.log(job);
      break;
    
    case 'job':
      const jobDetails = await getJob(input);
      console.log(jobDetails);
      break;

    case 'rawjob':
      const rawJob = await getRawJob(`maipmv7s3fmn90r7o86seuhw7dsyap1mwoym`);
      console.log(rawJob);
      break;

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
