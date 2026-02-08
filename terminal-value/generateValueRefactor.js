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
 * Updated to utilize the specific shape of clientDetailsExample.
 * * @param {Object} clientDetails - The client configuration object matching the example structure.
 * @returns {string} The base strategy prompt.
 */
const generateBasePrompt = (clientDetails) => {
  const { profile, techContext } = clientDetails;

  // Safe access to nested properties
  const userLocation = profile?.city || 'Unknown Location';
  const userAge = profile?.age || 'Unknown Age';
  const notes = profile?.crmNotes
    ? profile.crmNotes.join(' ')
    : 'No specific notes.';
  const primaryDevice =
    techContext && techContext[0] ? techContext[0].device : 'Generic Device';

  return `
You are an expert web architect and strategist.
User Context:
- ID: ${profile?.id || 'GUEST'}
- Demographics: ${userAge} years old, located in ${userLocation}.
- Technical Environment: Browsing via ${primaryDevice}.
- CRM Notes: ${notes}

Your goal is to generate high-fidelity, production-ready web components tailored specifically to this user's preferences and constraints.
    `.trim();
};

/**
 * Returns a collection of prompt generating functions.
 * Encapsulates logic for generating component-specific prompts based on user data.
 * * @returns {Object} An object containing the base generator and a map of sub-prompt generators.
 */
const getPromptGenerators = () => {
  return {
    basePrompt: generateBasePrompt,
    subPrompts: {
      /**
       * Generates the prompt for the Home Page component.
       * Uses profile notes and LTV to determine tone.
       * @param {Object} clientDetails
       */
      homePage: (clientDetails) => {
        const { profile } = clientDetails;
        const notesList = profile?.crmNotes
          ? profile.crmNotes.map((n) => `- ${n}`).join('\n')
          : '- Standard user';

        return `
### Component Request: Home Page
Create a personalized landing page component.
Target Audience Profile:
${notesList}

Key Metrics:
- Member Since: ${
          profile?.memberSince
            ? new Date(profile.memberSince).toLocaleDateString()
            : 'N/A'
        }
- Lifetime Value: $${profile?.totalLifetimeValue || 0}

Requirements:
- Highlight gear relevant to ${profile?.city || 'their location'}.
- Ensure the hero section speaks directly to their technical expertise level mentioned in the notes.
                `.trim();
      },

      /**
       * Generates the prompt for the Order Page component.
       * Uses shopping history to streamline re-ordering.
       * @param {Object} clientDetails
       */
      orderPage: (clientDetails) => {
        const { shoppingHistory } = clientDetails;

        // Extract unique product names from history for context
        const purchasedItems = shoppingHistory
          ? [
              ...new Set(
                shoppingHistory.flatMap((o) =>
                  o.items.map((i) => i.productName)
                )
              ),
            ].join(', ')
          : 'None';

        return `
### Component Request: Order Page
Create a secure, streamlined order page component.
Contextual Awareness:
- The user has previously purchased: ${purchasedItems}.
- Suggest a "Buy It Again" section if relevant.

Focus on user trust and a frictionless checkout flow suitable for high-value transactions.
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
