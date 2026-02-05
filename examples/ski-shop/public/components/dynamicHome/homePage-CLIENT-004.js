class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.clientProfile = null;
    this.inventory = [];
  }

  // Initialize component when added to DOM
  async connectedCallback() {
    this.render(); // Render initial shell

    // 1. Fetch Client Profile for Personalization
    await this.fetchClientData();

    // 2. Load Inventory
    this.loadInventory();
  }

  // Fetch client data based on URL ID to enable personalization
  async fetchClientData() {
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('clientId');

    if (clientId) {
      try {
        const res = await fetch(`/api/clients/${clientId}`);
        if (res.ok) {
          this.clientProfile = await res.json();
          this.updateGreeting(); // Update header once data is back
        }
      } catch (e) {
        console.error('Could not fetch client profile', e);
      }
    }
  }

  // Update the greeting header dynamically
  updateGreeting() {
    const greetingEl = this.shadowRoot.getElementById('greetingText');
    if (!greetingEl) return;

    if (this.clientProfile) {
      // Use City or CRM notes for persona-based greeting
      const city = this.clientProfile.city || 'Valued';
      // Check for specific flashy persona notes or default to City
      greetingEl.innerHTML = `Welcome back, <strong>${city}</strong> VIP! <br><span style="font-size:0.8em; font-weight:normal;">Ready to dominate the slopes?</span>`;
    }
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML =
      '<p style="text-align:center">Curating your exclusive collection...</p>';

    try {
      const res = await fetch('/api/inventory');
      this.inventory = await res.json();

      // --- PERSONALIZATION LOGIC ---

      // 1. SORT: High Spender / Impulse Buyer (Cost Descending)
      // The user "usually buys the most expensive item", so we put those first.
      const sortedInventory = [...this.inventory].sort(
        (a, b) => b.cost - a.cost
      );

      grid.innerHTML = sortedInventory
        .map((item) => {
          // Standard Calculation
          let displayPrice = item.cost * 1.5;
          let isBlowout = false;
          let rawCost = item.cost;

          // 2. PRICING: Check for 'Racing' or 'World Cup' gear for Sales Blowout
          // Requirement: Price between 0.4 * COGS and 1.0 * COGS
          if (
            item.name.toLowerCase().includes('world cup') ||
            item.name.toLowerCase().includes('racer')
          ) {
            isBlowout = true;
            // Calculate dynamic blowout price (e.g., 0.8 * COGS)
            displayPrice = rawCost * 0.8;
          }

          // Styling for the Price
          const priceHtml = isBlowout
            ? `<span style="text-decoration: line-through; color: #7f8c8d; font-size: 0.9em;">$${(
                rawCost * 1.5
              ).toFixed(2)}</span>
                   <div style="color: #e74c3c; font-weight: bold; font-size: 1.3rem;">$${displayPrice.toFixed(
                     2
                   )}</div>
                   <div style="font-size: 0.8rem; color: #e74c3c; text-transform: uppercase; font-weight: bold;">⚠️ Sales Blowout</div>`
            : `<div class="price">$${displayPrice.toFixed(2)}</div>`;

          // Styling for the Card (Highlight flashy items)
          const cardClass = isBlowout ? 'card blowout-highlight' : 'card';

          return `
                <div class="${cardClass}">
                    <h3>${item.name}</h3>
                    <p class="stock">${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    ${priceHtml}
                    <button 
                        class="buy-btn" 
                        data-id="${item.id}"
                        data-blowout="${isBlowout}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            `;
        })
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const isBlowout = e.target.dataset.blowout === 'true';

          // Clone item to avoid mutating master inventory
          const originalItem = this.inventory.find((i) => i.id === itemId);
          let itemToBuy = { ...originalItem };

          if (isBlowout) {
            // CRITICAL: OrderPage calculates price as `cost * 1.5`.
            // We must reverse-engineer the 'cost' passed to OrderPage so the final math matches our Blowout price.
            // Target Price = Cost * 0.8
            // Order Page Math = PassedCost * 1.5
            // PassedCost = (Cost * 0.8) / 1.5
            itemToBuy.cost = (originalItem.cost * 0.8) / 1.5;
          }

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: itemToBuy },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; transition: transform 0.2s; position: relative; border: 1px solid transparent; }
            .card:hover { transform: translateY(-5px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            
            /* High Contrast / Flashy Style for Blowout Items */
            .blowout-highlight { border: 2px solid #e74c3c; background: #fffdfd; }
            
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; min-height: 40px; display: flex; align-items: center; justify-content: center; }
            .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; margin: 10px 0; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; margin-top: 10px; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }

            .header-area { margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
            h2 { margin: 0; color: #2c3e50; }
            
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <div class="header-area">
            <h2 id="greetingText">Welcome to Alpine Ski Shop</h2>
        </div>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);
