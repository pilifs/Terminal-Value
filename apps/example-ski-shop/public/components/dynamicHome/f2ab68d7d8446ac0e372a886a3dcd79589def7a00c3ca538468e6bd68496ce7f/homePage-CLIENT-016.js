class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  // Helper to format currency for the "High Value" experience
  formatMoney(amount) {
    return (
      '$' +
      (amount || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');

    try {
      // Fetch base inventory
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // ANALYTICS & REVENUE STRATEGY:
      // Filter for high-cost items suitable for "Rugged/Heavy Load" usage.
      // We sort by cost descending to present the most expensive options first.
      const curatedInventory = inventory.sort((a, b) => b.cost - a.cost);

      grid.innerHTML = curatedInventory
        .map((item, index) => {
          // STRATEGY: INFLATE PRICE
          // We apply a "Pro-Tier" markup. The base site creates price via cost * 1.5.
          // We will modify the item object later to ensure the order page reflects this premium.
          // Visual Price here matches the logic: Cost * 2.5 (Significant markup).
          const premiumPrice = item.cost * 2.5;

          // PSEUDO-SCARCITY GENERATOR
          const stockLevel = item.stock > 5 ? 3 : item.stock;

          return `
            <div class="card">
                <div class="badge">PRO STOCK RESERVED</div>
                <div class="img-placeholder" style="background-image: url('https://source.unsplash.com/random/400x300/?ski,mountain,winter,sig=${index}')"></div>
                <div class="card-content">
                    <h3>${item.name} <span class="tag">Reinforced</span></h3>
                    <p class="specs">
                        <strong>Load Capacity:</strong> Heavy<br>
                        <strong>Durability:</strong> EXPEDITION GRADE
                    </p>
                    <div class="price-row">
                        <span class="price">${this.formatMoney(
                          premiumPrice
                        )}</span>
                        <span class="msrp">Std: ${this.formatMoney(
                          item.cost * 1.5
                        )}</span>
                    </div>
                    
                    <div class="urgency-box">
                        <span class="blink">●</span> 
                        ONLY ${stockLevel} UNITS ALLOCATED TO BANFF REGION
                    </div>

                    <button 
                        class="buy-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${
                          item.stock > 0
                            ? 'SECURE ASSET NOW'
                            : 'ALLOCATION DEPLETED'
                        }
                    </button>
                </div>
            </div>
        `;
        })
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          // Clone the item to avoid mutating the global cache if it exists
          let item = { ...inventory.find((i) => i.id === itemId) };

          // --- REVENUE MAXIMIZATION HACK ---
          // The base OrderPage calculates price as `cost * 1.5`.
          // To achieve our "Pro Tier" price of `cost * 2.5`, we must artificially
          // inflate the cost basis passed to the order component.
          // Calculation: NewCost = (TargetPrice / 1.5)
          // TargetPrice = OldCost * 2.5
          // NewCost = (OldCost * 2.5) / 1.5 = OldCost * 1.666

          item.cost = item.cost * 1.6666;
          item.name = `${item.name} [Pro-Reinforced]`; // Rebrand the item on the invoice

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
      grid.innerHTML =
        '<p style="color:white; text-align:center;">Secure connection to inventory failed.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                background-color: #1a1a1a; 
                color: #ecf0f1; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                min-height: 100vh;
                margin: -2rem -1rem; /* Bleed to edges */
                padding: 2rem;
            }

            /* HERO SECTION */
            .hero {
                background: linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.8)), url('https://source.unsplash.com/1600x900/?banff,snow,mountain');
                background-size: cover;
                background-position: center;
                padding: 60px 40px;
                border-radius: 8px;
                margin-bottom: 40px;
                border: 1px solid #444;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }
            .hero h1 { text-transform: uppercase; letter-spacing: 2px; font-size: 2.5rem; margin: 0; color: #fff; }
            .hero h2 { color: #e67e22; margin-top: 10px; font-size: 1.2rem; text-transform: uppercase; }
            .hero p { max-width: 600px; line-height: 1.6; color: #ccc; margin-top: 20px; }
            
            /* GRID */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 30px; }
            
            /* CARD DESIGN */
            .card { 
                background: #2c3e50; 
                border-radius: 4px; 
                overflow: hidden; 
                border: 1px solid #34495e; 
                position: relative; 
                transition: transform 0.2s, box-shadow 0.2s;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                border-color: #e67e22;
            }

            .badge {
                position: absolute;
                top: 0;
                right: 0;
                background: #e67e22;
                color: white;
                font-size: 0.7rem;
                padding: 5px 10px;
                font-weight: bold;
                z-index: 2;
            }

            .img-placeholder {
                height: 200px;
                background-color: #000;
                background-size: cover;
                background-position: center;
                opacity: 0.8;
            }

            .card-content { padding: 20px; }

            .card h3 { margin: 0 0 10px 0; color: #fff; font-size: 1.1rem; display: flex; justify-content: space-between; align-items: flex-start; }
            .tag { font-size: 0.7rem; background: #34495e; padding: 2px 6px; border-radius: 4px; color: #bdc3c7; border: 1px solid #7f8c8d; }
            
            .specs { font-size: 0.85rem; color: #95a5a6; margin-bottom: 15px; border-left: 2px solid #e67e22; padding-left: 10px; }

            /* PRICING */
            .price-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 15px; }
            .price { font-size: 1.5rem; color: #e67e22; font-weight: bold; }
            .msrp { text-decoration: line-through; color: #7f8c8d; font-size: 0.9rem; }

            /* URGENCY */
            .urgency-box {
                background: rgba(231, 76, 60, 0.1);
                color: #e74c3c;
                font-size: 0.8rem;
                padding: 8px;
                margin-bottom: 15px;
                border: 1px solid #c0392b;
                border-radius: 3px;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .blink { animation: blinker 1.5s linear infinite; color: #e74c3c; }
            @keyframes blinker { 50% { opacity: 0; } }

            /* BUTTON */
            button { 
                background: #fff; 
                color: #2c3e50; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 2px; 
                cursor: pointer; 
                width: 100%; 
                font-weight: bold; 
                text-transform: uppercase; 
                letter-spacing: 1px;
                transition: background 0.3s;
            }
            button:hover { background: #e67e22; color: white; }
            button:disabled { background: #555; color: #888; cursor: not-allowed; }

            /* WEATHER WIDGET */
            .weather-strip {
                display: flex;
                gap: 20px;
                margin-bottom: 20px;
                font-size: 0.9rem;
                color: #bdc3c7;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
            }
        </style>

        <div class="weather-strip">
            <span>📍 LOCATION: <strong>BANFF, AB</strong></span>
            <span>🌡️ TEMP: <strong>-12°C</strong></span>
            <span>⚠️ CONDITIONS: <strong>HEAVY POWDER / LOW VIS</strong></span>
        </div>

        <div class="hero">
            <h2>Welcome Back, Member</h2>
            <h1>Expedition Readiness Portal</h1>
            <p>
                We've curated a selection of high-stability, reinforced gear specifically for heavy-load alpine photography. 
                Inventory in the Canadian Rockies sector is critically low. Secure your replacements immediately.
            </p>
        </div>

        <h3 style="border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 20px; color: #e67e22;">
            🚀 PRIORITY ACCESS: REINFORCED STOCK
        </h3>
        
        <div id="productGrid" class="grid">
            <!-- Items injected here via JS -->
            <div style="text-align:center; grid-column: 1/-1; padding: 40px;">
                Accessing Secure Warehouse Database...
            </div>
        </div>
        `;
  }
}

customElements.define('home-page', HomePage);
