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
    container.innerHTML = `
      <style>
        :host { display: block; font-family: 'Segoe UI', sans-serif; padding: 20px; }
        .loading { color: #7f8c8d; font-size: 1.2rem; text-align: center; }
      </style>
      <div class="loading">Loading personalized experience...</div>
    `;

    try {
      // 2. Parallel fetch: Client Profile & Inventory
      const [clientRes, invRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch('/api/inventory'),
      ]);

      const client = await clientRes.json();
      const inventory = await invRes.json();

      this.render(client, inventory);
    } catch (e) {
      container.innerHTML = `<p>Error loading data. Please try again.</p>`;
      console.error(e);
    }
  }

  render(client, inventory) {
    // --- PERSONA LOGIC ---

    // Check CRM notes for racing/family interests
    const crmNotes = client.crmNotes || [];
    const notesString = crmNotes.join(' ').toLowerCase();
    const isRacingFamily =
      notesString.includes('racing') || notesString.includes('team');

    // Greeting Logic
    const city = client.city || 'Salt Lake City'; // Default to user profile context
    const greeting = `Welcome back to ${city}! Getting the family ready for the season?`;

    // --- INVENTORY PROCESSING ---

    // 1. Separate Racing Gear from Standard Gear
    const racingGear = [];
    const standardGear = [];

    inventory.forEach((item) => {
      const isRacerItem =
        item.name.includes('World Cup') || item.name.includes('Racer');

      if (isRacerItem && isRacingFamily) {
        // --- PRICING STRATEGY: SALES BLOWOUT ---
        // Constraint: Random between 0.4 * COGS and 1.0 * COGS
        const min = item.cost * 0.4;
        const max = item.cost * 1.0;
        const dynamicPrice = (Math.random() * (max - min) + min).toFixed(2);

        // Add specific visual flag
        item.displayPrice = dynamicPrice;
        item.isBlowout = true;
        item.savings = Math.floor(
          ((item.cost * 1.5 - dynamicPrice) / (item.cost * 1.5)) * 100
        );
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

    this.shadowRoot.innerHTML = `
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
          <h2>${greeting}</h2>
          ${
            isRacingFamily
              ? '<p>We found some bulk racing offers for the team!</p>'
              : ''
          }
      </div>

      ${
        isRacingFamily && racingGear.length > 0
          ? `<h3 class="section-title">🔥 Exclusive Team Blowout (Up to 60% Off)</h3>`
          : `<h3 class="section-title">Shop Inventory</h3>`
      }
      
      <div id="productGrid" class="grid">
        ${displayList
          .map(
            (item) => `
            <div class="card ${item.isBlowout ? 'blowout' : ''}">
                ${
                  item.isBlowout
                    ? `<div class="badge">SAVE ${item.savings}%</div>`
                    : ''
                }
                <div class="card-body">
                    <h3>${item.name}</h3>
                    <p class="stock">
                        ${
                          item.stock > 0
                            ? 'In Stock: ' + item.stock
                            : 'Out of Stock'
                        }
                    </p>
                    
                    <div class="price-container">
                        ${
                          item.isBlowout
                            ? `<span class="original-price">$${(
                                item.cost * 1.5
                              ).toFixed(2)}</span>`
                            : ''
                        }
                        <span class="price">$${item.displayPrice}</span>
                    </div>
                </div>
                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${
                      item.stock > 0
                        ? item.isBlowout
                          ? 'Claim Deal'
                          : 'Add to Order'
                        : 'Sold Out'
                    }
                </button>
            </div>
        `
          )
          .join('')}
      </div>
    `;

    // Add Event Listeners using delegation matches standard HomePage practice
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
}

customElements.define('home-page', HomePage);
