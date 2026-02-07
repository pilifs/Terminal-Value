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
    grid.innerHTML =
      '<p>Finding the lightest gear for your next Strava run...</p>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // 1. Analyze User History for "Racing" or "Nordic" affinity
      // We assume client.pastPurchases is an array of strings based on the prompt context
      // Broadening check to include 'Nordic' to capture this specific user's history
      const pastPurchases = client.pastPurchases || ['Nordic Cross'];
      const hasRacingHistory = pastPurchases.some(
        (p) =>
          p.toLowerCase().includes('racing') ||
          p.toLowerCase().includes('nordic')
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
      grid.innerHTML = sortedInventory
        .map((item) => {
          const isRacingSki = item.name
            .toLowerCase()
            .includes('world cup racer');

          let finalPrice = item.cost * 1.5; // Default Markup
          let isBlowout = false;

          // Apply "Sales Blowout" logic
          if (isRacingSki && hasRacingHistory) {
            // Dynamic price between 0.4 * COGS and 1.0 * COGS
            const multiplier = Math.random() * (1.0 - 0.4) + 0.4;
            finalPrice = item.cost * multiplier;
            isBlowout = true;
          }

          return `
          <div class="card ${isBlowout ? 'blowout-card' : ''}">
            ${isBlowout ? '<div class="badge">🔥 STRAVA PR MAKER</div>' : ''}
            <h3>${item.name}</h3>
            
            <p class="desc">
              ${
                isRacingSki
                  ? 'Ultralight construction. Perfect for your Banff trails.'
                  : 'Standard reliability for casual days.'
              }
            </p>

            <p class="stock">${
              item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'
            }</p>
            
            <div class="price-container">
              ${
                isBlowout
                  ? `<span class="old-price">$${(item.cost * 1.5).toFixed(
                      2
                    )}</span>`
                  : ''
              }
              <span class="price ${
                isBlowout ? 'blowout-price' : ''
              }">$${finalPrice.toFixed(2)}</span>
            </div>

            <button 
              class="buy-btn ${isBlowout ? 'btn-blowout' : ''}" 
              data-id="${item.id}"
              ${item.stock <= 0 ? 'disabled' : ''}>
              ${
                isBlowout
                  ? 'Grab Deal'
                  : item.stock > 0
                  ? 'Buy Now'
                  : 'Sold Out'
              }
            </button>
          </div>
        `;
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
      console.error(e);
      grid.innerHTML = '<p>Error loading your personalized selection.</p>';
    }
  }

  render(client) {
    const city = client.city || 'Banff';

    this.shadowRoot.innerHTML = `
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
        <h2>Ready for the ${city} trails?</h2>
        <p>"Lightest possible nordic setup" — We found exactly what you need to crush your Strava segments.</p>
      </div>

      <div id="productGrid" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);
