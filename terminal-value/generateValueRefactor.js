/**
 * generateValueRefactor.js
 * * A pure, functional approach to generating prompts for the terminal-value project.
 * This module avoids global state and focuses on testable prompt composition.
 */

// ==========================================
// 1. Internal Generator Definitions
// ==========================================

/**
 * Generates the foundational context for the LLM.
 * Replaces the previous 'businessStrategy' variable.
 * * @param {Object} clientDetails - The client configuration object.
 * @returns {string} The base strategy prompt.
 */
const generateBasePrompt = (clientDetails) => {
  // TODO: Insert your original 'businessStrategy' text here.
  // Use clientDetails properties to make it dynamic if necessary.
  return `
You are an expert web architect and strategist.
Client Name: ${clientDetails.clientName || 'The Client'}
Industry: ${clientDetails.industry || 'Technology'}
Core Value Proposition: ${clientDetails.valueProp || 'Innovation'}

Your goal is to generate high-fidelity, production-ready web components based on the specific requirements below.
    `.trim();
};

/**
 * Returns a collection of prompt generating functions.
 * This encapsulates the logic previously found in 'getFooter' and global scope.
 * * @returns {Object} An object containing the base generator and a map of sub-prompt generators.
 */
const getPromptGenerators = () => {
  return {
    basePrompt: generateBasePrompt,
    subPrompts: {
      /**
       * Generates the prompt for the Home Page component.
       * @param {Object} clientDetails
       */
      homePage: (clientDetails) => {
        return `
### Component Request: Home Page
Create a landing page component that highlights the client's core value proposition. 
Ensure the hero section is impactful and includes a clear Call to Action (CTA).
Context: ${clientDetails.description || 'Standard corporate landing page.'}
                `.trim();
      },

      /**
       * Generates the prompt for the Order Page component.
       * @param {Object} clientDetails
       */
      orderPage: (clientDetails) => {
        return `
### Component Request: Order Page
Create a secure, streamlined order page component.
Focus on user trust, clear pricing tables, and a frictionless checkout form.
Context: ${clientDetails.productDetails || 'Standard checkout flow.'}
                `.trim();
      },

      /**
       * No-op generator for Reddit posts (Future Implementation).
       */
      redditPost: (clientDetails) => {
        return ''; // No-op
      },

      /**
       * No-op generator for Twitter posts (Future Implementation).
       */
      twitterPost: (clientDetails) => {
        return ''; // No-op
      },
    },
  };
};

// ==========================================
// 2. Public API
// ==========================================

/**
 * Orchestrates the generation of a composite prompt for a single client.
 * * @param {string[]|Set<string>} promptTypes - A list/set of keys representing which prompts to generate (e.g., ['home', 'order']).
 * @param {Object} clientDetails - All context required to generate the prompts (passed to generators).
 * @returns {string} The final, concatenated prompt string.
 */
export const generatePrompts = (promptTypes, clientDetails) => {
  // 1. Retrieve the generator functions
  const { basePrompt, subPrompts } = getPromptGenerators();

  // 2. Generate the Base Strategy (always included)
  const baseContext = basePrompt(clientDetails);

  // 3. Normalize inputs (handle Set vs Array)
  const typesToGenerate = Array.isArray(promptTypes)
    ? promptTypes
    : Array.from(promptTypes);

  // 4. Map requested types to their generated outputs
  const generatedSubPrompts = typesToGenerate
    .map((type) => {
      const generator = subPrompts[type];

      if (!generator) {
        console.warn(
          `[generatePrompts] No generator found for type: '${type}'`
        );
        return null;
      }

      return generator(clientDetails);
    })
    .filter(Boolean); // Remove nulls or empty strings from no-ops

  // 5. Combine into a single output string
  // We join with a separator to keep the context clear for the LLM
  return [baseContext, ...generatedSubPrompts].join(
    '\n\n' + '-'.repeat(20) + '\n\n'
  );
};
