const verifyExternalConfidenceResults = [
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-002',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-002.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  /**
   * Main logic to fetch data and apply the specific business rules
   * for this user persona.
   */
  async loadInventory() {
    const contentContainer = this.shadowRoot.getElementById('personalizedContent');
    contentContainer.innerHTML = '<div class="loading">Loading your personalized gear...</div>';

    try {
      // 1. Fetch Inventory and User Order History
      const [invRes, ordersRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(\`/api/orders?clientId=\${state.clientId || ''}\`)
      ]);

      const inventory = await invRes.json();
      const orders = await ordersRes.json();

      // 2. Analyze User History & CRM Data
      // Check for specific keywords in past orders to determine 'Racing' history
      const hasRacingHistory = orders.some(order => 
        order.items && order.items.some(item => 
          (item.name && (item.name.includes('Racer') || item.name.includes('World Cup') || item.name.includes('Piste')))
        )
      );

      // Check CRM notes for specific destination keywords (Vail)
      const crmNotes = state.clientProfile?.crmNotes || [];
      const destination = crmNotes.find(n => n.includes('Vail')) ? 'Vail' : 'the slopes';
      
      // Check CRM for specific fit needs
      const needsWideFit = crmNotes.some(n => n.includes('wide fit') || n.includes('too tight'));

      // 3. Update Header Greeting
      const city = state.clientProfile?.city || 'Vancouver';
      const headerTitle = this.shadowRoot.getElementById('headerTitle');
      const headerSub = this.shadowRoot.getElementById('headerSub');
      
      headerTitle.textContent = \`Getting Ready for \${destination}?\`;
      headerSub.textContent = \`Hello from \${city}. We've curated a durable, high-performance selection for your trip.\`;

      // 4. Categorize and Price Inventory
      const recommendations = {
        boots: [],
        skis: [],
        other: []
      };

      inventory.forEach(item => {
        let displayPrice = item.cost * 1.5; // Default Markup
        let note = '';
        let isPromo = false;

        // LOGIC: Racing Gear Pricing Strategy
        if (item.name.includes('World Cup') || item.name.includes('Racer')) {
          if (hasRacingHistory) {
            // Dynamic blowout price: Random between 0.4 and 1.0 * COGS
            const multiplier = 0.4 + (Math.random() * 0.6);
            displayPrice = item.cost * multiplier;
            note = '🔥 LOYALTY BLOWOUT';
            isPromo = true;
          } else {
            // Standard racing overstock pricing (120% COGS)
            displayPrice = item.cost * 1.2;
            note = 'Overstock Value';
          }
        }

        const productObj = { ...item, displayPrice, note, isPromo };

        // LOGIC: Filter for "Wide Fit" needs based on CRM
        if (item.name.includes('Boot')) {
            // If user needs wide fit, prioritize wide/comfort boots, penalize others visually
            if (needsWideFit) {
                if (item.name.includes('Wide') || item.name.includes('Comfort')) {
                    productObj.note = '✅ Recommended for Width';
                    recommendations.boots.unshift(productObj);
                } else {
                    recommendations.boots.push(productObj);
                }
            } else {
                recommendations.boots.push(productObj);
            }
        } 
        else if (item.name.includes('Ski') || item.name.includes('Board')) {
            recommendations.skis.push(productObj);
        } else {
            recommendations.other.push(productObj);
        }
      });

      // 5. Render Sections
      contentContainer.innerHTML = '';
      
      // Render Section: Priority Boots (Addressing CRM Complaint)
      if (recommendations.boots.length) {
        contentContainer.innerHTML += \`
          <div class="section-title">Found for you: Comfort & Wide Fit Options</div>
          <div class="grid">
            \${recommendations.boots.map(item => this.createCard(item)).join('')}
          </div>
        \`;
      }

      // Render Section: Skis (With potential Racing Logic applied)
      if (recommendations.skis.length) {
        contentContainer.innerHTML += \`
          <div class="section-title">High Performance & Durability</div>
          <div class="grid">
            \${recommendations.skis.map(item => this.createCard(item)).join('')}
          </div>
        \`;
      }

      this.attachEventListeners(inventory);

    } catch (e) {
      console.error(e);
      contentContainer.innerHTML = '<p>Unable to load your personalized selection at this time.</p>';
    }
  }

  createCard(item) {
    return \`
      <div class="card \${item.isPromo ? 'promo-card' : ''}">
          \${item.note ? \`<div class="badge">\${item.note}</div>\` : ''}
          <h3>\${item.name}</h3>
          <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
          <div class="price-container">
            \${item.isPromo 
                ? \`<span class="old-price">$\${(item.cost * 1.5).toFixed(2)}</span>\` 
                : ''}
            <span class="price">$\${item.displayPrice.toFixed(2)}</span>
          </div>
          <button 
              class="buy-btn" 
              data-id="\${item.id}"
              \${item.stock <= 0 ? 'disabled' : ''}>
              \${item.stock > 0 ? 'Add to Order' : 'Sold Out'}
          </button>
      </div>
    \`;
  }

  attachEventListeners(inventory) {
    this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.dataset.id;
        const item = inventory.find((i) => i.id === itemId);
        this.dispatchEvent(
          new CustomEvent('navigate-order', {
            detail: { item: item },
            bubbles: true,
            composed: true,
          })
        );
      });
    });
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
            
            /* Hero Section */
            .hero {
                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                color: white;
                padding: 30px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .hero h1 { margin: 0 0 10px 0; font-size: 2rem; }
            .hero p { margin: 0; font-size: 1.1rem; opacity: 0.9; }

            /* Grid Layout */
            .section-title {
                font-size: 1.4rem;
                color: #2c3e50;
                margin-bottom: 15px;
                border-left: 5px solid #e67e22;
                padding-left: 10px;
            }
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); 
                gap: 25px; 
                margin-bottom: 40px;
            }

            /* Card Styling */
            .card { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
                text-align: center; 
                position: relative;
                transition: transform 0.2s;
                border: 1px solid #eee;
            }
            .card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            
            /* Specific Promo Styles */
            .promo-card { border: 2px solid #e74c3c; background: #fff9f9; }
            
            .card h3 { margin: 15px 0 10px 0; color: #2c3e50; font-size: 1.2rem; }
            
            .badge {
                background: #27ae60;
                color: white;
                font-size: 0.8rem;
                padding: 4px 8px;
                border-radius: 4px;
                display: inline-block;
                margin-bottom: 5px;
                text-transform: uppercase;
                font-weight: bold;
            }
            .promo-card .badge { background: #e74c3c; }

            .price-container { margin: 15px 0; }
            .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; }
            .old-price { text-decoration: line-through; color: #95a5a6; font-size: 0.9rem; margin-right: 10px; }
            
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 5px; }
            
            button { 
                background: #3498db; 
                color: white; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: bold;
                transition: background 0.2s;
            }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }

            .loading { text-align: center; padding: 40px; color: #7f8c8d; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="hero">
            <h1 id="headerTitle">Welcome Back</h1>
            <p id="headerSub">Loading your personalized experience...</p>
        </div>

        <div id="personalizedContent"></div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-002.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-004',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-004.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render(); // Render structure
    this.loadInventory(); // Fetch and populate data
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    const hero = this.shadowRoot.getElementById('heroSection');
    const greeting = this.shadowRoot.getElementById('greeting');
    
    // 1. Get Client ID from URL
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');

    try {
      // 2. Fetch all necessary data in parallel
      const [inventoryRes, clientRes, ordersRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(\`/api/clients/\${clientId}\`),
        fetch(\`/api/orders?clientId=\${clientId}\`)
      ]);

      const inventory = await inventoryRes.json();
      const client = await clientRes.json();
      const orders = await ordersRes.json();

      // 3. Personalized Greeting
      const city = client.city || 'Calgary';
      greeting.innerHTML = \`Welcome back, <strong>\${city}</strong> VIP! <br><span style="font-size:0.8em; font-weight:normal; color:#bdc3c7">Your exclusive selection is ready.</span>\`;

      // 4. Analyze History for "Racing" gear (to trigger Blowout)
      // Flatten all items from all past orders to check for "Racer" or category clues
      const allPastItems = orders.flatMap(o => o.items || []);
      // In a real app we'd check category IDs, here we string match 'Racer' based on context
      // The context explicitly says user bought "World Cup Racer", so we look for that history.
      const hasRacingHistory = allPastItems.length > 0; // Simplified based on context saying they have history

      // 5. Sort & Filter Inventory: Expensive first (High -> Low) for "Trust Fund" persona
      // The user "Must buy the latest gear" and is an "Impulse buyer"
      inventory.sort((a, b) => b.cost - a.cost);

      // 6. Separate the "World Cup Racer" for the Hero Section if applicable
      let heroItem = null;
      let gridItems = [];

      inventory.forEach(item => {
        // Check for the specific Racing Ski
        if (item.name.includes('World Cup Racer') && hasRacingHistory) {
          heroItem = item;
        } else {
          gridItems.push(item);
        }
      });

      // 7. Render Hero Section (Blowout Sale)
      if (heroItem) {
        // Pricing Requirement: 0.4 * COGS to 1.0 * COGS
        const randomMultiplier = 0.4 + Math.random() * 0.6; 
        const blowoutPrice = (heroItem.cost * randomMultiplier).toFixed(2);
        
        hero.innerHTML = \`
          <div class="hero-card">
            <div class="badge">🔥 VIP SALES BLOWOUT</div>
            <h3>\${heroItem.name}</h3>
            <p class="desc">Top tier racing performance. Only for the elite.</p>
            <div class="price-container">
                <span class="old-price">$\${(heroItem.cost * 1.5).toFixed(2)}</span>
                <span class="new-price">$\${blowoutPrice}</span>
            </div>
            <p class="stock">⚠ Only \${heroItem.stock} left in stock</p>
            <button class="buy-btn hero-btn" data-id="\${heroItem.id}">IMPULSE BUY NOW</button>
          </div>
        \`;
        hero.style.display = 'block';
        
        // Attach listener for hero button
        this.shadowRoot.querySelector('.hero-btn').addEventListener('click', () => {
             // Pass the discounted price logic via the object, or let OrderPage handle it. 
             // Since OrderPage calculates price based on cost * 1.5, we technically need to override it 
             // in a real app. For this visual layer, we send the item. 
             // *Note: The OrderPage standard logic uses standard markup. 
             // To strictly follow instructions "Do not make any functional changes", 
             // I will dispatch the item. Ideally, the order logic handles the price override.*
             this.dispatchOrder(heroItem);
        });
      }

      // 8. Render Grid (Standard Markup)
      grid.innerHTML = gridItems.map(item => {
          const price = (item.cost * 1.5).toFixed(2);
          return \`
            <div class="card \${item.cost > 400 ? 'premium' : ''}">
                \${item.cost > 400 ? '<div class="premium-tag">PREMIUM</div>' : ''}
                <h3>\${item.name}</h3>
                <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
                <p class="price">$\${price}</p>
                <button 
                    class="buy-btn" 
                    data-id="\${item.id}"
                    \${item.stock <= 0 ? 'disabled' : ''}>
                    \${item.stock > 0 ? 'Add to Collection' : 'Sold Out'}
                </button>
            </div>
          \`;
      }).join('');

      // Add Event Listeners to Grid Buttons
      this.shadowRoot.querySelectorAll('.grid .buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = gridItems.find(i => i.id === itemId);
          this.dispatchOrder(item);
        });
      });

    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p>Error loading VIP inventory.</p>';
    }
  }

  dispatchOrder(item) {
    this.dispatchEvent(
      new CustomEvent('navigate-order', {
        detail: { item: item },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
            
            /* VIP Dark Theme for "Trust Fund" Persona */
            .header-area {
                background: linear-gradient(135deg, #1a1a1a 0%, #2c3e50 100%);
                color: white;
                padding: 30px;
                border-radius: 8px;
                margin-bottom: 20px;
                text-align: center;
                border: 1px solid #d4af37; /* Gold Border */
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }
            h2 { margin: 0; font-size: 2rem; color: #d4af37; text-transform: uppercase; letter-spacing: 2px; }

            /* Grid Layout */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            
            /* Standard Card */
            .card { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
                text-align: center; 
                border-top: 4px solid #bdc3c7;
                position: relative;
                overflow: hidden;
            }
            
            /* Premium Card Styling for Expensive Items */
            .card.premium {
                border-top: 4px solid #d4af37;
                background: #fffcf5;
            }
            .premium-tag {
                position: absolute;
                top: 0; right: 0;
                background: #d4af37;
                color: black;
                font-size: 0.7rem;
                padding: 2px 6px;
                font-weight: bold;
            }

            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }

            /* Hero / Blowout Section */
            #heroSection { display: none; margin-bottom: 30px; }
            .hero-card {
                background: linear-gradient(45deg, #000 0%, #333 100%);
                color: #d4af37; /* Gold */
                padding: 40px;
                border-radius: 10px;
                text-align: center;
                border: 2px solid #d4af37;
                box-shadow: 0 10px 30px rgba(0,0,0,0.4);
                position: relative;
                overflow: hidden;
            }
            .badge {
                background: #e74c3c;
                color: white;
                display: inline-block;
                padding: 5px 15px;
                font-weight: bold;
                transform: skew(-10deg);
                margin-bottom: 15px;
                font-size: 1.2rem;
                animation: pulse 1s infinite;
            }
            .hero-card h3 { font-size: 2.5rem; margin: 10px 0; color: white; }
            .desc { color: #ccc; font-style: italic; margin-bottom: 20px; }
            
            .price-container { margin: 20px 0; }
            .old-price { text-decoration: line-through; color: #7f8c8d; font-size: 1.2rem; margin-right: 15px; }
            .new-price { color: #e74c3c; font-size: 3rem; font-weight: bold; text-shadow: 0 0 10px rgba(231, 76, 60, 0.5); }

            /* Buttons */
            button { 
                background: #2c3e50; 
                color: white; 
                border: none; 
                padding: 10px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                transition: transform 0.1s;
            }
            button:hover { background: #34495e; transform: scale(1.02); }
            button:disabled { background: #ccc; cursor: not-allowed; }

            .hero-btn {
                background: #d4af37;
                color: black;
                font-weight: bold;
                font-size: 1.2rem;
                padding: 15px;
                max-width: 300px;
                text-transform: uppercase;
            }
            .hero-btn:hover { background: #f1c40f; box-shadow: 0 0 15px #d4af37; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        </style>

        <div class="header-area">
            <h2 id="greeting">Welcome VIP</h2>
        </div>

        <!-- Dynamic Hero Section for Blowout Sales -->
        <div id="heroSection"></div>

        <div id="productGrid" class="grid">Loading Exclusive Inventory...</div>
        \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-004.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-006',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-006.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.client = null;
  }

  async connectedCallback() {
    // 1. Get Client ID from URL (consistent with app.js logic)
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');

    if (clientId) {
      await this.fetchClientData(clientId);
    }
    
    // 2. Load Inventory after we know who the client is
    this.loadInventory();
  }

  async fetchClientData(id) {
    try {
      const res = await fetch(\`/api/clients/\${id}\`);
      if (res.ok) {
        this.client = await res.json();
      }
    } catch (e) {
      console.error("Failed to fetch client profile", e);
    }
  }

  async loadInventory() {
    // Initial loading state
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; padding: 20px; font-family: 'Segoe UI', sans-serif; }
        .loading { color: #7f8c8d; text-align: center; font-style: italic; }
      </style>
      <div class="loading">Loading personalized experience...</div>
    \`;

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();
      this.renderPersonalized(inventory);
    } catch (e) {
      this.shadowRoot.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  renderPersonalized(inventory) {
    // --- PERSONALIZATION LOGIC ---

    // 1. CRM & Persona Analysis
    const city = this.client?.city || 'Salt Lake City';
    const crmNotes = this.client?.crmNotes || [];
    const pastPurchases = this.client?.pastPurchases || [];
    
    // Check if user is interested in Backcountry (based on CRM or Past Purchases)
    const isBackcountryFan = crmNotes.some(n => n.toLowerCase().includes('backcountry') || n.toLowerCase().includes('lightweight')) 
                             || pastPurchases.some(p => p.includes('Backcountry'));

    // Check for Racing History (Target for Blowout)
    const hasRacingHistory = pastPurchases.some(p => p.includes('Racer') || p.includes('World Cup'));

    // 2. Filter & Sort Inventory
    let blowoutItem = null;
    let recommendedItems = [];
    let otherItems = [];

    inventory.forEach(item => {
      // Logic: World Cup Racer Blowout
      if (hasRacingHistory && item.name.includes('World Cup Racer')) {
        // Dynamic Pricing: 0.4 to 1.0 * COGS
        const discountFactor = 0.4 + (Math.random() * 0.6);
        item.displayPrice = (item.cost * discountFactor).toFixed(2);
        item.isBlowout = true;
        item.discountMsg = "ALUMNI DEAL";
        blowoutItem = item;
      } else {
        // Standard Pricing
        item.displayPrice = (item.cost * 1.5).toFixed(2);
        item.isBlowout = false;
        
        // Categorize Backcountry vs Others
        if (isBackcountryFan && (item.name.includes('Backcountry') || item.name.includes('Nordic') || item.name.includes('Powder'))) {
          recommendedItems.push(item);
        } else {
          otherItems.push(item);
        }
      }
    });

    // --- HTML GENERATION ---

    const greeting = \`Welcome back to \${city}!\`;
    const subGreeting = isBackcountryFan 
      ? "We found some lightweight setups for your next avalanche safety tour."
      : "Check out the latest gear.";

    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Layout Containers */
        .header-section { margin-bottom: 25px; border-bottom: 2px solid #ecf0f1; padding-bottom: 15px; }
        .header-section h1 { color: #2c3e50; margin: 0; font-size: 1.8rem; }
        .header-section p { color: #7f8c8d; margin: 5px 0 0; }

        .blowout-banner { 
          background: linear-gradient(135deg, #c0392b, #e74c3c); 
          color: white; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          box-shadow: 0 4px 10px rgba(192, 57, 43, 0.3);
        }
        .blowout-info h2 { margin: 0; font-size: 1.5rem; }
        .blowout-info span { background: #f1c40f; color: #c0392b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; }
        .blowout-price { font-size: 2rem; font-weight: bold; }
        
        h3.section-title { color: #2c3e50; border-left: 5px solid #3498db; padding-left: 10px; margin-top: 30px; }

        /* Grid Styles */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        
        /* Card Styles */
        .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #eee; }
        .card h4 { margin: 0 0 10px 0; color: #2c3e50; font-size: 1.1rem; }
        .stock { color: #95a5a6; font-size: 0.85rem; margin-bottom: 10px; }
        .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; margin-bottom: 15px; }
        .highlight-card { border: 2px solid #3498db; background: #fbfdff; }

        button { background: #3498db; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 0.95rem; transition: background 0.2s; }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .blowout-btn { background: white; color: #c0392b; font-weight: bold; border: 2px solid white; }
        .blowout-btn:hover { background: #c0392b; color: white; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="header-section">
        <h1>\${greeting}</h1>
        <p>\${subGreeting}</p>
      </div>

      \${blowoutItem ? \`
        <div class="blowout-banner">
          <div class="blowout-info">
            <span>\${blowoutItem.discountMsg}</span>
            <h2>\${blowoutItem.name}</h2>
            <div>Since you raced with us before, take this deal!</div>
          </div>
          <div style="text-align:right;">
             <div class="blowout-price">$\${blowoutItem.displayPrice}</div>
             <button class="buy-btn blowout-btn" data-id="\${blowoutItem.id}">Grab Deal</button>
          </div>
        </div>
      \` : ''}

      \${recommendedItems.length > 0 ? \`
        <h3 class="section-title">Recommended for Your Tour</h3>
        <div class="grid">
          \${recommendedItems.map(item => this.createCard(item, true)).join('')}
        </div>
      \` : ''}

      <h3 class="section-title">Full Inventory</h3>
      <div class="grid">
        \${otherItems.map(item => this.createCard(item, false)).join('')}
      </div>
    \`;

    // Attach Event Listeners
    this.shadowRoot.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.dataset.id;
        const allItems = [blowoutItem, ...recommendedItems, ...otherItems].filter(Boolean);
        const item = allItems.find(i => i.id === itemId);
        
        this.dispatchEvent(new CustomEvent('navigate-order', {
          detail: { item: item },
          bubbles: true,
          composed: true
        }));
      });
    });
  }

  createCard(item, highlight) {
    return \`
      <div class="card \${highlight ? 'highlight-card' : ''}">
        <div>
          <h4>\${item.name}</h4>
          <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
        </div>
        <div>
          <p class="price">$\${item.displayPrice}</p>
          <button class="buy-btn" data-id="\${item.id}" \${item.stock <= 0 ? 'disabled' : ''}>
            \${item.stock > 0 ? 'Add to Setup' : 'Sold Out'}
          </button>
        </div>
      </div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-006.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-008',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-008.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.loadData();
  }

  async loadData() {
    // 1. Get Client ID from URL to fetch persona details
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    const container = this.shadowRoot;

    // Show loading state
    container.innerHTML = \`
      <style>
        :host { display: block; font-family: 'Segoe UI', sans-serif; padding: 20px; }
        .loading { color: #7f8c8d; font-size: 1.2rem; text-align: center; }
      </style>
      <div class="loading">Loading personalized experience...</div>
    \`;

    try {
      // 2. Parallel fetch: Client Profile & Inventory
      const [clientRes, invRes] = await Promise.all([
        fetch(\`/api/clients/\${clientId}\`),
        fetch('/api/inventory')
      ]);

      const client = await clientRes.json();
      const inventory = await invRes.json();

      this.render(client, inventory);
    } catch (e) {
      container.innerHTML = \`<p>Error loading data. Please try again.</p>\`;
      console.error(e);
    }
  }

  render(client, inventory) {
    // --- PERSONA LOGIC ---
    
    // Check CRM notes for racing/family interests
    const crmNotes = client.crmNotes || [];
    const notesString = crmNotes.join(' ').toLowerCase();
    const isRacingFamily = notesString.includes('racing') || notesString.includes('team');
    
    // Greeting Logic
    const city = client.city || 'Salt Lake City'; // Default to user profile context
    const greeting = \`Welcome back to \${city}! Getting the family ready for the season?\`;

    // --- INVENTORY PROCESSING ---

    // 1. Separate Racing Gear from Standard Gear
    const racingGear = [];
    const standardGear = [];

    inventory.forEach(item => {
      const isRacerItem = item.name.includes('World Cup') || item.name.includes('Racer');
      
      if (isRacerItem && isRacingFamily) {
        // --- PRICING STRATEGY: SALES BLOWOUT ---
        // Constraint: Random between 0.4 * COGS and 1.0 * COGS
        const min = item.cost * 0.4;
        const max = item.cost * 1.0;
        const dynamicPrice = (Math.random() * (max - min) + min).toFixed(2);
        
        // Add specific visual flag
        item.displayPrice = dynamicPrice;
        item.isBlowout = true;
        item.savings = Math.floor(((item.cost * 1.5 - dynamicPrice) / (item.cost * 1.5)) * 100);
        racingGear.push(item);
      } else {
        // Standard Markup
        item.displayPrice = (item.cost * 1.5).toFixed(2);
        item.isBlowout = false;
        standardGear.push(item);
      }
    });

    // Combine for display, putting deals first
    const displayList = [...racingGear, ...standardGear];

    // --- HTML TEMPLATE ---
    
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; }
        
        .header-banner {
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 25px;
            border-left: 6px solid #e67e22;
        }
        .header-banner h2 { margin: 0; font-size: 1.5rem; }
        .header-banner p { margin: 5px 0 0 0; opacity: 0.9; }

        .section-title {
            color: #2c3e50;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }

        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); 
            gap: 25px; 
        }

        .card { 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 3px 6px rgba(0,0,0,0.1); 
            display: flex;
            flex-direction: column;
            overflow: hidden;
            transition: transform 0.2s;
            position: relative;
        }
        .card:hover { transform: translateY(-5px); }

        .card-body { padding: 20px; flex-grow: 1; text-align: center; }
        .card h3 { margin: 0 0 10px 0; color: #34495e; font-size: 1.1rem; }
        
        .stock { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 15px; }

        /* Price Styling */
        .price-container { margin: 15px 0; }
        .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; }
        
        /* Blowout Styles */
        .card.blowout { border: 2px solid #e74c3c; }
        .card.blowout .price { color: #e74c3c; }
        .badge {
            position: absolute;
            top: 0;
            right: 0;
            background: #e74c3c;
            color: white;
            font-size: 0.8rem;
            padding: 5px 10px;
            border-bottom-left-radius: 8px;
            font-weight: bold;
        }
        .original-price {
            text-decoration: line-through;
            color: #95a5a6;
            font-size: 0.9rem;
            margin-right: 5px;
        }

        button { 
            background: #3498db; 
            color: white; 
            border: none; 
            padding: 12px; 
            cursor: pointer; 
            width: 100%; 
            font-size: 1rem; 
            font-weight: 600;
        }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .blowout button { background: #e74c3c; }
        .blowout button:hover { background: #c0392b; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>

      <div class="header-banner">
          <h2>\${greeting}</h2>
          \${isRacingFamily ? '<p>We found some bulk racing offers for the team!</p>' : ''}
      </div>

      \${isRacingFamily && racingGear.length > 0 
          ? \`<h3 class="section-title">🔥 Exclusive Team Blowout (Up to 60% Off)</h3>\` 
          : \`<h3 class="section-title">Shop Inventory</h3>\`
      }
      
      <div id="productGrid" class="grid">
        \${displayList.map(item => \`
            <div class="card \${item.isBlowout ? 'blowout' : ''}">
                \${item.isBlowout ? \`<div class="badge">SAVE \${item.savings}%</div>\` : ''}
                <div class="card-body">
                    <h3>\${item.name}</h3>
                    <p class="stock">
                        \${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}
                    </p>
                    
                    <div class="price-container">
                        \${item.isBlowout ? \`<span class="original-price">$\${(item.cost * 1.5).toFixed(2)}</span>\` : ''}
                        <span class="price">$\${item.displayPrice}</span>
                    </div>
                </div>
                <button 
                    class="buy-btn" 
                    data-id="\${item.id}"
                    \${item.stock <= 0 ? 'disabled' : ''}>
                    \${item.stock > 0 ? (item.isBlowout ? 'Claim Deal' : 'Add to Order') : 'Sold Out'}
                </button>
            </div>
        \`).join('')}
      </div>
    \`;

    // Add Event Listeners using delegation matches standard HomePage practice
    this.shadowRoot.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.dataset.id;
        const item = inventory.find(i => i.id === itemId);

        this.dispatchEvent(
          new CustomEvent('navigate-order', {
            detail: { item: item },
            bubbles: true,
            composed: true,
          })
        );
      });
    });
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-008.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-010',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-010.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const container = this.shadowRoot.getElementById('mainContainer');
    const header = this.shadowRoot.getElementById('personalHeader');
    
    // 1. Get Client Context for Personalization
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    let city = "Aspen"; // Default based on user profile context
    let isRacer = true; // Based on CRM context

    try {
        if(clientId) {
            const clientRes = await fetch(\`/api/clients/\${clientId}\`);
            if(clientRes.ok) {
                const clientData = await clientRes.json();
                city = clientData.city || city;
                // Check for racing keywords in history or CRM
                const notes = (clientData.crmNotes || []).join(' ').toLowerCase();
                if(notes.includes('racer') || notes.includes('racing')) {
                    isRacer = true;
                }
            }
        }
    } catch(e) {
        console.warn('Could not fetch specific client details, using defaults.');
    }

    // Update Greeting
    header.innerHTML = \`
        <h1>🏁 Piste Performance: \${city}</h1>
        <p>Expert edge tuning required. Hardpack conditions ahead.</p>
    \`;

    // 2. Fetch and Process Inventory
    container.innerHTML = '<p style="text-align:center">Calibrating inventory...</p>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Filter: Sort specifically for "Pro Racer/Hardpack" persona
      // We want World Cup Racer at the top (Blowout), followed by Carvers.
      // We push Big Mountain/Powder skis to the bottom.
      
      const heroItems = [];
      const standardItems = [];

      inventory.forEach(item => {
        const name = item.name.toLowerCase();
        
        // Logic: Identify the World Cup Racer for the Blowout Deal
        if (name.includes('world cup') || name.includes('racer')) {
            // Requirement: Price between 0.4 * COGS and 1.0 * COGS
            // We'll give them a steal at 0.7 (70% of cost)
            item.displayPrice = (item.cost * 0.7).toFixed(2);
            item.isBlowout = true;
            item.originalPrice = (item.cost * 1.5).toFixed(2);
            heroItems.push(item);
        } 
        else {
            // Standard Markup
            item.displayPrice = (item.cost * 1.5).toFixed(2);
            item.isBlowout = false;
            
            // Sort priority: Carvers first, others last
            if(name.includes('piste') || name.includes('carver')) {
                standardItems.unshift(item);
            } else {
                standardItems.push(item);
            }
        }
      });

      // Render Layout
      let html = '';

      // A. HERO SECTION (Blowout)
      if (heroItems.length > 0) {
        html += \`<div class="section-title">⚠️ PRO STOCK BLOWOUT</div>\`;
        html += heroItems.map(item => \`
            <div class="hero-card">
                <div class="hero-info">
                    <h3>\${item.name}</h3>
                    <p class="sku">SKU: \${item.sku} // RACING STOCK</p>
                    <p class="desc">Only for high-DIN skiers. Factory tuned.</p>
                    <div class="price-block">
                        <span class="old-price">$\${item.originalPrice}</span>
                        <span class="new-price">$\${item.displayPrice}</span>
                    </div>
                    <p class="stock-status">\${item.stock > 0 ? '✅ In Stock' : '❌ Sold Out'}</p>
                </div>
                <div class="hero-action">
                    <button 
                        class="buy-btn hero-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'SECURE PAIR' : 'GONE'}
                    </button>
                </div>
            </div>
        \`).join('');
      }

      // B. GRID SECTION (Standard Inventory)
      html += \`<div class="section-title">Groomer & Training Quiver</div>\`;
      html += \`<div class="grid">\`;
      html += standardItems.map(item => \`
        <div class="card">
            <h3>\${item.name}</h3>
            <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
            <p class="price">$\${item.displayPrice}</p>
            <button 
                class="buy-btn" 
                data-id="\${item.id}"
                \${item.stock <= 0 ? 'disabled' : ''}>
                \${item.stock > 0 ? 'Add to Cart' : 'Sold Out'}
            </button>
        </div>
      \`).join('');
      html += \`</div>\`;

      container.innerHTML = html;

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = '<p>Error loading pro inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.4s; color: #2c3e50; }
            
            /* Header Styling */
            #personalHeader {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: #ecf0f1;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 25px;
                border-left: 5px solid #e67e22;
            }
            #personalHeader h1 { margin: 0; font-size: 1.8rem; }
            #personalHeader p { margin: 5px 0 0 0; opacity: 0.8; font-style: italic; }

            /* Hero / Blowout Styles */
            .section-title {
                font-size: 1.2rem;
                font-weight: bold;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #7f8c8d;
                border-bottom: 2px solid #ddd;
                padding-bottom: 5px;
            }
            
            .hero-card {
                background: #fff;
                border: 2px solid #e74c3c; /* Red for alert/sale */
                border-radius: 8px;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                box-shadow: 0 4px 10px rgba(231, 76, 60, 0.2);
            }
            .hero-info h3 { margin: 0; font-size: 1.8rem; color: #c0392b; }
            .sku { font-family: monospace; color: #7f8c8d; font-size: 0.9rem; }
            .desc { font-style: italic; color: #2c3e50; }
            
            .price-block { margin: 10px 0; }
            .old-price { text-decoration: line-through; color: #95a5a6; margin-right: 10px; }
            .new-price { font-size: 1.5rem; font-weight: bold; color: #c0392b; }
            
            .hero-btn {
                background: #c0392b;
                font-size: 1.2rem;
                padding: 15px 30px;
            }
            .hero-btn:hover { background: #e74c3c; }

            /* Standard Grid Styles (matching existing look) */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; border-top: 3px solid #3498db; }
            .card h3 { margin: 0 0 10px 0; font-size: 1.1rem; }
            .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 15px; }
            
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-family: 'Segoe UI', sans-serif; transition: background 0.2s; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            /* Responsive layout for Hero */
            @media (max-width: 600px) {
                .hero-card { flex-direction: column; text-align: center; }
                .hero-action { width: 100%; margin-top: 15px; }
            }
        </style>

        <div id="personalHeader"></div>
        <div id="mainContainer"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-010.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-012',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-012.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.client = null;
  }

  async connectedCallback() {
    // 1. Fetch Client Data specific to this session to personalize the page
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    
    if (clientId) {
      try {
        const res = await fetch(\`/api/clients/\${clientId}\`);
        this.client = await res.json();
      } catch (e) {
        console.error("Failed to fetch client profile", e);
      }
    }

    this.render(); // Render structure
    this.loadInventory(); // Fetch and populate data
  }

  async loadInventory() {
    const container = this.shadowRoot.getElementById('mainContainer');
    container.innerHTML = '<p class="loading">Loading your personalized gear selection...</p>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();
      
      // --- PERSONALIZATION LOGIC ---

      // 1. Analyze History for Racing Gear
      const pastPurchases = this.client?.pastPurchases || [];
      const hasRacingHistory = pastPurchases.some(p => 
        p.includes('Racer') || p.includes('World Cup') || p.includes('Speed')
      );

      // 2. Filter Inventory Categories
      const racingItems = [];
      const comfortItems = [];
      const standardItems = [];

      inventory.forEach(item => {
        const lowerName = item.name.toLowerCase();
        
        // Identify Racing Gear
        if (lowerName.includes('racer') || lowerName.includes('world cup')) {
          racingItems.push(item);
        } 
        // Identify "Lodge/Apres" gear (Heated items, socks, gloves) based on CRM notes
        else if (lowerName.includes('heated') || lowerName.includes('glove') || lowerName.includes('sock') || lowerName.includes('boot')) {
          comfortItems.push(item);
        } 
        // Everything else
        else {
          standardItems.push(item);
        }
      });

      // --- RENDER LOGIC ---
      
      let html = '';

      // SECTION 1: SALES BLOWOUT (Only if user has racing history)
      if (hasRacingHistory && racingItems.length > 0) {
        html += \`<h2 class="section-title blowout-title">🔥 VIP RACE BLOWOUT</h2>\`;
        html += \`<div class="grid">\`;
        html += racingItems.map(item => this.createProductCard(item, 'blowout')).join('');
        html += \`</div>\`;
      }

      // SECTION 2: LODGE & APRES ESSENTIALS (Targeted for Digital Nomad/Comfort)
      if (comfortItems.length > 0) {
        html += \`<h2 class="section-title">🏔️ Lodge & Apres-Ski Essentials</h2>\`;
        html += \`<p class="subtitle">Stay warm while you work from the lodge.</p>\`;
        html += \`<div class="grid">\`;
        html += comfortItems.map(item => this.createProductCard(item, 'standard')).join('');
        html += \`</div>\`;
      }

      // SECTION 3: ALL MOUNTAIN GEAR
      html += \`<h2 class="section-title">All Mountain Gear</h2>\`;
      html += \`<div class="grid">\`;
      html += standardItems.map(item => this.createProductCard(item, 'standard')).join('');
      html += \`</div>\`;

      container.innerHTML = html;
      this.attachListeners(inventory);

    } catch (e) {
      console.error(e);
      container.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  // Helper to calculate price and generate HTML for a card
  createProductCard(item, type) {
    let price = item.cost * 1.5;
    let priceDisplay = \`$\${price.toFixed(2)}\`;
    let cardClass = 'card';
    let badge = '';

    // DYNAMIC PRICING LOGIC FOR BLOWOUT
    if (type === 'blowout') {
      // Logic: Between 0.4 * COGS and 1.0 * COGS
      const discountFactor = 0.4 + (Math.random() * 0.6); // Random between 0.4 and 1.0
      price = item.cost * discountFactor;
      
      // Formatting for the sale look
      priceDisplay = \`
        <span class="old-price">$\${(item.cost * 1.5).toFixed(2)}</span>
        <span class="sale-price">$\${price.toFixed(2)}</span>
      \`;
      cardClass += ' blowout-card';
      badge = '<div class="badge">VIP OFFER</div>';
    }

    return \`
      <div class="\${cardClass}">
          \${badge}
          <h3>\${item.name}</h3>
          <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
          <div class="price-container">\${priceDisplay}</div>
          <button 
              class="buy-btn \${type === 'blowout' ? 'btn-urgent' : ''}" 
              data-id="\${item.id}"
              data-price="\${price}" 
              \${item.stock <= 0 ? 'disabled' : ''}>
              \${item.stock > 0 ? (type === 'blowout' ? 'Claim Deal' : 'Add to Order') : 'Sold Out'}
          </button>
      </div>
    \`;
  }

  attachListeners(inventory) {
    this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.dataset.id;
        // Note: We use the calculated price attached to the button or the default logic? 
        // The App's OrderPage recalculates price usually, but for dynamic pricing, 
        // we might need to handle it. For this display task, we dispatch the item object.
        // We will modify the item object cost temporarily to reflect the sale price for the order page.
        
        let item = {...inventory.find((i) => i.id === itemId)};
        
        // If it's a dynamic price, we override the cost calculation expectation
        // Since OrderPage uses (cost * 1.5), we reverse engineer or pass a custom prop if App supported it.
        // Since we cannot change OrderPage, we update the 'cost' of the object passed 
        // so that (cost * 1.5) equals our specific sale price, OR we rely on the 
        // visual presentation here and standard billing there. 
        // *However*, to ensure the OrderPage shows the right price without changing OrderPage code:
        // We will pass the item as is. The prompt asks to "Highlight Sales Blowout", 
        // strictly speaking presentation.
        
        this.dispatchEvent(
          new CustomEvent('navigate-order', {
            detail: { item: item },
            bubbles: true,
            composed: true,
          })
        );
      });
    });
  }

  render() {
    const city = this.client?.city || 'the Slopes';
    const isNomad = this.client?.crmNotes?.some(n => n.toLowerCase().includes('nomad'));
    
    // Personalized Greeting
    let greeting = \`Welcome back to \${city}!\`;
    let subGreeting = "Gear up for your next adventure.";
    
    if (isNomad) {
      greeting = \`Work Hard, Ski Hard in \${city}.\`;
      subGreeting = "We noticed you're working from the lodge. Check out our heated gear below.";
    }

    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Header Styling */
        .welcome-header { background: #ecf0f1; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #2c3e50; }
        .welcome-header h1 { margin: 0; color: #2c3e50; font-size: 1.5rem; }
        .welcome-header p { margin: 5px 0 0 0; color: #7f8c8d; }

        /* Grid Layout */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; margin-bottom: 40px; }
        
        /* Typography */
        .section-title { border-bottom: 2px solid #ddd; padding-bottom: 10px; margin-top: 30px; color: #2c3e50; }
        .blowout-title { color: #c0392b; border-color: #c0392b; }
        .subtitle { color: #555; font-style: italic; margin-top: -10px; margin-bottom: 20px; }

        /* Cards */
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); position: relative; display: flex; flex-direction: column; justify-content: space-between; height: 100%; box-sizing: border-box; }
        .card h3 { margin: 10px 0; color: #2c3e50; font-size: 1.1rem; }
        .stock { color: #7f8c8d; font-size: 0.85rem; }
        
        /* Prices */
        .price-container { margin: 15px 0; font-size: 1.2rem; font-weight: bold; color: #2c3e50; }
        .old-price { text-decoration: line-through; color: #95a5a6; font-size: 0.9rem; margin-right: 10px; }
        .sale-price { color: #e74c3c; font-size: 1.4rem; }

        /* Blowout Specifics */
        .blowout-card { border: 2px solid #e74c3c; background: #fff5f5; }
        .badge { position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

        /* Buttons (iPad friendly size) */
        button { background: #3498db; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; margin-top: auto; min-height: 44px; transition: background 0.2s; }
        button:hover { background: #2980b9; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        .btn-urgent { background: #e74c3c; font-weight: bold; }
        .btn-urgent:hover { background: #c0392b; }

        .loading { text-align: center; color: #7f8c8d; font-style: italic; padding: 40px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>

      <div class="welcome-header">
        <h1>\${greeting}</h1>
        <p>\${subGreeting}</p>
      </div>

      <div id="mainContainer"></div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-012.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-014',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-014.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    const hero = this.shadowRoot.getElementById('heroSection');
    
    grid.innerHTML = '<div class="loading">Loading your personalized selection...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // 1. Logic: Identify the "Blowout" item (World Cup Racer)
      // Task Requirement: Price between 0.4 * COGS and 1.0 * COGS
      const racingSki = inventory.find(i => i.name === 'World Cup Racer');
      
      // 2. Logic: Filter the rest of the inventory
      // Persona: Vancouver based, 100+ days/year, "Prioritizes comfort".
      // We filter out the racer from the main grid and prioritize Powder/All Mountain.
      let standardItems = inventory.filter(i => i.name !== 'World Cup Racer');
      
      // Sort logic: Move 'Deep Powder' and 'All Mountain' to the top for Vancouver conditions
      standardItems.sort((a, b) => {
        const priorityKeywords = ['Deep Powder', 'All Mountain', 'Comfort'];
        const aPriority = priorityKeywords.some(k => a.name.includes(k));
        const bPriority = priorityKeywords.some(k => b.name.includes(k));
        return bPriority - aPriority;
      });

      // --- RENDER HERO SECTION (The Blowout Deal) ---
      if (racingSki && racingSki.stock > 0) {
        // Calculate dynamic blowout price (0.4 to 1.0 of COGS)
        const randomFactor = 0.4 + Math.random() * 0.6;
        const blowoutPrice = (racingSki.cost * randomFactor).toFixed(2);

        hero.innerHTML = \`
          <div class="blowout-card">
            <div class="blowout-tag">🔥 RACING BLOWOUT</div>
            <div class="blowout-content">
              <div>
                <h3>\${racingSki.name}</h3>
                <p>Since you're a fan of the track, we've unlocked a warehouse deal just for you.</p>
                <div class="price-row">
                  <span class="old-price">$\${(racingSki.cost * 1.5).toFixed(2)}</span>
                  <span class="new-price">$\${blowoutPrice}</span>
                </div>
              </div>
              <button class="buy-btn blowout-btn" data-id="\${racingSki.id}">
                Grab This Deal
              </button>
            </div>
          </div>
        \`;
      } else {
        hero.style.display = 'none';
      }

      // --- RENDER MAIN GRID (Comfort & Standard items) ---
      grid.innerHTML = standardItems
        .map((item) => {
          // Standard markup per existing codebase reference (1.5x)
          // Unless it's other racing gear, but for simplicity/safety we use standard markup
          // to highlight the contrast with the blowout deal.
          const price = (item.cost * 1.5).toFixed(2);
          const isComfort = item.name.includes('Explorer') || item.name.includes('Powder');

          return \`
            <div class="card \${isComfort ? 'highlight-comfort' : ''}">
                \${isComfort ? '<div class="badge">Recommended for Comfort</div>' : ''}
                <h3>\${item.name}</h3>
                <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
                <p class="price">$\${price}</p>
                <button 
                    class="buy-btn" 
                    data-id="\${item.id}"
                    \${item.stock <= 0 ? 'disabled' : ''}>
                    \${item.stock > 0 ? 'Add to Order' : 'Sold Out'}
                </button>
            </div>
          \`;
        })
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    } catch (e) {
      grid.innerHTML = '<p class="loading">Unable to load inventory at this time.</p>';
      console.error(e);
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Personal Header */
        .welcome-banner {
          background: linear-gradient(135deg, #2c3e50, #34495e);
          color: white;
          padding: 25px;
          border-radius: 8px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .welcome-text h2 { margin: 0; font-size: 1.5rem; }
        .welcome-text p { margin: 5px 0 0 0; opacity: 0.9; }
        .coffee-icon { font-size: 2.5rem; background: rgba(255,255,255,0.1); padding: 10px; border-radius: 50%; }

        /* Hero / Blowout Section */
        .blowout-card {
          background: white;
          border: 2px solid #e74c3c;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 30px;
          box-shadow: 0 4px 15px rgba(231, 76, 60, 0.2);
        }
        .blowout-tag {
          background: #e74c3c;
          color: white;
          font-weight: bold;
          text-align: center;
          padding: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .blowout-content {
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }
        .old-price { text-decoration: line-through; color: #7f8c8d; margin-right: 10px; }
        .new-price { font-size: 1.8rem; color: #e74c3c; font-weight: bold; }
        .blowout-btn { background: #e74c3c !important; font-weight: bold; font-size: 1.1rem; padding: 12px 25px !important; }
        .blowout-btn:hover { background: #c0392b !important; }

        /* Standard Grid */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        .card { 
          background: white; 
          padding: 20px; 
          border-radius: 8px; 
          box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
          display: flex; 
          flex-direction: column; 
          position: relative;
          transition: transform 0.2s;
        }
        .card:hover { transform: translateY(-2px); }
        .card h3 { margin: 10px 0 5px 0; color: #2c3e50; font-size: 1.1rem; }
        .badge {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: #27ae60;
          color: white;
          font-size: 0.7rem;
          padding: 4px 8px;
          border-radius: 10px;
          white-space: nowrap;
        }
        
        .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; margin-top: auto; padding-top: 10px; }
        .stock { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 15px; }
        
        button { background: #3498db; color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px; font-size: 0.95rem; }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .loading { text-align: center; color: #7f8c8d; padding: 40px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      </style>

      <!-- Personalized Greeting -->
      <div class="welcome-banner">
        <div class="welcome-text">
          <h2>Welcome back to the shop!</h2>
          <p>Fresh powder in Vancouver? We've got a fresh pot of coffee ready for you.</p>
        </div>
        <div class="coffee-icon">☕</div>
      </div>

      <!-- Dynamic Hero Section -->
      <div id="heroSection"></div>

      <!-- Standard Inventory -->
      <h3 style="color:#2c3e50; border-bottom: 1px solid #ddd; padding-bottom:10px;">Curated for your Comfort</h3>
      <div id="productGrid" class="grid"></div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-014.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-016',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-016.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    const greetingEl = this.shadowRoot.getElementById('personalGreeting');
    
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading personalized gear...</div>';

    try {
      // 1. Access Global State (client profile)
      const client = window.state?.clientProfile || {};
      const crmNotes = (client.crmNotes || []).join(' ').toLowerCase();
      const city = client.city || 'Unknown';

      // 2. Fetch Data (Inventory and History to determine preferences)
      const [invRes, orderRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(\`/api/orders?clientId=\${window.state?.clientId}\`)
      ]);
      
      const inventory = await invRes.json();
      const orders = await orderRes.json();

      // 3. Analyze History for "Racing" Logic
      // Check if user has bought racing gear previously
      const hasRacingHistory = orders.some(order => 
        order.items.some(i => i.skuId.toLowerCase().includes('race') || i.skuId.toLowerCase().includes('world cup'))
      );

      // 4. Personalize Greeting
      let greeting = \`Welcome to the shop, \${client.id}!\`;
      if (city === 'Whistler') {
        if (crmNotes.includes('photographer')) {
          greeting = \`Ready for your next photo shoot in Whistler?\`;
        } else {
          greeting = \`Fresh powder in Whistler awaits!\`;
        }
      }
      greetingEl.textContent = greeting;

      // 5. Process Inventory (Sort & Price)
      const processedInventory = inventory.map(item => {
        const isRacing = item.name.toLowerCase().includes('world cup') || item.name.toLowerCase().includes('racer');
        const isRugged = item.name.toLowerCase().includes('backcountry') || item.name.toLowerCase().includes('mountain') || item.name.toLowerCase().includes('explorer');
        
        let price = item.cost * 1.5; // Standard markup
        let isBlowout = false;
        let note = "";

        // PRICING LOGIC: Racing Blowout
        if (isRacing && hasRacingHistory) {
          // Dynamic price between 0.4 and 1.0 * COGS
          const factor = 0.4 + (Math.random() * 0.6);
          price = item.cost * factor;
          isBlowout = true;
          note = "🏆 WORLD CUP BLOWOUT";
        }

        // RECOMMENDATION LOGIC: Adventure/Rugged
        if (crmNotes.includes('rugged') || crmNotes.includes('heavy') || crmNotes.includes('photographer')) {
            if (isRugged) {
                note = "💪 RUGGED & STABLE CHOICE";
            }
        }

        return {
          ...item,
          displayPrice: price.toFixed(2),
          isBlowout,
          isRugged,
          displayNote: note
        };
      });

      // Sort: Rugged/Recommended first, then Racing Blowouts, then rest
      processedInventory.sort((a, b) => {
        // Prioritize rugged gear for this specific persona
        if (a.displayNote.includes('RUGGED') && !b.displayNote.includes('RUGGED')) return -1;
        if (!a.displayNote.includes('RUGGED') && b.displayNote.includes('RUGGED')) return 1;
        return 0;
      });

      // 6. Render Grid
      grid.innerHTML = processedInventory
        .map(item => \`
            <div class="card \${item.isBlowout ? 'blowout-card' : ''} \${item.isRugged ? 'recommended-card' : ''}">
                \${item.displayNote ? \`<div class="badge">\${item.displayNote}</div>\` : ''}
                <h3>\${item.name}</h3>
                <p class="sku">SKU: \${item.sku}</p>
                <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
                
                <p class="price \${item.isBlowout ? 'blowout-price' : ''}">
                  $\${item.displayPrice}
                </p>
                
                \${item.isBlowout ? '<p class="urgency">⚠️ Limited Time Offer</p>' : ''}

                <button 
                    class="buy-btn" 
                    data-id="\${item.id}"
                    \${item.stock <= 0 ? 'disabled' : ''}>
                    \${item.stock > 0 ? 'Add to Kit' : 'Sold Out'}
                </button>
            </div>
        \`)
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const originalItem = inventory.find((i) => i.id === itemId);
          
          // Determine price used (re-calculate or pull from logic above)
          // For simplicity in this mock, we pass the object. 
          // Note: In a real app, price should be validated server-side.
          
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: originalItem }, // Passing original item, OrderPage handles base logic
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p>Unable to load equipment inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            
            /* Layout */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
                gap: 20px; 
                margin-top: 20px;
            }
            
            /* Card Base */
            .card { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
                text-align: center; 
                font-family: 'Segoe UI', sans-serif; 
                position: relative;
                border: 1px solid #eee;
                transition: transform 0.2s;
            }
            .card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }

            /* Typography */
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block; }
            .card h3 { margin: 10px 0 5px 0; color: #2c3e50; font-size: 1.1rem; }
            .sku { font-size: 0.8rem; color: #aaa; margin: 0; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            
            /* Pricing */
            .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; margin: 10px 0; }
            .blowout-price { color: #e74c3c; font-size: 1.6rem; text-decoration: underline; }
            .urgency { color: #e74c3c; font-weight: bold; font-size: 0.8rem; animation: pulse 1.5s infinite; }

            /* Badges */
            .badge {
                background: #2c3e50;
                color: white;
                font-size: 0.7rem;
                padding: 4px 8px;
                border-radius: 4px;
                display: inline-block;
                margin-bottom: 5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Personalized Styles */
            .recommended-card { border: 2px solid #27ae60; background: #f9fff9; }
            .recommended-card .badge { background: #27ae60; }
            
            .blowout-card { border: 2px solid #e74c3c; background: #fff5f5; }
            .blowout-card .badge { background: #e74c3c; }

            /* Button */
            button { 
                background: #3498db; 
                color: white; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: 600;
            }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            
            .recommended-card button { background: #27ae60; }
            .recommended-card button:hover { background: #219150; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        </style>

        <h2 id="personalGreeting">Welcome</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-016.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-018',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-018.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.clientId = new URLSearchParams(window.location.search).get('clientId');
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const container = this.shadowRoot.getElementById('content-area');
    const greetingEl = this.shadowRoot.getElementById('greeting');
    
    container.innerHTML = '<div class="loading">Personalizing your shop experience...</div>';

    try {
      // 1. Fetch Client Profile & History parallel to Inventory
      const [inventoryRes, clientRes, ordersRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(\`/api/clients/\${this.clientId}\`),
        fetch(\`/api/orders?clientId=\${this.clientId}\`)
      ]);

      const inventory = await inventoryRes.json();
      const client = await clientRes.json();
      const orders = await ordersRes.json();

      // 2. Analyze User Persona
      const city = client.city || 'Skier';
      
      // Flatten order items into a single array of item names for history checking
      const pastGear = orders.flatMap(o => o.items.map(i => i.name || ''));
      
      // Check for specific personas based on history
      const hasRacingHistory = pastGear.some(name => 
        name.toLowerCase().includes('race') || 
        name.toLowerCase().includes('world cup') ||
        name.toLowerCase().includes('carver') // Including 'Carver' based on profile context
      );

      // Check CRM notes for keywords
      const crmNotes = client.crmNotes || [];
      const needsVersatile = crmNotes.some(note => note.toLowerCase().includes('versatile'));
      const isWeekendWarrior = crmNotes.some(note => note.toLowerCase().includes('weekend'));

      // 3. Set Personalized Greeting
      // If "Weekend warrior" is in notes, reference the weekend. Otherwise default to City/Trip logic.
      if (isWeekendWarrior) {
        greetingEl.textContent = \`Hello, \${city}! Ready for the weekend?\`;
      } else {
        greetingEl.textContent = \`Welcome back to the slopes, \${city}!\`;
      }

      // 4. Filter & Sort Inventory
      // Split inventory into "Featured/Personalized" and "Sales/Other"
      let primaryList = [];
      let secondaryList = [];

      inventory.forEach(item => {
        const isRacingSki = item.name.toLowerCase().includes('world cup') || item.name.toLowerCase().includes('racer');
        const isVersatile = item.name.toLowerCase().includes('all mountain') || item.name.toLowerCase().includes('explorer');
        
        // --- PRICING LOGIC ---
        let finalPrice;
        let priceLabel = '';
        let isSale = false;

        if (isRacingSki) {
          if (hasRacingHistory) {
            // REQUIREMENT: Dynamic price 0.4 - 1.0 * COGS for Racing History
            const dynamicFactor = Math.random() * (1.0 - 0.4) + 0.4;
            finalPrice = item.cost * dynamicFactor;
            priceLabel = 'VIP BLOWOUT';
            isSale = true;
          } else {
            // CONSTRAINT: Racing gear at ~120% COGS for others
            finalPrice = item.cost * 1.2;
            priceLabel = 'Sales Blowout';
            isSale = true;
          }
        } else {
          // Standard Markup
          finalPrice = item.cost * 1.5;
        }

        const itemData = { ...item, finalPrice, priceLabel, isSale };

        // --- SORTING LOGIC ---
        // If user needs versatile gear, prioritize All Mountain
        if (needsVersatile && isVersatile) {
          primaryList.push(itemData);
        } else if (isRacingSki) {
          // Always highlight sales/racing gear
          secondaryList.unshift(itemData);
        } else {
          secondaryList.push(itemData);
        }
      });

      // Combine lists, putting personalized picks first
      const sortedInventory = [...primaryList, ...secondaryList];

      // 5. Render Grid
      container.innerHTML = sortedInventory
        .map(item => \`
          <div class="card \${item.isSale ? 'sale-card' : ''}">
            \${item.isSale ? \`<div class="badge">\${item.priceLabel}</div>\` : ''}
            <h3>\${item.name}</h3>
            <p class="sku">SKU: \${item.id}</p>
            
            <div class="price-block">
              \${item.isSale 
                ? \`<span class="old-price">$\${(item.cost * 1.5).toFixed(0)}</span>\` 
                : ''}
              <span class="price">$\${item.finalPrice.toFixed(2)}</span>
            </div>

            <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
            
            <button 
              class="buy-btn \${item.isSale ? 'btn-sale' : ''}" 
              data-id="\${item.id}"
              \${item.stock <= 0 ? 'disabled' : ''}>
              \${item.stock > 0 ? (item.isSale ? 'Grab Deal' : 'Buy Now') : 'Sold Out'}
            </button>
          </div>
        \`)
        .join('');

      // Add Event Listeners
      container.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);
          
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = '<p class="error">Unable to load your personalized shop. Please try again.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Layout Structure */
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block; }
        .greeting-box { background: #dff9fb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #3498db; color: #2c3e50; font-size: 1.1rem; font-weight: 600; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 25px; }
        
        /* Card Styles */
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; transition: transform 0.2s; display: flex; flex-direction: column; justify-content: space-between; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
        
        /* Sale Specifics */
        .sale-card { border: 2px solid #e74c3c; background: #fff5f5; }
        .badge { position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 5px 10px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        
        /* Typography */
        h3 { margin: 10px 0 5px 0; color: #2c3e50; font-size: 1.2rem; }
        .sku { font-size: 0.75rem; color: #95a5a6; margin: 0; }
        .stock { color: #7f8c8d; font-size: 0.9rem; margin: 10px 0 15px 0; }
        
        /* Pricing */
        .price-block { margin: 10px 0; }
        .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; }
        .old-price { text-decoration: line-through; color: #95a5a6; font-size: 0.9rem; margin-right: 8px; }
        .sale-card .price { color: #c0392b; }
        
        /* Buttons */
        button { background: #3498db; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 1rem; font-weight: 600; transition: background 0.2s; }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .btn-sale { background: #e74c3c; }
        .btn-sale:hover { background: #c0392b; }

        .loading { padding: 40px; text-align: center; color: #7f8c8d; font-style: italic; }
        .error { color: #c0392b; text-align: center; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="greeting-box" id="greeting">Welcome!</div>
      <div id="content-area" class="grid"></div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-018.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
  {
    hash: '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
    clientId: 'CLIENT-020',
    pageType: 'home',
    prompt: `TASK: Verify the external confidence of the generated custom home page.

CONTEXT:
We have generated a personalized LitElement component for a high-value client to replace the default home page.
We need to verify that this component is safe, syntactically correct, and maintains the core functionality of the default page while applying the requested personalization.

--- DEFAULT IMPLEMENTATION (Reference) ---
File: examples/ski-shop/public/components/homePage.js
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = 'Loading inventory...';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        \`;
  }
}

customElements.define('home-page', HomePage);

----------------------------------------

--- GENERATED VARIATION (To Verify) ---
File: homePage-CLIENT-020.js
Content:
class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Access global state for immediate personalization
    const client = window.state?.clientProfile || {};
    this.render(client);
    this.loadInventory(client);
  }

  async loadInventory(client) {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = '<p>Finding the lightest gear for your next Strava run...</p>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // 1. Analyze User History for "Racing" or "Nordic" affinity
      // We assume client.pastPurchases is an array of strings based on the prompt context
      // Broadening check to include 'Nordic' to capture this specific user's history
      const pastPurchases = client.pastPurchases || ['Nordic Cross']; 
      const hasRacingHistory = pastPurchases.some(p => 
        p.toLowerCase().includes('racing') || p.toLowerCase().includes('nordic')
      );

      // 2. Filter & Sort for Persona
      // Priority: "World Cup Racer" (Lightest/Nordic) -> "Nordic" -> Others
      const sortedInventory = inventory.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        
        // Prioritize World Cup Racer for this persona
        if (aName.includes('world cup racer')) return -1;
        if (bName.includes('world cup racer')) return 1;
        
        // Then prioritize Nordic/Cross
        const aIsNordic = aName.includes('nordic') || aName.includes('cross');
        const bIsNordic = bName.includes('nordic') || bName.includes('cross');
        
        if (aIsNordic && !bIsNordic) return -1;
        if (!aIsNordic && bIsNordic) return 1;
        
        return 0;
      });

      // 3. Render Items with Pricing Logic
      grid.innerHTML = sortedInventory.map(item => {
        const isRacingSki = item.name.toLowerCase().includes('world cup racer');
        
        let finalPrice = item.cost * 1.5; // Default Markup
        let isBlowout = false;

        // Apply "Sales Blowout" logic
        if (isRacingSki && hasRacingHistory) {
          // Dynamic price between 0.4 * COGS and 1.0 * COGS
          const multiplier = Math.random() * (1.0 - 0.4) + 0.4;
          finalPrice = item.cost * multiplier;
          isBlowout = true;
        }

        return \`
          <div class="card \${isBlowout ? 'blowout-card' : ''}">
            \${isBlowout ? '<div class="badge">🔥 STRAVA PR MAKER</div>' : ''}
            <h3>\${item.name}</h3>
            
            <p class="desc">
              \${isRacingSki 
                ? 'Ultralight construction. Perfect for your Banff trails.' 
                : 'Standard reliability for casual days.'}
            </p>

            <p class="stock">\${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
            
            <div class="price-container">
              \${isBlowout 
                ? \`<span class="old-price">$\${(item.cost * 1.5).toFixed(2)}</span>\` 
                : ''}
              <span class="price \${isBlowout ? 'blowout-price' : ''}">$\${finalPrice.toFixed(2)}</span>
            </div>

            <button 
              class="buy-btn \${isBlowout ? 'btn-blowout' : ''}" 
              data-id="\${item.id}"
              \${item.stock <= 0 ? 'disabled' : ''}>
              \${isBlowout ? 'Grab Deal' : (item.stock > 0 ? 'Buy Now' : 'Sold Out')}
            </button>
          </div>
        \`;
      }).join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find(i => i.id === itemId);
          
          this.dispatchEvent(new CustomEvent('navigate-order', {
            detail: { item: item },
            bubbles: true,
            composed: true
          }));
        });
      });

    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p>Error loading your personalized selection.</p>';
    }
  }

  render(client) {
    const city = client.city || 'Banff';
    
    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        .welcome-banner {
          background: linear-gradient(135deg, #2c3e50, #3498db);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .welcome-banner h2 { margin: 0 0 5px 0; }
        .welcome-banner p { margin: 0; opacity: 0.9; font-style: italic; }

        .grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
          gap: 20px; 
        }

        .card { 
          background: white; 
          padding: 20px; 
          border-radius: 8px; 
          box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
          text-align: center; 
          position: relative;
          transition: transform 0.2s;
          border: 1px solid #eee;
        }

        /* Personalized Highlight Style */
        .blowout-card {
          border: 2px solid #e74c3c;
          background: #fff9f9;
          transform: scale(1.02);
        }

        .badge {
          position: absolute;
          top: -10px;
          right: -10px;
          background: #e74c3c;
          color: white;
          padding: 5px 10px;
          font-size: 0.8rem;
          font-weight: bold;
          border-radius: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          animation: pulse 2s infinite;
        }

        .card h3 { margin: 10px 0; color: #2c3e50; }
        .desc { font-size: 0.85rem; color: #7f8c8d; margin-bottom: 15px; min-height: 40px; }
        .stock { color: #95a5a6; font-size: 0.8rem; margin-bottom: 10px; }

        .price-container { margin-bottom: 15px; }
        .price { font-size: 1.3rem; color: #2c3e50; font-weight: bold; }
        .blowout-price { color: #e74c3c; font-size: 1.5rem; }
        .old-price { text-decoration: line-through; color: #bdc3c7; margin-right: 10px; font-size: 0.9rem; }

        button { 
          background: #3498db; 
          color: white; 
          border: none; 
          padding: 12px; 
          border-radius: 5px; 
          cursor: pointer; 
          width: 100%; 
          font-weight: bold; 
        }
        button:hover { background: #2980b9; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        
        .btn-blowout { background: #e74c3c; }
        .btn-blowout:hover { background: #c0392b; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
      </style>

      <div class="welcome-banner">
        <h2>Ready for the \${city} trails?</h2>
        <p>"Lightest possible nordic setup" — We found exactly what you need to crush your Strava segments.</p>
      </div>

      <div id="productGrid" class="grid"></div>
    \`;
  }
}

customElements.define('home-page', HomePage);
----------------------------------------

INSTRUCTIONS:
1. Analyze the "Generated Variation" against the "Default Implementation".
2. Check for syntax errors, missing imports, or broken logic.
3. Verify that the personalized view still renders a functional page.
4. Most importantly, ensure that none of the external API call logic is broken, so user can still add items to cart and complete purchases.
5. Provide two confidence scores (High/Medium/Low) that represent your assessment along with a brief justification for why each score was chosen.
5a. functionalEquivalencyConfidence -- confidence that the page is functionally equivalent to the default homePage.js provided, irrespective of broader issues with the original page
5b. productionReadinessConfidence -- confidence that the page is ready to be deployed in production without causing issues for users or the business
6. Return results in the form of a JSON object like below so it can be programatically accesssed.

{
  "homePage-CLIENT-020.js": { 
    "functionalEquivalencyConfidence": "<VALUE (High / Medium / Low )>",
    "functionalEquivalencyJustifcation": "<Justifcation for why value above was chosen>",
    "productionReadinessConfidence": "<VALUE>",
    "productionReadinessJustification": "<Justifcation for why value above was chosen>",
  }
}`,
  },
];

export default verifyExternalConfidenceResults;
