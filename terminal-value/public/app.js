/**
 * Fetches the list of all batch jobs from the backend API
 * and populates the results table.
 */
async function fetchJobs() {
  const tbody = document.getElementById('jobsTableBody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  try {
    const res = await fetch('/api/jobs');
    const jobs = await res.json();

    tbody.innerHTML = jobs
      .map(
        (job) => {
          const isSucceeded = job.status === 'SUCCEEDED' && job.outputFile;

          // Extract the file ID from the output path if it exists
          const fileId = isSucceeded ? job.outputFile.split('/').pop() : null;
          
          const idDisplay = isSucceeded 
            ? `<a href="#" onclick="viewResults('${fileId}')">${job.id}</a>`
            : job.id;

          return `
            <tr>
              <td class="status-${job.status}">${job.status}</td>
              <td>${idDisplay}</td>
              <td>${job.created}</td>
              <td>${job.model}</td>
            </tr>
          `;
        }
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:red">Error loading jobs</td></tr>`;
  }
}

/**
 * Submits a new prompt to the backend to initiate a Gemini batch job.
 */
async function createJob() {
  const input = document.getElementById('promptInput');
  const prompt = input.value.trim();
  if (!prompt) return alert('Please enter a prompt');

  const btn = document.querySelector('button[onclick="createJob()"]');
  btn.disabled = true;
  btn.innerText = 'Creating...';

  try {
    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (res.ok) {
      input.value = '';
      fetchJobs(); // Refresh table immediately
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (error) {
    alert('Failed to create job');
  } finally {
    btn.disabled = false;
    btn.innerText = 'Create Batch Job';
  }
}

/**
 * Fetches and displays the content of a succeeded batch job's output file.
 */
async function viewResults(fileId) {
  try {
    const res = await fetch(`/api/jobs/results/${fileId}`);
    const data = await res.json();

    console.log(data);
    
    // Using a standard alert for results per the previous requirement
    alert("Job Results:\n" + JSON.stringify(data, null, 2));
  } catch (err) {
    alert("Failed to fetch results.");
  }
}

// Initialize the job list on page load
fetchJobs();