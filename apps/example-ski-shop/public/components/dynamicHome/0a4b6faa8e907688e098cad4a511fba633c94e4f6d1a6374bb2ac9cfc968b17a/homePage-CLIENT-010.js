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
    const container = this.shadowRoot.getElementById('mainContainer');
    const header = this.shadowRoot.getElementById('personalHeader');

    // 1. Get Client Context for Personalization
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');
    let city = 'Aspen'; // Default based on user profile context
    let isRacer = true; // Based on CRM context

    try {
      if (clientId) {
        const clientRes = await fetch(`/api/clients/${clientId}`);
        if (clientRes.ok) {
          const clientData = await clientRes.json();
          city = clientData.city || city;
          // Check for racing keywords in history or CRM
          const notes = (clientData.crmNotes || []).join(' ').toLowerCase();
          if (notes.includes('racer') || notes.includes('racing')) {
            isRacer = true;
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch specific client details, using defaults.');
    }

    // Update Greeting
    header.innerHTML = `
        <h1>🏁 Piste Performance: ${city}</h1>
        <p>Expert edge tuning required. Hardpack conditions ahead.</p>
    `;

    // 2. Fetch and Process Inventory
    container.innerHTML =
      '<p style="text-align:center">Calibrating inventory...</p>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Filter: Sort specifically for "Pro Racer/Hardpack" persona
      // We want World Cup Racer at the top (Blowout), followed by Carvers.
      // We push Big Mountain/Powder skis to the bottom.

      const heroItems = [];
      const standardItems = [];

      inventory.forEach((item) => {
        const name = item.name.toLowerCase();

        // Logic: Identify the World Cup Racer for the Blowout Deal
        if (name.includes('world cup') || name.includes('racer')) {
          // Requirement: Price between 0.4 * COGS and 1.0 * COGS
          // We'll give them a steal at 0.7 (70% of cost)
          item.displayPrice = (item.cost * 0.7).toFixed(2);
          item.isBlowout = true;
          item.originalPrice = (item.cost * 1.5).toFixed(2);
          heroItems.push(item);
        } else {
          // Standard Markup
          item.displayPrice = (item.cost * 1.5).toFixed(2);
          item.isBlowout = false;

          // Sort priority: Carvers first, others last
          if (name.includes('piste') || name.includes('carver')) {
            standardItems.unshift(item);
          } else {
            standardItems.push(item);
          }
        }
      });

      // Render Layout
      let html = '';

      // A. HERO SECTION (Blowout)
      if (heroItems.length > 0) {
        html += `<div class="section-title">⚠️ PRO STOCK BLOWOUT</div>`;
        html += heroItems
          .map(
            (item) => `
            <div class="hero-card">
                <div class="hero-info">
                    <h3>${item.name}</h3>
                    <p class="sku">SKU: ${item.sku} // RACING STOCK</p>
                    <p class="desc">Only for high-DIN skiers. Factory tuned.</p>
                    <div class="price-block">
                        <span class="old-price">$${item.originalPrice}</span>
                        <span class="new-price">$${item.displayPrice}</span>
                    </div>
                    <p class="stock-status">${
                      item.stock > 0 ? '✅ In Stock' : '❌ Sold Out'
                    }</p>
                </div>
                <div class="hero-action">
                    <button 
                        class="buy-btn hero-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'SECURE PAIR' : 'GONE'}
                    </button>
                </div>
            </div>
        `
          )
          .join('');
      }

      // B. GRID SECTION (Standard Inventory)
      html += `<div class="section-title">Groomer & Training Quiver</div>`;
      html += `<div class="grid">`;
      html += standardItems
        .map(
          (item) => `
        <div class="card">
            <h3>${item.name}</h3>
            <p class="stock">${
              item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'
            }</p>
            <p class="price">$${item.displayPrice}</p>
            <button 
                class="buy-btn" 
                data-id="${item.id}"
                ${item.stock <= 0 ? 'disabled' : ''}>
                ${item.stock > 0 ? 'Add to Cart' : 'Sold Out'}
            </button>
        </div>
      `
        )
        .join('');
      html += `</div>`;

      container.innerHTML = html;

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
      container.innerHTML = '<p>Error loading pro inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.4s; color: #2c3e50; }
            
            /* Header Styling */
            #personalHeader {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: #ecf0f1;
                padding: 20px;
                border-radius: 8px;
                margin-bottom: 25px;
                border-left: 5px solid #e67e22;
            }
            #personalHeader h1 { margin: 0; font-size: 1.8rem; }
            #personalHeader p { margin: 5px 0 0 0; opacity: 0.8; font-style: italic; }

            /* Hero / Blowout Styles */
            .section-title {
                font-size: 1.2rem;
                font-weight: bold;
                margin-bottom: 10px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #7f8c8d;
                border-bottom: 2px solid #ddd;
                padding-bottom: 5px;
            }
            
            .hero-card {
                background: #fff;
                border: 2px solid #e74c3c; /* Red for alert/sale */
                border-radius: 8px;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                box-shadow: 0 4px 10px rgba(231, 76, 60, 0.2);
            }
            .hero-info h3 { margin: 0; font-size: 1.8rem; color: #c0392b; }
            .sku { font-family: monospace; color: #7f8c8d; font-size: 0.9rem; }
            .desc { font-style: italic; color: #2c3e50; }
            
            .price-block { margin: 10px 0; }
            .old-price { text-decoration: line-through; color: #95a5a6; margin-right: 10px; }
            .new-price { font-size: 1.5rem; font-weight: bold; color: #c0392b; }
            
            .hero-btn {
                background: #c0392b;
                font-size: 1.2rem;
                padding: 15px 30px;
            }
            .hero-btn:hover { background: #e74c3c; }

            /* Standard Grid Styles (matching existing look) */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; border-top: 3px solid #3498db; }
            .card h3 { margin: 0 0 10px 0; font-size: 1.1rem; }
            .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.85rem; margin-bottom: 15px; }
            
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-family: 'Segoe UI', sans-serif; transition: background 0.2s; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            
            /* Responsive layout for Hero */
            @media (max-width: 600px) {
                .hero-card { flex-direction: column; text-align: center; }
                .hero-action { width: 100%; margin-top: 15px; }
            }
        </style>

        <div id="personalHeader"></div>
        <div id="mainContainer"></div>
        `;
  }
}

customElements.define('home-page', HomePage);
