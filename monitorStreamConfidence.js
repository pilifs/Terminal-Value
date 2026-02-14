/**
 * Monitors the semantic stability of a response using Asymmetric Configuration.
 *
 * @param {string} prompt - The user input.
 * @param {Function} createStreamFn - MUST accept (prompt, config) and return a stream.
 * @param {Function} embedFn - Returns a vector for a string.
 * @param {Object} config - Configuration options.
 */
async function* monitorStreamingConfidence(
  prompt,
  createStreamFn,
  embedFn,
  config = {}
) {
  const {
    sampleCount = 3,
    checkInterval = 100,
    driftThreshold = 0.15,
    // Asymmetric Configs:
    // Primary: Low temp for clean, deterministic user output.
    primaryGenConfig = { temperature: 0.2, topK: 40, topP: 0.95 },
    // Shadow: High temp to induce variance if the model is unsure.
    shadowGenConfig = { temperature: 0.85, topK: 40, topP: 0.95 },
  } = config;

  // 1. Initialize Streams with ASYMMETRIC Configs
  // Stream 0 (Primary) uses the "Safe" config
  const primaryStream = createStreamFn(prompt, primaryGenConfig);

  // Streams 1..N (Shadows) use the "Chaos" config
  const shadowStreams = Array.from({ length: sampleCount - 1 }, () =>
    createStreamFn(prompt, shadowGenConfig)
  );

  const streams = [primaryStream, ...shadowStreams];
  const buffers = new Array(sampleCount).fill('');

  // Readers
  const primaryReader = streams[0].getReader();
  const shadowReaders = streams.slice(1).map((s) => s.getReader());

  let lastCheckLength = 0;

  try {
    while (true) {
      // 2. Read Primary Chunk
      const { done, value } = await primaryReader.read();
      if (done) return;

      const chunkText = new TextDecoder().decode(value);
      buffers[0] += chunkText;

      // Yield content immediately to user
      yield { chunk: chunkText, status: 'generating' };

      // 3. Sync Shadow Streams
      // Read shadows until they catch up to primary's length
      await Promise.all(
        shadowReaders.map(async (reader, index) => {
          const shadowIdx = index + 1;
          while (buffers[shadowIdx].length < buffers[0].length) {
            const result = await reader.read();
            if (result.done) break;
            buffers[shadowIdx] += new TextDecoder().decode(result.value);
          }
        })
      );

      // 4. Calculate Drift
      if (buffers[0].length - lastCheckLength > checkInterval) {
        // Embed all buffers (Primary + Shadows)
        const vectors = await Promise.all(buffers.map((text) => embedFn(text)));

        // Calculate how far the Primary (buffers[0]) is from the "consensus"
        const drift = calculateDrift(vectors);

        yield {
          status: 'verifying',
          currentDrift: drift,
          confidence: 1 - drift,
        };

        if (drift > driftThreshold) {
          throw new Error(
            `Hallucination Detected: High divergence between primary and shadow streams (Drift: ${drift.toFixed(2)})`
          );
        }

        lastCheckLength = buffers[0].length;
      }
    }
  } finally {
    primaryReader.releaseLock();
    streams.forEach((s) => s.cancel?.());
  }
}

// --- Helper: Drift Calculation ---
function calculateDrift(vectors) {
  // 1. Centroid of all vectors
  const dims = vectors[0].length;
  const count = vectors.length;
  const centroid = new Array(dims).fill(0);

  for (let v of vectors) {
    for (let i = 0; i < dims; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dims; i++) centroid[i] /= count;

  // 2. Calculate Primary Stream's distance from Centroid
  // (We care most if the USER facing stream is weird, not the shadows)
  return 1 - cosineSimilarity(vectors[0], centroid);
}

// Simple Cosine Similarity
function cosineSimilarity(vecA, vecB) {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    magA += vecA[i] ** 2;
    magB += vecB[i] ** 2;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
