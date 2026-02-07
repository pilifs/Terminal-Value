import path from 'path';
import { fileURLToPath } from 'url';
import clients from './memoizedResults/parseValueResults.js';
import { getMemoizedResult } from './examples/ski-shop/utils/memoizer.js';

// Setup paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMO_FILE_PATH = path.join(
  __dirname,
  'memoizedResults/generateValueResults.js'
);

/**
 * Generates tailored LLM prompts for high-value clients to drive sales.
 * Uses memoization utility to cache results.
 * @param {Array} clientData - The output from parseValue()
 * @returns {Array} List of prompt sets for each client
 */
function generateValue(clientData) {
  return getMemoizedResult({
    filePath: MEMO_FILE_PATH,
    inputData: clientData,
    variableName: 'generateValueResults',
    useDefaultExport: false, // Output uses named export only
    computeFn: () => {
      const headerContext = 'CONTEXT:';
      const headerTask = 'TASK:';
      const headerRequirements = 'REQUIREMENTS:';

      const getFooter = (pageName, fileName) =>
        `
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named '${pageName}' for this particular high value client that we will serve instead of the regular ${fileName} page when they visit the site.
    `.trim();

      return clientData.map((client) => {
        const { profile, shoppingHistory, techContext } = client;
        const notes = profile.crmNotes.join(' ');
        const device = techContext[0] || {
          device: 'Unknown',
          browser: 'Unknown',
        };

        const purchasedCategories = [
          ...new Set(
            shoppingHistory.flatMap((o) => o.items.map((i) => i.productName))
          ),
        ];

        const businessStrategy = `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is ${profile.age} years old and based in ${profile.city}. Our executive sales team has made the following notes in the internal ski shop CRM database: "${notes}". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but make whatever presentation changes it takes to drive more revenue.`;

        // Deprecated, remove this when refactoring the marketingImage and redditPost prompts to use the new format
        const clientContext = `
      User Profile: ${profile.age}-year-old based in ${profile.city}.
      CRM Notes: "${notes}"
      Past Purchases: ${purchasedCategories.join(', ')}.
      Device: ${device.device} (${device.browser}).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    `;

        return {
          clientId: profile.id,
          prompts: {
            webComponentHome: `
          ${businessStrategy}
          ${getFooter('Home', 'home')}
        `.trim(),

            webComponentOrder: `
          ${businessStrategy}

          This is a component that handles final checkout logic. It is especially critical not to break the experience here, but we still want consistency with the business strategy laid out for this client in our other marketing pages.

          ${getFooter('Order', 'order')}
        `.trim(),

            marketingImage: `
          ${headerContext}
          ${clientContext}

          ${headerTask}
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          ${headerRequirements}
          - Subject: A skier matching the user's demographic (${profile.age}, ${
            profile.city
          }) engaging in their preferred ski style (${
            purchasedCategories[0] || 'General Skiing'
          }).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.
        `.trim(),

            redditPost: `
          ${headerContext}
          ${clientContext}

          ${headerTask}
          Write a Reddit paid advertisement post targeting /r/skiing.

          ${headerRequirements}
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to ${profile.city} skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for ${profile.city} locals.
          - Call to Action: subtle link to the store.
        `.trim(),
          },
        };
      });
    },
  });
}

const results = generateValue(clients);

export default generateValue;
