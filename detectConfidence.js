/**
 * Monitors the semantic stability of a response in real-time.
 * Aborts generation if the model's confidence drifts too low.
 *
 * @param {string} prompt - The user input.
 * @param {Function} createStreamFn - Returns a readable stream from Gemini.
 * @param {Function} embedFn - Returns a vector for a string.
 * @param {Object} config - Configuration for sensitivity.
 */
async function* monitorStreamingConfidence(
  prompt,
  createStreamFn,
  embedFn,
  config = {}
) {
  const {
    sampleCount = 3, // Fewer samples needed for streaming (saves bandwidth)
    checkInterval = 100, // Check drift every 100 characters
    driftThreshold = 0.15, // Max allowed divergence (0-1)
  } = config;

  // 1. Initialize Parallel Streams
  // We need 'active' flags to handle streams finishing at different times
  const streams = Array.from({ length: sampleCount }, () =>
    createStreamFn(prompt)
  );
  const buffers = new Array(sampleCount).fill('');
  const activeStreams = new Set(streams.map((_, i) => i));

  // We'll treat Stream 0 as the "Primary" stream that we yield to the user.
  // The others are just "Shadow" streams for verification.
  const primaryStreamReader = streams[0].getReader();
  const shadowReaders = streams.slice(1).map((s) => s.getReader());

  let lastCheckLength = 0;

  try {
    while (true) {
      // 2. Fetch the next chunk from the PRIMARY stream
      const { done, value } = await primaryStreamReader.read();

      if (done) {
        // Stream finished successfully
        return;
      }

      const chunkText = new TextDecoder().decode(value); // Assuming Uint8Array
      buffers[0] += chunkText;

      // Yield the chunk immediately to the user (Optimistic UI)
      yield { chunk: chunkText, status: 'generating' };

      // 3. Advance Shadow Streams (Background Sync)
      // We try to keep shadow streams roughly roughly in sync with the primary
      await Promise.all(
        shadowReaders.map(async (reader, index) => {
          const shadowIdx = index + 1;
          // Read until this shadow buffer is at least as long as the primary buffer
          // (Simplified synchronization logic)
          while (buffers[shadowIdx].length < buffers[0].length) {
            const result = await reader.read();
            if (result.done) break;
            buffers[shadowIdx] += new TextDecoder().decode(result.value);
          }
        })
      );

      // 4. Checkpoint Verification
      // Only check if we've added enough new content since the last check
      if (buffers[0].length - lastCheckLength > checkInterval) {
        // A. Embed the accumulated text of ALL buffers
        const vectors = await Promise.all(buffers.map((text) => embedFn(text)));

        // B. Calculate Drift (Distance from Centroid)
        const drift = calculateDrift(vectors);

        // Report current confidence
        yield {
          status: 'verifying',
          currentDrift: drift,
          confidence: 1 - drift,
        };

        // C. The "Kill Switch"
        if (drift > driftThreshold) {
          throw new Error(
            `Instability Detected: Model is hallucinating (Drift: ${drift.toFixed(
              2
            )})`
          );
        }

        lastCheckLength = buffers[0].length;
      }
    }
  } finally {
    // Cleanup: Cancel all streams if we exit (error or success)
    primaryStreamReader.releaseLock(); // Or cancel()
    streams.forEach((s) => s.cancel?.());
  }
}

// --- Helper: Same math as before ---
function calculateDrift(vectors) {
  // 1. Calculate Centroid
  const dims = vectors[0].length;
  const count = vectors.length;
  const centroid = new Array(dims).fill(0);

  for (let v of vectors) {
    for (let i = 0; i < dims; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dims; i++) centroid[i] /= count;

  // 2. Average Distance to Centroid
  let totalDist = 0;
  for (let v of vectors) {
    totalDist += 1 - cosineSimilarity(v, centroid);
  }
  return totalDist / count;
}
