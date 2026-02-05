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

        hero.innerHTML = `
          <div class="blowout-card">
            <div class="blowout-tag">🔥 RACING BLOWOUT</div>
            <div class="blowout-content">
              <div>
                <h3>${racingSki.name}</h3>
                <p>Since you're a fan of the track, we've unlocked a warehouse deal just for you.</p>
                <div class="price-row">
                  <span class="old-price">$${(racingSki.cost * 1.5).toFixed(2)}</span>
                  <span class="new-price">$${blowoutPrice}</span>
                </div>
              </div>
              <button class="buy-btn blowout-btn" data-id="${racingSki.id}">
                Grab This Deal
              </button>
            </div>
          </div>
        `;
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

          return `
            <div class="card ${isComfort ? 'highlight-comfort' : ''}">
                ${isComfort ? '<div class="badge">Recommended for Comfort</div>' : ''}
                <h3>${item.name}</h3>
                <p class="stock">${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
                <p class="price">$${price}</p>
                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? 'Add to Order' : 'Sold Out'}
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
      grid.innerHTML = '<p class="loading">Unable to load inventory at this time.</p>';
      console.error(e);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
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
    `;
  }
}

customElements.define('home-page', HomePage);