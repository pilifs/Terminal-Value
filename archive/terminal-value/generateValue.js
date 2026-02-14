/**
 * Generates tailored LLM prompts for high-value clients to drive sales.
 * @param {Array} clientData - The output from parseValue()
 * @returns {Array} List of prompt sets for each client
 */
function generateValue(clientData) {
  const getFooter = (promptKey) => {
    let promptFooter;
    switch (promptKey) {
      case 'webComponentHome':
        promptFooter = `Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'Home' for this particular high value client that we will serve instead of the regular home page when they visit the site.`;
        break;
      case 'webComponentOrder':
        promptFooter = `Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'Order' for this particular high value client that we will serve instead of the regular order page when they visit the site.`;
        break;
      case 'marketingImage':
      case 'redditPost':
      default:
        promptFooter = 'no-op';
    }

    return promptFooter;
  };

  return clientData.map((client) => {
    const { profile, shoppingHistory, techContext } = client;
    const notes = profile.crmNotes.join(' ');

    // Unused for now
    // const device = techContext[0] || {
    //   device: 'Unknown',
    //   browser: 'Unknown',
    // };

    // const purchasedCategories = [
    //   ...new Set(
    //     shoppingHistory.flatMap((o) => o.items.map((i) => i.productName))
    //   ),
    // ];

    const businessStrategy = `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is ${profile.age} years old and based in ${profile.city}. Our executive sales team has made the following notes in the internal ski shop CRM database: "${notes}". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but make whatever presentation changes it takes to drive more revenue.`;

    const createPrompt = (key) =>
      `
          ${businessStrategy}
          ${getFooter(key)}
        `.trim();

    return {
      clientId: profile.id,
      prompts: {
        webComponentHome: createPrompt('webComponentHome'),
        webComponentOrder: createPrompt('webComponentOrder'),
        marketingImage: createPrompt('marketingImage'),
        redditPost: createPrompt('redditPost'),
      },
    };
  });
}

// const results = generateValue(clients);

export default generateValue;
