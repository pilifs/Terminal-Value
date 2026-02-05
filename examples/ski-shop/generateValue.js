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
    *** Reference the codebase below. The default ${pageName} web component is located in 'examples/ski-shop/public/components/${fileName}'. Do not make any functional changes to the app, only modify presentation. ***
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

    const businessContext = `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is ${profile.age} years old and based in ${profile.city}. Our executive sales team has made the following notes in the internal ski shop CRM database: "${notes}". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`;
    // Exclude past purchases and device from here because the data is not setup to be contextual yet (too random)

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
          ${businessContext}
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
