import { getJobsList, submitBatchJob, getJobResults, getJobInput } from './api.js';

/**
 * Fetches the list of all batch jobs and populates the results table.
 */
window.fetchJobs = async function() {
  const tbody = document.getElementById('jobsTableBody');
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

  try {
    const jobs = await getJobsList();

    tbody.innerHTML = jobs
      .map(
        (job) => {
          const isSucceeded = job.status === 'SUCCEEDED';
          const isPending = job.status === 'PENDING';
          
          // Extract file ID only if succeeded and exists
          const outputFileId = (isSucceeded && job.outputFile) ? job.outputFile.split('/').pop() : '';
          
          // Allow click if (Succeeded with file) OR (Pending)
          const canView = (isSucceeded && job.outputFile) || isPending;

          // Pass Job ID, Output File ID, and Status to the view function
          const idDisplay = canView
            ? `<a href="#" onclick="window.viewResults('${job.id}', '${outputFileId}', '${job.status}'); return false;">${job.id}</a>`
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
      window.fetchJobs(); 
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
 * Displays INPUT request and OUTPUT results (or status) in the modal.
 */
window.viewResults = async function(jobId, outputFileId, status) {
  const modal = document.getElementById('resultModal');
  const modalBody = document.getElementById('modalBody');

  // Show loading state
  modalBody.innerHTML = '<p>Loading details...</p>';
  modal.style.display = 'block';

  try {
    // Parallel fetch: Get Input (local) and Output (remote) if available
    const [inputData, outputData] = await Promise.all([
      getJobInput(jobId),
      outputFileId ? getJobResults(outputFileId) : Promise.resolve([])
    ]);

    let html = '';

    // --- RENDER INPUT ---
    if (inputData) {
      const inputText = inputData[0]?.request?.contents?.[0]?.parts?.[0]?.text || "Unknown";
      html += `
        <div class="result-entry input-section">
          <div class="meta-header input-header">
            <h3>📤 Input Prompt</h3>
          </div>
          <div class="response-body">
            <pre>${inputText}</pre>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="alert-box">
          <strong>⚠️ Input file not found.</strong><br/>
          This input is served locally because the Gemini Batch API does not currently expose input files.
        </div>
      `;
    }

    // --- RENDER OUTPUT OR STATUS ---
    html += `<h3 class="section-title">📥 Output Results</h3>`;

    if (status === 'PENDING') {
      html += `
        <div class="info-box">
          <strong>⏳ Job is currently processing.</strong><br/>
          The results file is not yet generated. Please check back later.
        </div>
      `;
    } else if (!outputData || outputData.length === 0) {
      html += '<p>No output results found.</p>';
    } else {
      
      outputData.forEach(item => {
        const key = item.key || 'req';
        const modelVersion = item.response?.modelVersion || 'Unknown';
        const usage = item.response?.usageMetadata || {};
        
        const candidate = item.response?.candidates?.[0];
        let rawText = "*No content generated*";
        if (candidate?.content?.parts?.length > 0) {
          rawText = candidate.content.parts[0].text || rawText;
        }

        const htmlContent = marked.parse(rawText);

        html += `
          <div class="result-entry">
            <div class="meta-header">
              <h3>Response ID: ${key}</h3>
              <div class="meta-stats">
                 Model: ${modelVersion} | 
                 Tokens: ${usage.totalTokenCount || 0}
              </div>
            </div>
            <div class="response-body">
              ${htmlContent}
            </div>
          </div>
        `;
      });
    }

    modalBody.innerHTML = html;

  } catch (err) {
    console.error(err);
    modalBody.innerHTML = `<p style="color:red">Failed to load details.</p>`;
  }
};

window.closeModal = function() {
  document.getElementById('resultModal').style.display = 'none';
};

window.onclick = function(event) {
  const modal = document.getElementById('resultModal');
  if (event.target === modal) window.closeModal();
};

window.fetchJobs();