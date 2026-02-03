import { getAllJobs, getJobResults, createBatchJob, inspectJob, recoverBatchResult } from './geminiBatchService.js';

const command = process.argv[2];
const input = process.argv[3];

async function main() {
  switch (command) {
    case 'prompt':
      const job = await createBatchJob(input);
      console.log(job);
      break;
    
    case 'list':
      const list = await getAllJobs();
      console.log(list);
      break;
    
    case 'details':
      const details = await getJobResults(`files/batch-${input}`);
      console.log(details.json(details));
      break;

    case 'recover':
      const recover = await recoverBatchResult(`files/batch-${input}`);
      console.log(details.json(recover));
      break;

    case 'inspect':
      const inspect = await inspectJob(input);
      console.log(JSON.stringify(inspect, null, 2));
      console.log(inspect);
      break;
  }
}

main();
