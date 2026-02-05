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
    const heroLoader = this.shadowRoot.getElementById('hero-loader');
    
    // Simulate a "Checking personalized stock" delay for perceived value
    grid.innerHTML = '<div class="loading-state">Accessing Private Vault...</div>';

    try {
      const res = await fetch('/api/inventory');
      let inventory = await res.json();

      // CONSULTING STRATEGY: 
      // Sort by Price DESC to maximize revenue. 
      // The client has money; show them the best gear first.
      inventory.sort((a, b) => b.cost - a.cost);

      if(heroLoader) heroLoader.style.display = 'none';

      grid.innerHTML = inventory
        .map((item) => {
          // Dynamic Scarcity Logic
          const viewers = Math.floor(Math.random() * 14) + 3; // Fake social proof
          const isLowStock = item.stock < 5;
          const urgencyClass = isLowStock ? 'urgent' : '';
          const urgencyText = isLowStock 
            ? `⚠️ Only ${item.stock} left in Calgary hub` 
            : 'In Stock - Ready for Weekend';

          // Personalized Badge based on item attributes (Simulated logic)
          let badge = "Pro Performance";
          if (item.name.toLowerCase().includes("race")) badge = "Podium Ready";
          else if (item.cost > 500) badge = "Ex-Demo Spec";

          return `
            <div class="card">
                <div class="badge">${badge}</div>
                <div class="card-header">
                    <h3>${item.name}</h3>
                    <div class="live-viewers">
                        <span class="pulsing-dot"></span> ${viewers} people viewing
                    </div>
                </div>
                
                <div class="price-block">
                    <span class="label">MEMBER PRICE</span>
                    <span class="price">$${(item.cost * 1.5).toLocaleString()}</span>
                </div>

                <div class="stock-status ${urgencyClass}">
                    ${urgencyText}
                </div>

                <p class="description">
                    Engineered for variable conditions. Perfect for the transition from icy city mornings to deep powder bowls.
                </p>

                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? 'SECURE ALLOCATION' : 'WAITLIST FULL'}
                </button>
                
                <div class="shipping-note">
                    <span class="icon">🚀</span> Overnight Delivery to Calgary Available
                </div>
            </div>
          `;
        })
        .join('');

      // Add Event Listeners (Preserving Base Functionality)
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
      grid.innerHTML = '<p style="color:white">System error loading private inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: fadeIn 0.5s ease-out; 
                background-color: #1a1a1a; /* Dark premium background */
                color: #ecf0f1;
                font-family: 'Segoe UI', sans-serif;
                margin: -2rem; /* Break out of container padding */
                padding: 2rem;
            }

            /* HERO SECTION */
            .hero {
                background: linear-gradient(135deg, #2c3e50 0%, #000000 100%);
                padding: 40px;
                border-radius: 12px;
                margin-bottom: 40px;
                border: 1px solid #444;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                position: relative;
                overflow: hidden;
            }
            .hero::after {
                content: '';
                position: absolute;
                top: 0; right: 0; bottom: 0; width: 50%;
                background: radial-gradient(circle, rgba(230, 126, 34, 0.1) 0%, rgba(0,0,0,0) 70%);
                pointer-events: none;
            }
            .hero h1 {
                font-size: 2.5rem;
                margin: 0 0 10px 0;
                background: -webkit-linear-gradient(#fff, #bdc3c7);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .hero p {
                font-size: 1.1rem;
                color: #bdc3c7;
                max-width: 600px;
                line-height: 1.6;
            }
            .hero-cta {
                margin-top: 20px;
                display: inline-block;
                padding: 8px 16px;
                background: rgba(230, 126, 34, 0.2);
                border: 1px solid #e67e22;
                color: #e67e22;
                border-radius: 4px;
                font-size: 0.9rem;
                font-weight: bold;
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            /* GRID & CARDS */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                gap: 25px; 
            }
            .card { 
                background: #252525; 
                padding: 25px; 
                border-radius: 8px; 
                border: 1px solid #333;
                transition: transform 0.2s, box-shadow 0.2s;
                position: relative;
                display: flex;
                flex-direction: column;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.4);
                border-color: #e67e22;
            }
            
            /* BADGE */
            .badge {
                position: absolute;
                top: -10px;
                right: 20px;
                background: #e67e22;
                color: white;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 4px 8px;
                text-transform: uppercase;
                border-radius: 2px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }

            /* CARD CONTENT */
            .card-header h3 { margin: 0; font-size: 1.4rem; color: #fff; }
            
            .live-viewers {
                font-size: 0.75rem;
                color: #7f8c8d;
                margin-top: 5px;
                display: flex;
                align-items: center;
                gap: 5px;
            }
            .pulsing-dot {
                width: 8px; height: 8px; background: #2ecc71; border-radius: 50%;
                animation: pulse 1.5s infinite;
            }

            .price-block { margin: 20px 0; }
            .label { display: block; font-size: 0.7rem; color: #7f8c8d; letter-spacing: 1px; }
            .price { font-size: 1.8rem; color: #fff; font-weight: bold; }

            .stock-status {
                font-size: 0.85rem;
                color: #2ecc71;
                margin-bottom: 10px;
                font-weight: 500;
            }
            .stock-status.urgent { color: #e74c3c; }

            .description {
                font-size: 0.9rem;
                color: #bdc3c7;
                margin-bottom: 20px;
                flex-grow: 1;
                line-height: 1.4;
            }

            .shipping-note {
                margin-top: 15px;
                font-size: 0.75rem;
                color: #95a5a6;
                text-align: center;
            }

            /* BUTTONS */
            button { 
                background: #e67e22; 
                color: white; 
                border: none; 
                padding: 15px; 
                border-radius: 4px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: background 0.2s;
            }
            button:hover { background: #d35400; }
            button:disabled { background: #444; color: #888; cursor: not-allowed; }

            .loading-state { text-align: center; color: #7f8c8d; padding: 50px; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        </style>

        <div class="hero">
            <div id="hero-loader" style="float:right; color: #e67e22;">Analyzing conditions...</div>
            <h1>The Weekend is Calling.</h1>
            <p>Don't waste Friday night in the rental line. The forecast for Calgary looks variable—you need gear that adapts as fast as you do. These selections are reserved for your profile.</p>
            <div class="hero-cta">Priority Access: Enabled</div>
        </div>

        <h2 style="border-bottom: 1px solid #444; padding-bottom: 10px; margin-bottom: 20px; color: #bdc3c7; font-size: 1rem; text-transform: uppercase; letter-spacing: 2px;">
            Reserved Inventory
        </h2>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);