import clients from './devMocks/parseValueResults.js';

/**
 * Generates tailored LLM prompts for high-value clients to drive sales.
 * @param {Array} clientData - The output from parseValue()
 * @returns {Array} List of prompt sets for each client
 */
function generateValue(clientData) {
  // --- Common Prompt Sections ---
  const headerContext = 'CONTEXT:';
  const headerTask = 'TASK:';
  const headerRequirements = 'REQUIREMENTS:';

  // Helper to generate the footer reference for web components
  const getFooter = (pageName, fileName) =>
    `
    *** Reference the codebase attached. The default ${pageName} web component is located in 'examples/ski-shop/public/components/${fileName}'. Do not make any functional changes to the app, only modify presentation. ***
  `.trim();

  return clientData.map((client) => {
    const { profile, shoppingHistory, techContext } = client;
    const notes = profile.crmNotes.join(' ');
    const device = techContext[0] || { device: 'Unknown', browser: 'Unknown' };

    // Calculate preferences based on history
    const purchasedCategories = [
      ...new Set(
        shoppingHistory.flatMap((o) => o.items.map((i) => i.productName))
      ),
    ];

    // Construct the context string used in all prompts
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
        // 1. Custom Web Component: Home Page
        webComponentHome: `
          ${headerContext}
          ${clientContext}

          ${headerTask}
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          ${headerRequirements}
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          ${getFooter('Home page', 'HomePage.js')}
        `.trim(),

        // 2. Custom Web Component: Order Page
        webComponentOrder: `
          ${headerContext}
          ${clientContext}

          ${headerTask}
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          ${headerRequirements}
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from ${
            profile.city
          }, display a banner: "Free Express Shipping to ${
          profile.city
        } included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for ${
            device.device
          } touch targets.

          ${getFooter('Order page', 'OrderPage.js')}
        `.trim(),

        // 3. Marketing Image Prompt
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

        // 4. Reddit Advertisement Post
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
}

const results = generateValue(clients);

export default generateValue;
