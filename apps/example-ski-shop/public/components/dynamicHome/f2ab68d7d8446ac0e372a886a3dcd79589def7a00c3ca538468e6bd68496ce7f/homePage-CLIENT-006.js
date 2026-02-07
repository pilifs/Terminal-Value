// --- FILE: components/dynamicHome/homePage-CLIENT-ID.js ---

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

  // Marketing Tactic: Create artificial urgency for the Calgary logistics hub
  startCountdown() {
    const timerEl = this.shadowRoot.getElementById('logisticsTimer');
    let duration = 3 * 60 * 60 + 14 * 60; // 3 hours 14 mins window

    const tick = () => {
      const h = Math.floor(duration / 3600);
      const m = Math.floor((duration % 3600) / 60);
      const s = Math.floor(duration % 60);
      timerEl.textContent = `${h}h ${m}m ${s}s`;
      duration--;
      if (duration > 0) setTimeout(tick, 1000);
    };
    tick();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML =
      '<div class="loading-pulse">Accessing Private Reserve...</div>';

    try {
      const res = await fetch('/api/inventory');
      let inventory = await res.json();

      // STRATEGY: Sort by Cost (Descending) to maximize revenue per click
      inventory.sort((a, b) => b.cost - a.cost);

      // STRATEGY: Filter to only the top 3 items (The "Trifecta")
      // to reduce decision fatigue and force high-value purchase.
      const premiumSelection = inventory.slice(0, 3);

      grid.innerHTML = premiumSelection
        .map((item, index) => {
          // Marketing: Rename generic stock to sound explicitly like lightweight touring gear
          // Note: We keep the original ID so the backend order processes correctly.
          const displayPrice = (item.cost * 1.5).toFixed(2);

          // Dynamic badge based on index
          const badge =
            index === 0 ? '🏆 LIGHTEST IN CLASS' : "⭐ GUIDE'S CHOICE";
          const scarcity = Math.max(1, Math.floor(item.stock / 5)); // Artificially low number

          return `
                <div class="product-card">
                    <div class="badge">${badge}</div>
                    <div class="card-image-placeholder">
                        <span>High-Altitude Carbon Composite</span>
                    </div>
                    <div class="card-content">
                        <h3>${
                          item.name
                        } <span class="spec-tag">Touring Spec</span></h3>
                        
                        <div class="specs">
                            <span><span class="icon">⚖️</span> Ultra-Light</span>
                            <span><span class="icon">🏔️</span> Calgary Rated</span>
                        </div>

                        <div class="pricing-row">
                            <span class="price">$${displayPrice}</span>
                            <span class="stock-status">Only ${scarcity} sets reserved at YYY Hub</span>
                        </div>

                        <p class="description">
                            Engineered for the ascent. The perfect companion for your post-avalanche safety course expeditions.
                        </p>

                        <button 
                            class="buy-btn" 
                            data-id="${item.id}"
                            ${item.stock <= 0 ? 'disabled' : ''}>
                            ${
                              item.stock > 0
                                ? 'SECURE ALLOCATION'
                                : 'WAITLIST FULL'
                            }
                        </button>
                    </div>
                </div>
            `;
        })
        .join('');

      // Re-attach event listeners to maintain base functionality
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
      grid.innerHTML =
        '<p style="color:white">Secure connection failed. Please refresh.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                background-color: #0f1115; /* Luxury Dark Mode */
                color: #ecf0f1;
                margin-top: -2rem; /* Bleed into header */
            }

            /* --- HERO SECTION --- */
            .hero {
                background: linear-gradient(rgba(0,0,0,0.3), rgba(15,17,21,1)), 
                            url('https://images.unsplash.com/photo-1551698618-1dfe5d97d256?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80');
                background-size: cover;
                background-position: center;
                padding: 100px 20px 60px 20px;
                text-align: center;
                border-bottom: 2px solid #D4AF37;
            }

            .hero h1 {
                font-size: 3rem;
                margin-bottom: 10px;
                letter-spacing: 1px;
                text-transform: uppercase;
            }

            .hero .subhead {
                font-size: 1.2rem;
                color: #bdc3c7;
                max-width: 600px;
                margin: 0 auto 30px auto;
                line-height: 1.6;
            }

            .highlight {
                color: #D4AF37; /* Gold */
                font-weight: bold;
            }

            /* --- URGENCY BANNER --- */
            .ticker-wrap {
                background: #D4AF37;
                color: #000;
                font-weight: bold;
                padding: 10px;
                text-align: center;
                font-size: 0.9rem;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* --- PRODUCT GRID --- */
            .collection-title {
                text-align: center;
                margin: 40px 0 20px 0;
                font-weight: 300;
                letter-spacing: 2px;
                color: #95a5a6;
                text-transform: uppercase;
            }

            .grid {
                display: grid;
                grid-template-columns: 1fr;
                gap: 40px;
                max-width: 800px;
                margin: 0 auto;
                padding-bottom: 60px;
            }

            .product-card {
                background: #1e2329;
                border: 1px solid #333;
                border-radius: 4px;
                overflow: hidden;
                display: flex;
                flex-direction: column; /* Mobile first, though simplified here */
                position: relative;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            @media(min-width: 600px) {
                .product-card { flex-direction: row; }
            }

            .product-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                border-color: #D4AF37;
            }

            .badge {
                position: absolute;
                top: 0;
                left: 0;
                background: #c0392b;
                color: white;
                padding: 5px 10px;
                font-size: 0.75rem;
                font-weight: bold;
                z-index: 10;
            }

            .card-image-placeholder {
                background: #2c3e50;
                min-height: 200px;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #555;
                font-style: italic;
            }

            .card-content {
                padding: 25px;
                flex: 1.5;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            .card-content h3 {
                margin: 0 0 10px 0;
                font-size: 1.5rem;
                color: #fff;
            }

            .spec-tag {
                font-size: 0.8rem;
                border: 1px solid #7f8c8d;
                padding: 2px 6px;
                border-radius: 4px;
                vertical-align: middle;
                margin-left: 10px;
                color: #bdc3c7;
            }

            .specs {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                font-size: 0.9rem;
                color: #95a5a6;
            }

            .pricing-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-bottom: 15px;
                border-bottom: 1px solid #333;
                padding-bottom: 15px;
            }

            .price {
                font-size: 1.8rem;
                color: #D4AF37;
                font-weight: bold;
                font-family: 'Consolas', monospace;
            }

            .stock-status {
                font-size: 0.8rem;
                color: #e74c3c;
                font-weight: bold;
            }

            .description {
                color: #bdc3c7;
                font-size: 0.95rem;
                line-height: 1.5;
                margin-bottom: 20px;
            }

            .buy-btn {
                background: #D4AF37;
                color: #000;
                border: none;
                padding: 15px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                cursor: pointer;
                transition: background 0.3s;
            }

            .buy-btn:hover {
                background: #f1c40f;
            }

            .buy-btn:disabled {
                background: #555;
                color: #888;
                cursor: not-allowed;
            }

            .loading-pulse {
                text-align: center;
                color: #7f8c8d;
                padding: 50px;
                font-style: italic;
                animation: pulse 1.5s infinite;
            }

            @keyframes pulse {
                0% { opacity: 0.5; }
                50% { opacity: 1; }
                100% { opacity: 0.5; }
            }
        </style>

        <div class="ticker-wrap">
            ⚠️ High Demand: Calgary Logistics Hub Priority Shipping Ends in <span id="logisticsTimer">00:00:00</span>
        </div>

        <div class="hero">
            <h1>The Summit Series</h1>
            <p class="subhead">
                Welcome back. We've curated a selection specifically for your <span class="highlight">Backcountry</span> ambitions. 
                Lightweight engineering meets <span class="highlight">Avalanche Safety</span> compliance.
            </p>
        </div>

        <h2 class="collection-title">Reserved For You</h2>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

// Define the custom element
customElements.define('home-page', HomePage);
