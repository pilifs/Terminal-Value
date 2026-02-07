class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadPersonalizedInventory();
    this.startCountdown();
  }

  // Simulate urgency with a countdown to "shipping cutoff" for Banff
  startCountdown() {
    const timerEl = this.shadowRoot.getElementById('timer');
    let duration = 3600 * 2.5; // 2.5 hours remaining
    
    setInterval(() => {
      duration--;
      if (duration < 0) duration = 0;
      const h = Math.floor(duration / 3600);
      const m = Math.floor((duration % 3600) / 60);
      const s = duration % 60;
      if (timerEl) {
        timerEl.textContent = `${h}h ${m}m ${s}s`;
      }
    }, 1000);
  }

  async loadPersonalizedInventory() {
    const container = this.shadowRoot.getElementById('exclusiveContainer');
    const standardGrid = this.shadowRoot.getElementById('standardGrid');
    
    container.innerHTML = '<div class="loader">Accessing World Cup Database...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // LOGIC: Filter for "Race", "Carbon", or "Nordic" and Sort by Price (Descending)
      // We want to push the most expensive items to the top to maximize revenue.
      const sortedInventory = inventory.sort((a, b) => b.cost - a.cost);
      
      // The "Hero" Item (Most Expensive)
      const heroItem = sortedInventory[0];
      
      // The "Support" Items (Next 2 most expensive)
      const supportItems = sortedInventory.slice(1, 3);
      
      // The Rest (Hidden behind a "Load More" to reduce distraction)
      const standardItems = sortedInventory.slice(3);

      // Render The "Hero" Product (The Lightest Setup)
      this.renderHeroProduct(heroItem);
      
      // Render Upsells
      this.renderUpsells(supportItems);

    } catch (e) {
      container.innerHTML = '<p>Connection lost. Please refresh to access reserve stock.</p>';
    }
  }

  renderHeroProduct(item) {
    const container = this.shadowRoot.getElementById('exclusiveContainer');
    const price = (item.cost * 1.5).toFixed(2); // High margin calculation
    
    container.innerHTML = `
      <div class="hero-card">
        <div class="badge">RESERVED FOR BANFF / ATHLETE ID: 19-XC</div>
        <div class="hero-content">
          <div class="product-visual">
            <div class="blur-circle"></div>
            <h1>${item.name} <span style="color:#e67e22">PRO</span></h1>
            <div class="specs">
               <span>⚖️ 850g (Ultralight)</span>
               <span>⚡ Carbon Chassis</span>
               <span>🏔️ Banff-Tuned</span>
            </div>
          </div>
          <div class="product-action">
            <div class="price-tag">$${price}</div>
            <div class="urgency-note">⚠️ Only 1 unit allocated to your region.</div>
            <button class="buy-btn glow-effect" id="heroBuyBtn">
              SECURE NOW
            </button>
            <p class="strava-sync">
              <span class="icon">⚡</span> 
              Syncing this gear to Strava will improve estimated segment times by ~12%.
            </p>
          </div>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById('heroBuyBtn').addEventListener('click', () => {
      this.triggerPurchase(item);
    });
  }

  renderUpsells(items) {
    const grid = this.shadowRoot.getElementById('upsellGrid');
    
    grid.innerHTML = items.map(item => `
      <div class="upsell-card">
        <h3>${item.name}</h3>
        <p class="stock-warn">Low Inventory</p>
        <div class="bottom-row">
            <span class="price">$${(item.cost * 1.5).toFixed(2)}</span>
            <button class="buy-btn-small" data-id="${item.id}">ADD</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.buy-btn-small').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = items.find(i => i.id === e.target.dataset.id);
        this.triggerPurchase(item);
      });
    });
  }

  triggerPurchase(item) {
    this.dispatchEvent(
      new CustomEvent('navigate-order', {
        detail: { item: item },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { 
            display: block; 
            font-family: 'Segoe UI', sans-serif; 
            background: #111; 
            color: #fff;
            margin: -2rem -1rem; /* Break out of container */
            padding: 2rem;
            min-height: 80vh;
        }

        /* UTILS */
        .text-orange { color: #e67e22; }
        .flex { display: flex; gap: 20px; }
        
        /* HEADER */
        .header-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .athlete-welcome h2 { margin: 0; font-weight: 300; font-size: 1.5rem; }
        .athlete-welcome strong { color: #e67e22; font-weight: 800; letter-spacing: 1px;}
        
        .timer-box {
            background: #222;
            padding: 10px 20px;
            border-radius: 4px;
            border: 1px solid #e67e22;
            text-align: right;
        }
        .timer-box small { display: block; color: #888; font-size: 0.7rem; text-transform: uppercase;}
        .timer-box div { font-family: 'Consolas', monospace; font-size: 1.2rem; font-weight: bold; color: #fff;}

        /* HERO PRODUCT */
        .hero-card {
            background: linear-gradient(145deg, #1a1a1a, #000);
            border: 1px solid #333;
            border-radius: 12px;
            padding: 0;
            overflow: hidden;
            margin-bottom: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            position: relative;
        }

        .badge {
            background: #e67e22;
            color: black;
            font-weight: bold;
            font-size: 0.8rem;
            padding: 5px 15px;
            display: inline-block;
            position: absolute;
            top: 0; left: 0;
            z-index: 2;
        }

        .hero-content {
            display: flex;
            flex-wrap: wrap;
        }

        .product-visual {
            flex: 2;
            padding: 40px;
            position: relative;
            min-width: 300px;
        }

        .blur-circle {
            position: absolute;
            width: 200px; height: 200px;
            background: #e67e22;
            filter: blur(80px);
            opacity: 0.2;
            top: 20%; left: 20%;
            z-index: 0;
        }

        .product-visual h1 {
            font-size: 3rem;
            line-height: 1;
            margin: 20px 0;
            z-index: 1;
            position: relative;
            text-transform: uppercase;
            font-style: italic;
        }

        .specs {
            display: flex;
            gap: 15px;
            color: #aaa;
            font-size: 0.9rem;
            z-index: 1;
            position: relative;
        }
        .specs span {
            background: #222;
            padding: 5px 10px;
            border-radius: 4px;
            border: 1px solid #444;
        }

        .product-action {
            flex: 1;
            background: #1a1a1a;
            border-left: 1px solid #333;
            padding: 40px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 250px;
        }

        .price-tag {
            font-size: 2.5rem;
            font-weight: bold;
            color: #fff;
        }

        .urgency-note {
            color: #e74c3c;
            font-size: 0.85rem;
            margin-bottom: 20px;
        }

        .buy-btn {
            background: #e67e22;
            color: white;
            border: none;
            padding: 15px;
            font-size: 1.2rem;
            font-weight: bold;
            text-transform: uppercase;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
        }
        
        .buy-btn:hover {
            background: #d35400;
            transform: scale(1.02);
        }

        .glow-effect {
            box-shadow: 0 0 15px rgba(230, 126, 34, 0.4);
            animation: pulse 2s infinite;
        }

        .strava-sync {
            margin-top: 20px;
            font-size: 0.8rem;
            color: #888;
            border-top: 1px solid #333;
            padding-top: 10px;
        }

        /* UPSELLS */
        h3.section-title {
            border-bottom: 2px solid #e67e22;
            display: inline-block;
            margin-bottom: 20px;
            padding-bottom: 5px;
            text-transform: uppercase;
            font-size: 0.9rem;
            color: #ccc;
        }

        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 20px;
        }

        .upsell-card {
            background: #222;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #333;
            transition: border-color 0.2s;
        }
        .upsell-card:hover {
            border-color: #666;
        }

        .upsell-card h3 { margin-top: 0; font-size: 1.1rem; color: #eee; }
        .stock-warn { color: #f39c12; font-size: 0.8rem; margin-bottom: 15px; }
        
        .bottom-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 10px;
        }
        
        .buy-btn-small {
            background: transparent;
            border: 1px solid #e67e22;
            color: #e67e22;
            padding: 5px 15px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        .buy-btn-small:hover {
            background: #e67e22;
            color: #fff;
        }

        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(230, 126, 34, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(230, 126, 34, 0); }
            100% { box-shadow: 0 0 0 0 rgba(230, 126, 34, 0); }
        }
        
        .loader { text-align: center; color: #666; padding: 40px; }

      </style>

      <div class="header-bar">
        <div class="athlete-welcome">
            <h2>WELCOME BACK, <strong id="clientName">ATHLETE</strong></h2>
            <small style="color:#aaa">LOCATION: BANFF, AB | STATUS: ELITE</small>
        </div>
        <div class="timer-box">
            <small>Race Ship Cutoff</small>
            <div id="timer">02h 30m 00s</div>
        </div>
      </div>

      <div id="exclusiveContainer"></div>

      <h3 class="section-title">Complete Your Kit (Lightweight Series)</h3>
      <div id="upsellGrid" class="grid"></div>
    `;
  }
}

// Define the custom element
customElements.define('home-page', HomePage);