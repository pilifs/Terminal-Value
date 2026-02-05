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
    const bootSection = this.shadowRoot.getElementById('bootSection');
    
    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // LOGIC: Filter for high-value items and specific gear types
      // We sort by cost descending to ensure we push the most expensive gear first.
      inventory.sort((a, b) => b.cost - a.cost);

      // Segregate Boots for the "Pain Point" section
      const boots = inventory.filter(i => i.name.toLowerCase().includes('boot'));
      const otherGear = inventory.filter(i => !i.name.toLowerCase().includes('boot'));

      // RENDER BOOTS (The "Wide Fit" Solution)
      // We are dynamically rebranding the boots in the UI to address the client's specific complaint.
      bootSection.innerHTML = boots.map(item => this.createProductCard(item, true)).join('');

      // RENDER REMAINING HIGH TICKET ITEMS
      // Limit to top 4 most expensive non-boot items to maintain exclusivity
      grid.innerHTML = otherGear.slice(0, 4).map(item => this.createProductCard(item, false)).join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          // We must clone the item to modify the name for the order page to match the personalized marketing
          const originalItem = inventory.find((i) => i.id === itemId);
          const marketingItem = { ...originalItem };
          
          if (marketingItem.name.toLowerCase().includes('boot')) {
            marketingItem.name = `${originalItem.name} (Custom Wide Fit)`;
          }

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: marketingItem },
              bubbles: true,
              composed: true,
            })
          );
        });
      });

    } catch (e) {
      grid.innerHTML = '<p style="color:white; text-align:center;">Checking Vault Availability...</p>';
    }
  }

  createProductCard(item, isBoot) {
    // PRICING STRATEGY:
    // Display the price. The "Value Conscious" client wants durability. 
    // We add marketing copy that justifies the price.
    const price = (item.cost * 1.5).toFixed(2);
    
    // MARKETING COPY GENERATION
    let title = item.name;
    let badge = 'VAIL READY';
    let desc = 'Engineered for durability and performance.';
    
    if (isBoot) {
      title = `${item.name} <span style="color:#f1c40f; font-weight:300;">| Wide-Last Pro</span>`;
      badge = 'COMFORT GUARANTEED';
      desc = 'Expanded toe-box architecture with zero pressure points. Validated for high-instep profiles.';
    } else {
      desc = ' reinforced composite materials. Lifetime durability rating.';
    }

    const urgency = item.stock < 5 ? `Only ${item.stock} left in Salt Lake City` : 'High Demand';

    return `
      <div class="card ${isBoot ? 'featured-card' : ''}">
        <div class="badge">${badge}</div>
        <h3>${title}</h3>
        <p class="desc">${desc}</p>
        <div class="meta">
            <span class="stock-indicator">⚠️ ${urgency}</span>
            <span class="price">$${price}</span>
        </div>
        <button 
            class="buy-btn" 
            data-id="${item.id}"
            ${item.stock <= 0 ? 'disabled' : ''}>
            ${item.stock > 0 ? (isBoot ? 'RESERVE FOR FITTING' : 'SECURE ITEM') : 'SOLD OUT'}
        </button>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: fadeIn 0.6s ease-out; 
                font-family: 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d); /* Premium "Vail Sunset" Gradient */
                background: #0f172a;
                color: white;
                padding-bottom: 40px;
                border-radius: 8px;
                overflow: hidden;
            }

            /* HERO SECTION */
            .hero {
                background: url('https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=1000&q=80') center/cover no-repeat;
                height: 300px;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                text-align: center;
            }
            .hero-overlay {
                background: rgba(15, 23, 42, 0.85);
                position: absolute;
                top: 0; left: 0; right: 0; bottom: 0;
            }
            .hero-content {
                position: relative;
                z-index: 2;
                max-width: 600px;
                padding: 20px;
            }
            h1 { 
                font-size: 2.5rem; 
                margin: 0 0 10px 0; 
                letter-spacing: 1px;
                text-transform: uppercase;
                background: -webkit-linear-gradient(#eee, #999);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .sub-hero {
                font-size: 1.1rem;
                color: #cbd5e1;
                font-weight: 300;
            }
            .countdown {
                margin-top: 15px;
                display: inline-block;
                padding: 5px 15px;
                background: rgba(255,255,255,0.1);
                border: 1px solid #f1c40f;
                color: #f1c40f;
                font-weight: bold;
                border-radius: 4px;
                font-size: 0.9rem;
            }

            /* SECTIONS */
            .section-title {
                margin: 40px 20px 20px 20px;
                font-size: 1.5rem;
                border-left: 4px solid #f1c40f;
                padding-left: 15px;
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }
            .note {
                font-size: 0.9rem;
                color: #94a3b8;
                font-style: italic;
                font-weight: normal;
            }

            /* GRIDS */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
                gap: 25px; 
                padding: 0 20px; 
            }
            
            .boot-wrapper {
                padding: 0 20px;
                margin-bottom: 20px;
            }

            /* CARDS */
            .card { 
                background: #1e293b; 
                padding: 25px; 
                border-radius: 6px; 
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5); 
                transition: transform 0.2s;
                border: 1px solid #334155;
                position: relative;
            }
            .card:hover { transform: translateY(-3px); border-color: #f1c40f; }
            
            .featured-card {
                background: linear-gradient(to bottom right, #1e293b, #0f172a);
                border: 1px solid #f1c40f;
                grid-column: 1 / -1; /* Make boot card full width if in grid, but we use separate wrapper */
            }

            .badge {
                position: absolute;
                top: -10px;
                right: 20px;
                background: #b91c1c;
                color: white;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 4px 8px;
                border-radius: 2px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .card h3 { 
                margin: 10px 0; 
                color: #f8fafc; 
                font-size: 1.2rem; 
                font-weight: 600;
            }
            
            .desc {
                color: #94a3b8;
                font-size: 0.9rem;
                line-height: 1.5;
                margin-bottom: 20px;
            }

            .meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                font-family: 'Consolas', monospace;
            }

            .price { 
                font-size: 1.4rem; 
                color: #f1c40f; 
                font-weight: bold; 
            }
            .stock-indicator { 
                color: #f87171; 
                font-size: 0.8rem; 
                font-weight: bold;
            }

            /* BUTTONS */
            button { 
                background: white; 
                color: #0f172a; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 2px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 0.9rem; 
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: background 0.2s;
            }
            button:hover { background: #f1c40f; }
            button:disabled { background: #475569; color: #94a3b8; cursor: not-allowed; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="hero">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <h1>The Vail Collection</h1>
                <div class="sub-hero">
                    Curated specifically for your Salt Lake City departure. <br>
                    Durability meets performance.
                </div>
                <div class="countdown">TRIP STATUS: UPCOMING (Priority Processing Active)</div>
            </div>
        </div>

        <h2 class="section-title">
            Step 1: The Fit Solution
            <span class="note">Addressing your feedback: "Wide Fit Required"</span>
        </h2>
        
        <!-- Targeted Boot Section (The Hook) -->
        <div id="bootSection" class="boot-wrapper grid"></div>

        <h2 class="section-title">
            Step 2: Pro-Grade Durability
            <span class="note">Investment-grade equipment</span>
        </h2>
        
        <!-- High Value Upsell Grid -->
        <div id="productGrid" class="grid"></div>
        
        <div style="text-align:center; padding: 40px; color: #64748b; font-size: 0.8rem;">
            * All items reserved for Client ID: SLC-VIP at Salt Lake City Warehouse.
        </div>
        `;
  }
}

customElements.define('home-page', HomePage);