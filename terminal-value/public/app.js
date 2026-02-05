import { getJobsList, submitBatchJob, getJobResults } from './api.js';

/**
 * Fetches the list of all batch jobs and populates the results table.
 * Attached to window to support HTML onclick attributes.
 */
window.fetchJobs = async function() {
  const tbody = document.getElementById('jobsTableBody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  try {
    const jobs = await getJobsList();

    tbody.innerHTML = jobs
      .map(
        (job) => {
          const isSucceeded = job.status === 'SUCCEEDED' && job.outputFile;

          // Extract the file ID from the output path if it exists
          const fileId = isSucceeded ? job.outputFile.split('/').pop() : null;
          
          // Note: we use window.viewResults here
          const idDisplay = isSucceeded 
            ? `<a href="#" onclick="window.viewResults('${fileId}'); return false;">${job.id}</a>`
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
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="4" style="color:red">Error loading jobs</td></tr>`;
  }
};

/**
 * Submits a new prompt to initiate a Gemini batch job.
 */
window.createJob = async function() {
  const input = document.getElementById('promptInput');
  const prompt = input.value.trim();
  if (!prompt) return alert('Please enter a prompt');

  const btn = document.querySelector('button[onclick="createJob()"]');
  const originalText = btn.innerText;
  
  btn.disabled = true;
  btn.innerText = 'Creating...';

  try {
    const res = await submitBatchJob(prompt);

    if (res.ok) {
      input.value = '';
      window.fetchJobs(); // Refresh table immediately
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (error) {
    console.error(error);
    alert('Failed to create job');
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
};

/**
 * Displays the content of a succeeded batch job's output file in a modal.
 */
window.viewResults = async function(fileId) {
  const modal = document.getElementById('resultModal');
  const modalBody = document.getElementById('modalBody');

  // Show loading state
  modalBody.innerHTML = '<p>Loading results...</p>';
  modal.style.display = 'block';

  try {
    const data = await getJobResults(fileId);

    if (!data || data.length === 0) {
      modalBody.innerHTML = '<p>No results found in file.</p>';
      return;
    }

    // Clear loading message
    modalBody.innerHTML = '';

    // Render each response item
    data.forEach(item => {
      // 1. Extract Metadata
      const key = item.key || 'Unknown Request';
      const modelVersion = item.response?.modelVersion || 'Unknown Model';
      const usage = item.response?.usageMetadata || {};
      
      const totalTokens = usage.totalTokenCount || 0;
      const promptTokens = usage.promptTokenCount || 0;
      const responseTokens = usage.candidatesTokenCount || 0;

      // 2. Extract Text Content
      const candidate = item.response?.candidates?.[0];
      let rawText = "*No content generated*";
      
      if (candidate && candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        rawText = candidate.content.parts[0].text || rawText;
      }

      // 3. Render Markdown (using global marked instance)
      const htmlContent = marked.parse(rawText);

      // 4. Construct HTML Card
      const resultEntry = document.createElement('div');
      resultEntry.className = 'result-entry';
      resultEntry.innerHTML = `
        <div class="meta-header">
          <h3>Request ID: ${key}</h3>
          <div class="meta-stats">
             <strong>Model:</strong> ${modelVersion} | 
             <strong>Tokens:</strong> ${totalTokens} (In: ${promptTokens}, Out: ${responseTokens})
          </div>
        </div>
        <div class="response-body">
          ${htmlContent}
        </div>
      `;
      
      modalBody.appendChild(resultEntry);
    });

  } catch (err) {
    console.error(err);
    modalBody.innerHTML = `<p style="color:red">Failed to load results. Check console for details.</p>`;
  }
};

/**
 * Closes the modal
 */
window.closeModal = function() {
  const modal = document.getElementById('resultModal');
  modal.style.display = 'none';
};

// Close modal when clicking outside the box
window.onclick = function(event) {
  const modal = document.getElementById('resultModal');
  if (event.target === modal) {
    window.closeModal();
  }
};

// Initialize the job list on page load
window.fetchJobs();