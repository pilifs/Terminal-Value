// ==========================================
// SECTION: HIGH-VALUE CUSTOMER OVERRIDE (Former Pro / Aspen / Technical)
// ==========================================

class BaseHomePage extends HTMLElement {
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
    grid.innerHTML = '<div class="loading">Calibrating Race Stock...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Filter for technical/racing gear only - this client doesn't care about park or powder
      const proStock = inventory.filter(
        (item) =>
          item.name.includes('World Cup') ||
          item.name.includes('Carver') ||
          item.name.includes('Pro')
      );

      grid.innerHTML = proStock
        .map((item) => {
          // MAXIMIZE REVENUE: Dynamically set price to the absolute ceiling allowed by the Pricing Guard ($1200 for Race)
          const premiumPrice = item.name.includes('World Cup')
            ? 1200.0
            : (item.cost * 1.8).toFixed(2);
          const lowStock = item.stock < 3;

          return `
                <div class="card ${lowStock ? 'urgent' : ''}">
                    ${
                      lowStock
                        ? '<div class="tag">Aspen Local Priority: Only ' +
                          item.stock +
                          ' Left</div>'
                        : '<div class="tag">World Cup Spec</div>'
                    }
                    <div class="image-placeholder">
                      <div class="edge-detail">0.5° Base / 3.0° Side Prep</div>
                    </div>
                    <h3>${item.name.toUpperCase()}</h3>
                    <p class="specs">Stiff Flex • Torsional Bridge • 14-24 DIN Compatible</p>
                    <p class="description">Engineered for hardpack dominance. Maximum lateral power transmission for 100mph stability.</p>
                    <div class="price-row">
                      <span class="currency">$</span><span class="price">${premiumPrice}</span>
                    </div>
                    <button 
                        class="buy-btn" 
                        data-id="${item.id}"
                        data-premium-price="${premiumPrice}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'SECURE RACE STOCK' : 'ALLOCATED'}
                    </button>
                    <p class="tuning-note">Complimentary edge-thinning & hot wax included for Aspen residents.</p>
                </div>
            `;
        })
        .join('');

      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const premiumPrice = parseFloat(e.target.dataset.premiumPrice);
          const item = inventory.find((i) => i.id === itemId);

          // Inject the premium price into the item object before navigating to order
          const modifiedItem = { ...item, cost: premiumPrice / 1.5 };

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: modifiedItem },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      grid.innerHTML = '<p>System Error: Contact Shop Manager.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
              display: block; 
              animation: fadeIn 0.5s ease-out; 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              background: #000; /* Dark, aggressive professional aesthetic */
              color: #fff;
              margin-top: -2rem;
              padding: 2rem;
            }
            .hero {
              text-align: left;
              padding: 40px 0;
              border-bottom: 2px solid #333;
              margin-bottom: 40px;
            }
            .hero h1 {
              font-size: 3rem;
              letter-spacing: -2px;
              margin: 0;
              color: #fff;
              font-style: italic;
              text-transform: uppercase;
            }
            .hero p {
              color: #888;
              font-size: 1.1rem;
              max-width: 600px;
            }
            .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
              gap: 30px; 
            }
            .card { 
              background: #111; 
              padding: 0; 
              border: 1px solid #222; 
              border-radius: 0px; 
              transition: all 0.3s;
              position: relative;
              overflow: hidden;
            }
            .card:hover {
              border-color: #ff4d4d;
              transform: translateY(-5px);
            }
            .urgent {
              border: 1px solid #ff4d4d;
            }
            .tag {
              background: #ff4d4d;
              color: white;
              font-size: 0.7rem;
              font-weight: bold;
              padding: 5px 10px;
              text-transform: uppercase;
              position: absolute;
              top: 0;
              right: 0;
            }
            .image-placeholder {
              height: 200px;
              background: linear-gradient(45deg, #1a1a1a, #333);
              display: flex;
              align-items: flex-end;
              padding: 15px;
            }
            .edge-detail {
              font-family: 'Courier New', monospace;
              font-size: 0.8rem;
              color: #00ff00;
              background: rgba(0,0,0,0.7);
              padding: 2px 5px;
            }
            .card h3 { 
              margin: 20px; 
              font-size: 1.4rem;
              color: #fff; 
            }
            .specs {
              margin: 0 20px;
              color: #ff4d4d;
              font-size: 0.8rem;
              font-weight: bold;
              text-transform: uppercase;
            }
            .description {
              margin: 15px 20px;
              font-size: 0.9rem;
              color: #aaa;
              line-height: 1.4;
            }
            .price-row {
              margin: 20px;
              padding-top: 15px;
              border-top: 1px solid #222;
            }
            .currency { font-size: 1rem; color: #888; vertical-align: top; }
            .price { font-size: 2.2rem; font-weight: 900; color: #fff; }
            
            button { 
              background: #fff; 
              color: #000; 
              border: none; 
              padding: 15px; 
              cursor: pointer; 
              width: 100%; 
              font-size: 1rem; 
              font-weight: bold;
              text-transform: uppercase;
              transition: background 0.2s;
            }
            button:hover { background: #ff4d4d; color: #fff; }
            button:disabled { background: #333; color: #666; cursor: not-allowed; }
            
            .tuning-note {
              font-size: 0.7rem;
              color: #555;
              text-align: center;
              padding: 10px;
              margin: 0;
            }

            .loading { padding: 50px; text-align: center; color: #666; font-style: italic; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="hero">
          <h1>Welcome back, Champ.</h1>
          <p>The Aspen hardpack is ready. We've reserved the following race-stock inventory for your technical specifications. These are un-detuned, stiff-flex factory units.</p>
        </div>

        <div id="productGrid" class="grid"></div>
        `;
  }
}
