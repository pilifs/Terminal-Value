/**
 * Google AI Model Constants
 * Last Updated: Feb 3, 2026
 * * Documentation: https://ai.google.dev/models
 */

export const GOOGLE_AI_MODELS = {
  // -----------------------------------------------------------
  // LATEST PREVIEW (Gemini 3.0 Series)
  // Recommended for cutting-edge capabilities and reasoning
  // -----------------------------------------------------------
  PREVIEW: {
    GEMINI_3_PRO: 'gemini-3-pro-preview',
    GEMINI_3_FLASH: 'gemini-3-flash-preview',
    GEMINI_3_IMAGE: 'gemini-3-pro-image-preview', // "Nano Banana Pro"
  },

  // -----------------------------------------------------------
  // STABLE / PRODUCTION (Gemini 2.5 Series)
  // Recommended for production deployments requiring SLAs
  // -----------------------------------------------------------
  STABLE: {
    // Best for complex reasoning & coding
    GEMINI_2_5_PRO: 'gemini-2.5-pro',
    
    // Best balance of latency & cost
    GEMINI_2_5_FLASH: 'gemini-2.5-flash',
    
    // Optimized for massive throughput/cost-efficiency
    GEMINI_2_5_FLASH_LITE: 'gemini-2.5-flash-lite',
    
    // Specialized image editing/generation model
    GEMINI_2_5_FLASH_IMAGE: 'gemini-2.5-flash-image',
  },

  // -----------------------------------------------------------
  // LEGACY / DEPRECATING (Gemini 2.0 & 1.5 Series)
  // ⚠️ Gemini 2.0 models are scheduled for retirement in March 2026
  // -----------------------------------------------------------
  LEGACY: {
    GEMINI_2_0_FLASH: 'gemini-2.0-flash',
    GEMINI_2_0_FLASH_LITE: 'gemini-2.0-flash-lite',
    
    // Older 1.5 models (Likely deprecated or strictly limited)
    GEMINI_1_5_PRO: 'gemini-1.5-pro',
    GEMINI_1_5_FLASH: 'gemini-1.5-flash',
  },

  // -----------------------------------------------------------
  // EMBEDDINGS
  // -----------------------------------------------------------
  EMBEDDINGS: {
    TEXT_EMBEDDING_004: 'text-embedding-004',
    GEMINI_EMBEDDING: 'gemini-embedding-001',
  }
};

/**
 * Helper to get the full resource string for a model
 * @param {string} modelId - The model ID (e.g. 'gemini-3-pro-preview')
 * @returns {string} The full resource name (e.g. 'models/gemini-3-pro-preview')
 */
export const getModelResource = (modelId) => `models/${modelId}`;

export default GOOGLE_AI_MODELS;