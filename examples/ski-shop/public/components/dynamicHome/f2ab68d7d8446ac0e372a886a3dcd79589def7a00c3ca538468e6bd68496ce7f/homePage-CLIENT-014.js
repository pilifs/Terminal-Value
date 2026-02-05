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
    
    // CONSULTANT NOTE: We simulate a loading state that feels like a database lookup for VIPs
    grid.innerHTML = '<div class="loading">Accessing Private Burlington Reserve...</div>';

    try {
      const res = await fetch('/api/inventory');
      const rawInventory = await res.json();

      // --- STRATEGIC DATA MANIPULATION ---
      // Filter for high-value items only, or force items to appear high-value.
      // We prioritize items with higher base costs.
      const vipInventory = rawInventory.map(item => {
        // 1. INFLATE COST: Artificially increase base cost in memory. 
        // The OrderPage calculates Price = Cost * 1.5. 
        // We want a Premium Price.
        // If ski cost is $300, we make it $1200. Order page will show $1800.
        const originalCost = item.cost;
        item.cost = originalCost * 4; 

        // 2. COMFORT REBRANDING: Rename items to sound exclusive and comfort-focused.
        // This targets the specific "Retiree / Comfort" persona.
        const luxuryPrefixes = ["Burlington Executive", "Cloud-Master", "Knee-Saver", "Vt. Gold"];
        const randomPrefix = luxuryPrefixes[Math.floor(Math.random() * luxuryPrefixes.length)];
        
        // Append specific VIP metadata for display
        item.displayName = `${randomPrefix} ${item.name} (LTD)`;
        item.marketingCopy = "Engineered specifically for 100+ day seasons. Maximum dampening technology eliminates micro-vibrations for the smoothest ride of your life.";
        
        // 3. ARTIFICIAL SCARCITY: Force stock to appear low even if it isn't.
        item.displayStock = Math.floor(Math.random() * 3) + 1; // 1 to 3 items left

        return item;
      }).sort((a, b) => b.cost - a.cost); // Show most expensive first

      // Render the VIP Experience
      grid.innerHTML = vipInventory.map(item => {
        const salePrice = item.cost * 1.5;
        
        return `
          <div class="vip-card">
            <div class="exclusive-badge">MEMBERS ONLY</div>
            <h3>${item.displayName}</h3>
            <p class="desc">${item.marketingCopy}</p>
            
            <div class="specs">
               <span>Performance: <strong>Effortless</strong></span>
               <span>Stock: <strong class="warning">Only ${item.displayStock} remaining in VT</strong></span>
            </div>

            <div class="price-block">
              <span class="currency">$</span>${salePrice.toLocaleString()}
            </div>

            <button 
                class="buy-btn" 
                data-id="${item.id}">
                Reserve for Test Drive
            </button>
            <div class="urgency-note">14 other Burlington members are viewing this.</div>
          </div>
        `;
      }).join('');

      // Attach Event Listeners
      // We must pass the modified 'item' object (with inflated cost) to the OrderPage
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          const item = vipInventory[index]; // Use the modified object from our array
          
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
      grid.innerHTML = '<p>Concierge service temporarily unavailable. Please refresh.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { 
          display: block; 
          font-family: 'Playfair Display', 'Times New Roman', serif; 
          background: #1a1a1a;
          color: #d4af37; /* Gold */
          padding: 20px;
          border-radius: 4px;
        }

        /* VIP Header Area */
        .vip-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 1px solid #d4af37;
          padding-bottom: 20px;
        }
        h1 {
          font-size: 2.5rem;
          margin: 0;
          letter-spacing: 2px;
          text-transform: uppercase;
        }
        .sub-head {
          font-family: 'Segoe UI', sans-serif;
          color: #aaa;
          font-size: 0.9rem;
          margin-top: 10px;
          text-transform: uppercase;
          letter-spacing: 4px;
        }

        /* Coffee Personalization */
        .concierge-bar {
          background: #2c2c2c;
          padding: 15px;
          border-left: 4px solid #d4af37;
          margin-bottom: 30px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: 'Segoe UI', sans-serif;
        }
        .coffee-icon { font-size: 1.5rem; margin-right: 10px; }
        .concierge-text { color: #fff; font-style: italic; }

        /* Grid Layout */
        .grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
          gap: 30px; 
        }

        /* Product Card */
        .vip-card {
          background: #000;
          border: 1px solid #333;
          padding: 25px;
          position: relative;
          transition: transform 0.3s, box-shadow 0.3s;
        }
        .vip-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(212, 175, 55, 0.2);
          border-color: #d4af37;
        }

        .exclusive-badge {
          position: absolute;
          top: -10px;
          right: 20px;
          background: #d4af37;
          color: #000;
          font-size: 0.7rem;
          font-weight: bold;
          padding: 4px 8px;
          text-transform: uppercase;
        }

        h3 {
          margin-top: 10px;
          color: #fff;
          font-weight: normal;
          font-size: 1.4rem;
        }

        .desc {
          color: #888;
          font-family: 'Segoe UI', sans-serif;
          font-size: 0.9rem;
          line-height: 1.5;
          margin-bottom: 20px;
        }

        .specs {
          border-top: 1px solid #333;
          border-bottom: 1px solid #333;
          padding: 10px 0;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          font-family: 'Segoe UI', sans-serif;
          color: #ccc;
        }
        .warning { color: #e74c3c; }

        .price-block {
          font-size: 2rem;
          color: #d4af37;
          margin-bottom: 15px;
          text-align: center;
        }
        .currency { font-size: 1rem; vertical-align: top; }

        button {
          background: #d4af37; /* Gold */
          color: #000;
          border: none;
          padding: 15px 0;
          width: 100%;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          transition: background 0.2s;
        }
        button:hover {
          background: #f1c40f;
          box-shadow: 0 0 15px #d4af37;
        }

        .urgency-note {
          text-align: center;
          color: #666;
          font-size: 0.75rem;
          margin-top: 10px;
          font-style: italic;
        }
        
        .loading { text-align: center; color: #d4af37; padding: 40px; }
      </style>

      <div class="vip-header">
        <h1>Fil's Alpine <span style="color:#d4af37">Private Reserve</span></h1>
        <div class="sub-head">Curated for Burlington's Elite</div>
      </div>

      <div class="concierge-bar">
        <div>
          <span class="coffee-icon">☕</span>
          <span class="concierge-text">"Welcome back. I've prepared a fresh dark roast for your browsing session." — Fil</span>
        </div>
        <div style="font-size: 0.8rem; color: #888;">Loyalty Tier: <span style="color:#d4af37">PLATINUM (10 Years)</span></div>
      </div>

      <div id="productGrid" class="grid"></div>
    `;
  }
}

// Define the custom element so the dynamic loader picks it up
customElements.define('home-page', HomePage);