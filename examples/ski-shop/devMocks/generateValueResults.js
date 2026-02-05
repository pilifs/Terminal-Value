export const generateValueResults = [
  {
    clientId: 'CLIENT-004',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 52-year-old based in Calgary.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, All Mountain Explorer, Nordic Cross, World Cup Racer.
      Device: Pixel 6 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 52-year-old based in Calgary.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, All Mountain Explorer, Nordic Cross, World Cup Racer.
      Device: Pixel 6 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Pixel 6 touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 52-year-old based in Calgary.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, All Mountain Explorer, Nordic Cross, World Cup Racer.
      Device: Pixel 6 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (52, Calgary) engaging in their preferred ski style (Backcountry Tour).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 52-year-old based in Calgary.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, All Mountain Explorer, Nordic Cross, World Cup Racer.
      Device: Pixel 6 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Calgary skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Calgary locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-012',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 50-year-old based in Calgary.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: Deep Powder, Backcountry Tour, World Cup Racer, Big Mountain Pro, Park Freestyle.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 50-year-old based in Calgary.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: Deep Powder, Backcountry Tour, World Cup Racer, Big Mountain Pro, Park Freestyle.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPad Air touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 50-year-old based in Calgary.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: Deep Powder, Backcountry Tour, World Cup Racer, Big Mountain Pro, Park Freestyle.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (50, Calgary) engaging in their preferred ski style (Deep Powder).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 50-year-old based in Calgary.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: Deep Powder, Backcountry Tour, World Cup Racer, Big Mountain Pro, Park Freestyle.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Calgary skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Calgary locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-010',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 27-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: All Mountain Explorer, Piste Carver, World Cup Racer, Nordic Cross, Big Mountain Pro.
      Device: MacBook Pro (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 27-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: All Mountain Explorer, Piste Carver, World Cup Racer, Nordic Cross, Big Mountain Pro.
      Device: MacBook Pro (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Aspen, display a banner: "Free Express Shipping to Aspen included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for MacBook Pro touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 27-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: All Mountain Explorer, Piste Carver, World Cup Racer, Nordic Cross, Big Mountain Pro.
      Device: MacBook Pro (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (27, Aspen) engaging in their preferred ski style (All Mountain Explorer).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 27-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: All Mountain Explorer, Piste Carver, World Cup Racer, Nordic Cross, Big Mountain Pro.
      Device: MacBook Pro (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Aspen skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Aspen locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-014',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 37-year-old based in Vancouver.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Deep Powder, World Cup Racer, Big Mountain Pro.
      Device: iPhone 13 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 37-year-old based in Vancouver.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Deep Powder, World Cup Racer, Big Mountain Pro.
      Device: iPhone 13 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Vancouver, display a banner: "Free Express Shipping to Vancouver included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPhone 13 touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 37-year-old based in Vancouver.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Deep Powder, World Cup Racer, Big Mountain Pro.
      Device: iPhone 13 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (37, Vancouver) engaging in their preferred ski style (Park Freestyle).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 37-year-old based in Vancouver.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Deep Powder, World Cup Racer, Big Mountain Pro.
      Device: iPhone 13 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Vancouver skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Vancouver locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-006',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 19-year-old based in Salt Lake City.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, Backcountry Tour, Deep Powder, World Cup Racer.
      Device: iPad Air (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 19-year-old based in Salt Lake City.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, Backcountry Tour, Deep Powder, World Cup Racer.
      Device: iPad Air (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Salt Lake City, display a banner: "Free Express Shipping to Salt Lake City included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPad Air touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 19-year-old based in Salt Lake City.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, Backcountry Tour, Deep Powder, World Cup Racer.
      Device: iPad Air (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (19, Salt Lake City) engaging in their preferred ski style (Nordic Cross).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 19-year-old based in Salt Lake City.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, Backcountry Tour, Deep Powder, World Cup Racer.
      Device: iPad Air (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Salt Lake City skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Salt Lake City locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-020',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 53-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Backcountry Tour, Nordic Cross, Deep Powder.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 53-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Backcountry Tour, Nordic Cross, Deep Powder.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Banff, display a banner: "Free Express Shipping to Banff included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPad Air touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 53-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Backcountry Tour, Nordic Cross, Deep Powder.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (53, Banff) engaging in their preferred ski style (Backcountry Tour).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 53-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Backcountry Tour, Nordic Cross, Deep Powder.
      Device: iPad Air (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Banff skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Banff locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-002',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 36-year-old based in Vancouver.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Park Freestyle, Piste Carver, Deep Powder, Backcountry Tour.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 36-year-old based in Vancouver.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Park Freestyle, Piste Carver, Deep Powder, Backcountry Tour.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Vancouver, display a banner: "Free Express Shipping to Vancouver included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for MacBook Pro touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 36-year-old based in Vancouver.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Park Freestyle, Piste Carver, Deep Powder, Backcountry Tour.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (36, Vancouver) engaging in their preferred ski style (Park Freestyle).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 36-year-old based in Vancouver.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Park Freestyle, Piste Carver, Deep Powder, Backcountry Tour.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Vancouver skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Vancouver locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-008',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 24-year-old based in Salt Lake City.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Nordic Cross, Piste Carver, Backcountry Tour, Park Freestyle.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 24-year-old based in Salt Lake City.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Nordic Cross, Piste Carver, Backcountry Tour, Park Freestyle.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Salt Lake City, display a banner: "Free Express Shipping to Salt Lake City included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 24-year-old based in Salt Lake City.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Nordic Cross, Piste Carver, Backcountry Tour, Park Freestyle.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (24, Salt Lake City) engaging in their preferred ski style (Nordic Cross).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 24-year-old based in Salt Lake City.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Nordic Cross, Piste Carver, Backcountry Tour, Park Freestyle.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Salt Lake City skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Salt Lake City locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-018',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Piste Carver, All Mountain Explorer, Deep Powder, Park Freestyle.
      Device: Pixel 6 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Piste Carver, All Mountain Explorer, Deep Powder, Park Freestyle.
      Device: Pixel 6 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Pixel 6 touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Piste Carver, All Mountain Explorer, Deep Powder, Park Freestyle.
      Device: Pixel 6 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (32, Calgary) engaging in their preferred ski style (Piste Carver).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Piste Carver, All Mountain Explorer, Deep Powder, Park Freestyle.
      Device: Pixel 6 (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Calgary skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Calgary locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-016',
    prompts: {
      webComponentHome: `CONTEXT:
          
      User Profile: 52-year-old based in Whistler.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Backcountry Tour.
      Device: iPad Air (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'HomePage'.
          
          REQUIREMENTS:
          - Replace the standard inventory grid with a personalized layout.
          - If the user has a history of 'Racing' gear, highlight the "Sales Blowout" on World Cup Racer skis with a dynamic price calculated between 0.4 * COGS and 1.0 * COGS.
          - Show a personalized greeting using their City or specific interests found in CRM notes (e.g., "Ready for your trip to Vail?").
          - Use the 'loadInventory()' method to fetch data from '/api/inventory' but filter/sort specifically for this user's persona.
          - Ensure it matches the existing CSS styling of the shop.

          *** Reference the codebase attached. The default Home page web component is located in 'examples/ski-shop/public/components/HomePage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 52-year-old based in Whistler.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Backcountry Tour.
      Device: iPad Air (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Whistler, display a banner: "Free Express Shipping to Whistler included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPad Air touch targets.

          *** Reference the codebase attached. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 52-year-old based in Whistler.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Backcountry Tour.
      Device: iPad Air (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (52, Whistler) engaging in their preferred ski style (Park Freestyle).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 52-year-old based in Whistler.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Park Freestyle, All Mountain Explorer, Nordic Cross, Backcountry Tour.
      Device: iPad Air (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Whistler skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Whistler locals.
          - Call to Action: subtle link to the store.`,
    },
  },
];
