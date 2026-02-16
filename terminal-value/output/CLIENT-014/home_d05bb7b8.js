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
    const header = this.shadowRoot.getElementById('advisorHeader');
    
    // Personalize Header based on Global State
    const client = window.state.clientProfile || {};
    const city = client.city || 'Burlington';
    
    header.innerHTML = `
      <div class="vip-banner">
        <h3>📈 Portfolio Review: ${city} Sector</h3>
        <p><strong>Client Status:</strong> 10-Year Loyalty (Retiree Tier)</p>
        <p><strong>Note:</strong> Your dark roast coffee is waiting at the counter.</p>
      </div>
      <p class="intro-text">
        Based on your projected volume of <strong>100+ days</strong> on mountain this fiscal year, 
        we have curated these assets to maximize your health dividends and comfort returns.
      </p>
    `;

    grid.innerHTML = '<div class="loading">Analyzing market data...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map((item) => {
          const price = item.cost * 1.5;
          // Strategy: Calculate Cost Per Use (CPU) based on 100 days/year
          const cpu = (price / 100).toFixed(2);
          const resale = (price * 0.4).toFixed(0);

          return `
            <div class="card">
                <div class="badge">AAA Rated Durability</div>
                <h3>${item.name}</h3>
                
                <div class="financial-breakdown">
                  <div class="row">
                    <span>Principal Investment:</span>
                    <span class="highlight">$${price.toFixed(2)}</span>
                  </div>
                  <div class="row">
                    <span>Est. Resale Value:</span>
                    <span>$${resale}</span>
                  </div>
                  <div class="divider"></div>
                  <div class="row cpu-row">
                    <span>Cost Per Day (1 Season):</span>
                    <span class="cpu-price">$${cpu}</span>
                  </div>
                </div>

                <p class="pitch">
                  Invest in your knees and back. This asset guarantees premium comfort 
                  allocation for long-term performance.
                </p>

                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? 'Acquire Asset' : 'Market Unavailable'}
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
      grid.innerHTML = '<p>Unable to retrieve portfolio data.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Georgia', serif; color: #2c3e50; }
            
            /* VIP Header Styling */
            .vip-banner {
              background: #2c3e50;
              color: #ecf0f1;
              padding: 20px;
              border-radius: 4px;
              border-left: 6px solid #f1c40f; /* Gold border for VIP */
              margin-bottom: 20px;
            }
            .vip-banner h3 { margin: 0 0 10px 0; font-family: 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: 1px; }
            .vip-banner p { margin: 5px 0; font-size: 0.95rem; }
            
            .intro-text {
              font-style: italic;
              margin-bottom: 30px;
              color: #555;
              border-left: 4px solid #bdc3c7;
              padding-left: 15px;
            }

            .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
              gap: 25px; 
            }

            /* Financial Card Styling */
            .card { 
              background: #fff; 
              border: 1px solid #dcdcdc;
              border-top: 4px solid #27ae60; /* Investment Green */
              padding: 25px; 
              box-shadow: 0 4px 10px rgba(0,0,0,0.05); 
              position: relative;
            }

            .badge {
              position: absolute;
              top: -12px;
              right: 10px;
              background: #f1c40f;
              color: #2c3e50;
              font-weight: bold;
              font-size: 0.7rem;
              padding: 4px 8px;
              border-radius: 2px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              text-transform: uppercase;
            }

            .card h3 { 
              margin-top: 5px; 
              color: #2c3e50; 
              font-size: 1.3rem;
            }

            .financial-breakdown {
              background: #f9fbfd;
              padding: 15px;
              border-radius: 4px;
              margin: 15px 0;
              font-family: 'Consolas', monospace; /* Data look */
              font-size: 0.85rem;
            }

            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              color: #7f8c8d;
            }
            
            .highlight { color: #2c3e50; font-weight: bold; }
            
            .divider { border-bottom: 1px dashed #ccc; margin: 8px 0; }
            
            .cpu-row { align-items: center; margin-bottom: 0; }
            .cpu-price { 
              color: #27ae60; 
              font-weight: bold; 
              font-size: 1.2rem; 
            }

            .pitch {
              font-size: 0.9rem;
              line-height: 1.5;
              color: #555;
              margin-bottom: 20px;
            }

            button { 
              background: #2c3e50; 
              color: white; 
              border: none; 
              padding: 12px; 
              border-radius: 2px; 
              cursor: pointer; 
              width: 100%; 
              font-size: 0.9rem; 
              text-transform: uppercase; 
              letter-spacing: 1px;
              transition: background 0.2s;
            }
            button:hover { background: #34495e; }
            button:disabled { background: #95a5a6; cursor: not-allowed; }

            .loading { text-align: center; padding: 40px; color: #7f8c8d; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div id="advisorHeader"></div>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);