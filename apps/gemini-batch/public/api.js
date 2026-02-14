/**
 * Fetches the list of all batch jobs from the backend.
 * @returns {Promise<Array>} List of job objects
 */
export async function getJobsList() {
  const res = await fetch('/api/jobs');
  if (!res.ok) throw new Error('Failed to fetch jobs list');
  return res.json();
}

/**
 * Submits a new prompt to create a batch job.
 */
export async function submitBatchJob(prompt) {
  return fetch('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
}

/**
 * Fetches the results for a specific output file.
 */
export async function getJobResults(fileId) {
  const res = await fetch(`/api/jobs/results/${fileId}`);
  if (!res.ok) throw new Error("Failed to fetch results");
  return res.json();
}

/**
 * Fetches the input prompt for a specific job.
 */
export async function getJobInput(jobId) {
  const res = await fetch(`/api/jobs/${jobId}/input`);
  if (res.status === 404) return null; // Handle missing local file gracefully
  if (!res.ok) throw new Error("Failed to fetch input");
  return res.json();
}