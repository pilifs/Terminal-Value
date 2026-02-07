class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
    this.startCountdown();
  }

  // Psychological Trigger: Countdown to first race of the season
  startCountdown() {
    const timer = this.shadowRoot.getElementById('raceTimer');
    // Set date to a fictional "First Race" in November
    const countDownDate = new Date().getTime() + 5 * 24 * 60 * 60 * 1000;

    setInterval(() => {
      const now = new Date().getTime();
      const distance = countDownDate - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );

      if (timer)
        timer.innerHTML = `SEASON STARTS IN: <span style="color:#e74c3c">${days}d ${hours}h</span>`;
    }, 1000);
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML =
      '<div class="loading">Retrieving V.I.P. Allocation...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // STRATEGY: Sort by Price DESC. Filter out cheap gear.
      // We want to drive revenue, so we hide anything under $400 cost if possible.
      const premiumInventory = inventory
        .sort((a, b) => b.cost - a.cost)
        .filter((item) => item.cost > 0); // Display all, but ordered by highest value

      grid.innerHTML = premiumInventory
        .map((item, index) => {
          // MARKUP: Add artificial scarcity based on index
          const stockLevel = item.stock > 0 ? item.stock : 0;
          const isCritical = stockLevel < 5;
          const price = (item.cost * 1.5).toFixed(2);

          // UX: The first item is the "Podium Pick" (Biggest Image)
          const isHero = index === 0;

          return `
                <div class="card ${isHero ? 'hero-card' : ''}">
                    ${
                      isHero
                        ? '<div class="badge-hero">COACH\'S RECOMMENDATION</div>'
                        : ''
                    }
                    <div class="card-header">
                        <h3>${item.name}</h3>
                        ${
                          isCritical
                            ? '<span class="alert-badge">ALMOST GONE</span>'
                            : ''
                        }
                    </div>
                    
                    <div class="specs">
                        <span>Calgary Race Legal</span> • 
                        <span>FIS Approved</span>
                    </div>

                    <div class="pricing-row">
                        <div class="price-container">
                            <span class="label">Club Price:</span>
                            <span class="price">$${price}</span>
                        </div>
                        <button 
                            class="buy-btn ${isHero ? 'btn-gold' : ''}" 
                            data-id="${item.id}"
                            ${stockLevel <= 0 ? 'disabled' : ''}>
                            ${
                              stockLevel > 0
                                ? isHero
                                  ? 'SECURE FOR TEAM'
                                  : 'ADD TO ALLOCATION'
                                : 'WAITLIST'
                            }
                        </button>
                    </div>
                    
                    <div class="stock-footer">
                        ${
                          stockLevel > 0
                            ? `<span class="stock-pulse">●</span> ${stockLevel} units reserved at Calgary Warehouse`
                            : 'Sold out globally'
                        }
                    </div>
                </div>
            `;
        })
        .join('');

      // Re-attach event listeners to maintain base experience compatibility
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatches standard event expected by app.js
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
      grid.innerHTML = '<p>Error loading exclusive inventory.</p>';
      console.error(e);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: 'Segoe UI', sans-serif; 
                background-color: #1a1a1a; /* Dark Premium Theme */
                color: #ecf0f1;
                border-radius: 8px;
                overflow: hidden;
            }
            
            /* HEADER STYLES */
            .vip-header {
                background: linear-gradient(135deg, #000000 0%, #2c3e50 100%);
                padding: 40px 20px;
                text-align: center;
                border-bottom: 4px solid #f39c12;
            }
            h1 { margin: 0; font-size: 2.5rem; letter-spacing: 2px; text-transform: uppercase; }
            .sub-head { color: #f39c12; font-weight: bold; margin-top: 10px; font-size: 1.1rem; }
            .calgary-tag { 
                background: rgba(255,255,255,0.1); 
                padding: 5px 15px; 
                border-radius: 20px; 
                font-size: 0.8rem; 
                margin-top: 15px; 
                display: inline-block;
            }

            /* URGENCY BAR */
            .ticker {
                background: #c0392b;
                color: white;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                font-size: 0.9rem;
                display: flex;
                justify-content: space-around;
                align-items: center;
            }
            
            /* GRID LAYOUT */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                gap: 20px; 
                padding: 30px;
            }

            /* CARD STYLES */
            .card { 
                background: #2c2c2c; 
                border: 1px solid #444; 
                padding: 25px; 
                border-radius: 4px; 
                transition: transform 0.2s;
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .card:hover { transform: translateY(-5px); border-color: #f39c12; }
            
            /* HERO CARD (Most Expensive) */
            .hero-card {
                grid-column: 1 / -1; /* Span full width */
                background: linear-gradient(to right, #2c3e50, #1a1a1a);
                border: 2px solid #f39c12;
                flex-direction: row;
                align-items: center;
            }
            .hero-card .pricing-row { width: 40%; }
            .hero-card .card-header { width: 60%; }
            
            @media(max-width: 600px) {
                .hero-card { flex-direction: column; }
                .hero-card .pricing-row, .hero-card .card-header { width: 100%; }
            }

            .card h3 { margin: 0 0 10px 0; color: #fff; font-size: 1.4rem; }
            .specs { font-size: 0.8rem; color: #95a5a6; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;}

            /* BADGES */
            .badge-hero {
                position: absolute;
                top: -12px;
                left: 20px;
                background: #f39c12;
                color: #000;
                font-weight: bold;
                padding: 5px 10px;
                font-size: 0.8rem;
                border-radius: 2px;
            }
            .alert-badge {
                background: #e74c3c;
                color: white;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 3px;
                margin-left: 10px;
                vertical-align: middle;
            }

            /* PRICING & BUTTONS */
            .pricing-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 15px;
                border-top: 1px solid #444;
                padding-top: 15px;
            }
            .price-container { display: flex; flex-direction: column; }
            .label { font-size: 0.7rem; color: #aaa; }
            .price { font-size: 1.5rem; color: #f39c12; font-weight: bold; }
            
            button { 
                background: #34495e; 
                color: white; 
                border: none; 
                padding: 12px 25px; 
                border-radius: 2px; 
                cursor: pointer; 
                font-weight: bold; 
                text-transform: uppercase; 
                letter-spacing: 1px;
                transition: background 0.2s;
            }
            button:hover { background: #2c3e50; }
            
            .btn-gold {
                background: #f39c12;
                color: #000;
                box-shadow: 0 0 15px rgba(243, 156, 18, 0.4);
            }
            .btn-gold:hover { background: #d35400; color: white; }
            button:disabled { background: #555; cursor: not-allowed; color: #888; box-shadow: none;}

            .stock-footer { font-size: 0.75rem; color: #7f8c8d; margin-top: 10px; text-align: right; }
            .stock-pulse { color: #2ecc71; animation: blink 2s infinite; }
            
            .loading { padding: 50px; text-align: center; color: #7f8c8d; font-style: italic;}

            @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        </style>

        <div class="vip-header">
            <h1>Calgary Junior Race Program</h1>
            <div class="sub-head">EXCLUSIVE EQUIPMENT ACCESS • NOVEMBER ALLOCATION</div>
            <div class="calgary-tag">📍 Personalized for Calgary, AB</div>
        </div>
        
        <div class="ticker">
            <span id="raceTimer">CALCULATING SEASON START...</span>
            <span>⚠️ HIGH DEMAND IN ALBERTA REGION</span>
        </div>

        <div id="productGrid" class="grid"></div>
        
        <div style="text-align:center; padding: 20px; color: #7f8c8d; font-size: 0.8rem;">
            * Team Bundle pricing applied automatically at checkout.
        </div>
        `;
  }
}

customElements.define('home-page', HomePage);
