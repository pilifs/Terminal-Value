import { experimentPrompts } from './experimentPrompts.js';

/**
 * Generates tailored LLM prompts for high-value clients to drive sales.
 * @param {Array} clientData - The output from parseValue()
 * @returns {Array} List of prompt sets for each client
 */
function generateValue(clientData) {
  return clientData.map((client) => {
    const { profile } = client;
    const notes = profile.crmNotes.join(' ');

    // Generate all experiment prompts for this client
    const clientPrompts = {};

    Object.entries(experimentPrompts).forEach(([key, templateFn]) => {
      clientPrompts[key] = {
        promptId: key,
        text: templateFn(profile, notes).trim(),
      };
    });

    return {
      clientId: profile.id,
      prompts: clientPrompts,
    };
  });
}

export default generateValue;
