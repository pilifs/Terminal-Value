export const generateValueResults = [
  {
    clientId: 'CLIENT-010',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue within a profit margin threshold of +40-100%. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 32 years old and based in Aspen. Our executive sales team has made the following notes in the internal ski shop CRM database: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 32-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: World Cup Racer, Deep Powder, All Mountain Explorer, Big Mountain Pro.
      Device: Pixel 6 (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Aspen, display a banner: "Free Express Shipping to Aspen included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Pixel 6 touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 32-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: World Cup Racer, Deep Powder, All Mountain Explorer, Big Mountain Pro.
      Device: Pixel 6 (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (32, Aspen) engaging in their preferred ski style (World Cup Racer).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 32-year-old based in Aspen.
      CRM Notes: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings."
      Past Purchases: World Cup Racer, Deep Powder, All Mountain Explorer, Big Mountain Pro.
      Device: Pixel 6 (Safari).
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
    clientId: 'CLIENT-008',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 36 years old and based in Calgary. Our executive sales team has made the following notes in the internal ski shop CRM database: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 36-year-old based in Calgary.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, Big Mountain Pro, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPhone 13 touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 36-year-old based in Calgary.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, Big Mountain Pro, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (36, Calgary) engaging in their preferred ski style (Backcountry Tour).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 36-year-old based in Calgary.
      CRM Notes: "Client has young family members that are into ski racing. Buys new gear every November for the kids. Often asks for bulk discounts or team deals."
      Past Purchases: Backcountry Tour, Deep Powder, Piste Carver, Big Mountain Pro, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
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
    clientId: 'CLIENT-002',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 38 years old and based in Salt Lake City. Our executive sales team has made the following notes in the internal ski shop CRM database: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 38-year-old based in Salt Lake City.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Deep Powder, Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
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

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 38-year-old based in Salt Lake City.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Deep Powder, Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
      Device: iPad Air (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (38, Salt Lake City) engaging in their preferred ski style (Deep Powder).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 38-year-old based in Salt Lake City.
      CRM Notes: "Client is taking a big trip to Vail next month and needs to gear up. Previously complained about boots being too tight, needs wide fit. High income, value-conscious but willing to pay for durability."
      Past Purchases: Deep Powder, Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
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
    clientId: 'CLIENT-016',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 37 years old and based in Banff. Our executive sales team has made the following notes in the internal ski shop CRM database: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 37-year-old based in Banff.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Big Mountain Pro, Deep Powder, World Cup Racer, All Mountain Explorer, Piste Carver.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Banff, display a banner: "Free Express Shipping to Banff included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 37-year-old based in Banff.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Big Mountain Pro, Deep Powder, World Cup Racer, All Mountain Explorer, Piste Carver.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (37, Banff) engaging in their preferred ski style (Big Mountain Pro).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 37-year-old based in Banff.
      CRM Notes: "Adventure photographer, carries heavy camera gear. Needs rugged backpacks and stable skis. Often destroys gear quickly due to rough usage."
      Past Purchases: Big Mountain Pro, Deep Powder, World Cup Racer, All Mountain Explorer, Piste Carver.
      Device: Windows Desktop (Chrome).
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
    clientId: 'CLIENT-004',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 44 years old and based in Aspen. Our executive sales team has made the following notes in the internal ski shop CRM database: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 44-year-old based in Aspen.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Piste Carver, Big Mountain Pro, World Cup Racer, All Mountain Explorer.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Aspen, display a banner: "Free Express Shipping to Aspen included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 44-year-old based in Aspen.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Piste Carver, Big Mountain Pro, World Cup Racer, All Mountain Explorer.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (44, Aspen) engaging in their preferred ski style (Piste Carver).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 44-year-old based in Aspen.
      CRM Notes: "Client is a trust fund baby that must buy the latest gear. Impulse buyer, usually buys the most expensive item in the category. Loves flashy colors and branding."
      Past Purchases: Piste Carver, Big Mountain Pro, World Cup Racer, All Mountain Explorer.
      Device: Windows Desktop (Edge).
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
    clientId: 'CLIENT-018',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 32 years old and based in Calgary. Our executive sales team has made the following notes in the internal ski shop CRM database: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Backcountry Tour, Park Freestyle, Piste Carver, Big Mountain Pro, Nordic Cross.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for MacBook Pro touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Backcountry Tour, Park Freestyle, Piste Carver, Big Mountain Pro, Nordic Cross.
      Device: MacBook Pro (Safari).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (32, Calgary) engaging in their preferred ski style (Backcountry Tour).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 32-year-old based in Calgary.
      CRM Notes: "Weekend warrior from the city. Needs versatile gear for changing conditions. Usually rents high-performance demos before buying."
      Past Purchases: Backcountry Tour, Park Freestyle, Piste Carver, Big Mountain Pro, Nordic Cross.
      Device: MacBook Pro (Safari).
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
    clientId: 'CLIENT-014',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 49 years old and based in Burlington. Our executive sales team has made the following notes in the internal ski shop CRM database: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 49-year-old based in Burlington.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Burlington, display a banner: "Free Express Shipping to Burlington included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 49-year-old based in Burlington.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (49, Burlington) engaging in their preferred ski style (Backcountry Tour).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 49-year-old based in Burlington.
      CRM Notes: "Retiree skiing 100+ days a year. Prioritizes comfort above all else. Loyal to the shop for 10 years, expects coffee when they walk in."
      Past Purchases: Backcountry Tour, Big Mountain Pro, World Cup Racer, Park Freestyle.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Write a Reddit paid advertisement post targeting /r/skiing.

          REQUIREMENTS:
          - Tone: Authentic, helpful, expert advice. Avoid overly "salesy" language.
          - Title: Catchy, relating to Burlington skiers or their specific interest (e.g., "Backcountry setups" or "Racing gear").
          - Body: Acknowledge the "Sales Blowout" on racing gear. Mention that we have specific stock available for Burlington locals.
          - Call to Action: subtle link to the store.`,
    },
  },
  {
    clientId: 'CLIENT-012',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 28 years old and based in Vancouver. Our executive sales team has made the following notes in the internal ski shop CRM database: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 28-year-old based in Vancouver.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: World Cup Racer, Nordic Cross, All Mountain Explorer.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Vancouver, display a banner: "Free Express Shipping to Vancouver included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 28-year-old based in Vancouver.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: World Cup Racer, Nordic Cross, All Mountain Explorer.
      Device: Windows Desktop (Chrome).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (28, Vancouver) engaging in their preferred ski style (World Cup Racer).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 28-year-old based in Vancouver.
      CRM Notes: "Digital nomad, works from the lodge half the day. Needs gear that transitions well from slope to apres-ski. Interested in heated gloves and socks."
      Past Purchases: World Cup Racer, Nordic Cross, All Mountain Explorer.
      Device: Windows Desktop (Chrome).
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
    clientId: 'CLIENT-020',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 19 years old and based in Banff. Our executive sales team has made the following notes in the internal ski shop CRM database: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 19-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Park Freestyle, Deep Powder, Backcountry Tour.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Banff, display a banner: "Free Express Shipping to Banff included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for Windows Desktop touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 19-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Park Freestyle, Deep Powder, Backcountry Tour.
      Device: Windows Desktop (Edge).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (19, Banff) engaging in their preferred ski style (Park Freestyle).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 19-year-old based in Banff.
      CRM Notes: "Cross-country fitness enthusiast. Tracks every metric on Strava. Looking for the lightest possible nordic setup."
      Past Purchases: Park Freestyle, Deep Powder, Backcountry Tour.
      Device: Windows Desktop (Edge).
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
    clientId: 'CLIENT-006',
    prompts: {
      webComponentHome: `You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 41 years old and based in Calgary. Our executive sales team has made the following notes in the internal ski shop CRM database: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but feel free to do anything it takes to the presentation to drive more revenue.
    
    Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'HomePage' for this particular high value client that we will serve instead of the regular home page when they visit the site.`,
      webComponentOrder: `CONTEXT:
          
      User Profile: 41-year-old based in Calgary.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Create a custom LitElement/HTMLElement JavaScript class named 'OrderPage'.

          REQUIREMENTS:
          - This component handles the final checkout logic.
          - Implement an upsell logic: If they are buying skis, suggest bindings or poles that match their specific 'Past Purchases' style.
          - If the client is from Calgary, display a banner: "Free Express Shipping to Calgary included for our VIP members."
          - Include a "One-Click Buy" button styled specifically for iPhone 13 touch targets.

          *** Reference the codebase below. The default Order page web component is located in 'examples/ski-shop/public/components/OrderPage.js'. Do not make any functional changes to the app, only modify presentation. ***`,
      marketingImage: `CONTEXT:
          
      User Profile: 41-year-old based in Calgary.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
      Pricing Strategy: Racing ski gear is overstocked ("Sales Blowout"). 
      Pricing Constraints: Racing gear priced at ~120% of COGS. All other gear at standard markup.
    

          TASK:
          Generate a text-to-image prompt for a 300x300 advertisement banner.

          REQUIREMENTS:
          - Subject: A skier matching the user's demographic (41, Calgary) engaging in their preferred ski style (Nordic Cross).
          - Atmosphere: High energy, aspirational, specific to the location if mentioned in notes (e.g., "Vail", "Whistler").
          - Text Overlay: Include the phrase "VIP Access" in the visual description.
          - Style: Professional sports photography, photorealistic, 4k.`,
      redditPost: `CONTEXT:
          
      User Profile: 41-year-old based in Calgary.
      CRM Notes: "Client just got into backcountry skiing and is excited to buy new stuff. Attended an avalanche safety course last month. Asking about lightweight setups for long tours."
      Past Purchases: Nordic Cross, All Mountain Explorer.
      Device: iPhone 13 (Firefox).
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
];
