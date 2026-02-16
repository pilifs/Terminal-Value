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
    grid.innerHTML = '<div class="loading">Calculating market opportunities...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map((item) => {
          // Financial Logic
          const price = item.cost * 1.5;
          const rentalCostComparison = 65; // Avg daily rental cost
          const breakEvenDays = Math.ceil(price / rentalCostComparison);
          const amortizedCost = (price / 50).toFixed(2); // Cost per day over ~50 days use

          // Determine "Asset Class" tailored to Calgary/Versatility needs
          let assetTag = "Growth Asset";
          let highlightClass = "";
          
          if (item.name.toLowerCase().includes('racer') || price > 800) {
            assetTag = "Blue Chip / High Yield";
            highlightClass = "premium-asset";
          } else if (item.name.toLowerCase().includes('all mountain')) {
            assetTag = "Diversified / Versatile"; // Good for Calgary
            highlightClass = "recommended-asset";
          }

          return `
                <div class="card ${highlightClass}">
                    <div class="asset-tag">${assetTag}</div>
                    <div class="card-header">
                        <h3>${item.name}</h3>
                        <div class="sku-ticker">TICKER: ${item.sku.split('-')[1]}</div>
                    </div>
                    
                    <div class="financial-breakdown">
                        <div class="row">
                            <span>Initial Capital:</span>
                            <span class="price">$${price.toFixed(2)}</span>
                        </div>
                        <div class="row highlight">
                            <span>Amortized Cost (50 Days):</span>
                            <span>$${amortizedCost} / day</span>
                        </div>
                        <div class="row details">
                            <span>ROI Horizon:</span>
                            <span>${breakEvenDays} uses vs. Renting</span>
                        </div>
                        <div class="row details">
                             <span>Durability Rating:</span>
                             <span>AAA (Resale Value Protected)</span>
                        </div>
                    </div>

                    <div class="stock-status">
                         Inventory Liquidity: ${item.stock > 0 ? item.stock + ' Units' : 'FROZEN'}
                    </div>

                    <button 
                        class="buy-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'ACQUIRE ASSET' : 'MARKET CLOSED'}
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
      grid.innerHTML = '<p>Market data unavailable.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Georgia', serif; color: #333; }
            
            .header-section { border-bottom: 2px solid #2c3e50; padding-bottom: 15px; margin-bottom: 20px; }
            h2 { margin: 0; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }
            .advisor-note { font-style: italic; color: #555; margin-top: 10px; font-size: 0.95rem; background: #ecf0f1; padding: 10px; border-left: 4px solid #2980b9; }

            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 25px; }
            
            .card { 
                background: white; 
                border: 1px solid #ddd; 
                border-radius: 6px; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
                display: flex; 
                flex-direction: column;
                position: relative;
                overflow: hidden;
                transition: transform 0.2s;
            }
            .card:hover { transform: translateY(-3px); box-shadow: 0 8px 15px rgba(0,0,0,0.1); border-color: #2c3e50; }
            
            /* Highlighting for recommended items */
            .card.recommended-asset { border: 2px solid #27ae60; }
            .card.premium-asset { border: 2px solid #f1c40f; }

            .asset-tag {
                background: #2c3e50; color: #fff; 
                font-size: 0.7rem; font-weight: bold; text-transform: uppercase;
                text-align: center; padding: 4px;
            }
            .recommended-asset .asset-tag { background: #27ae60; }
            .premium-asset .asset-tag { background: #f39c12; color: #000; }

            .card-header { padding: 15px; background: #f8f9fa; border-bottom: 1px solid #eee; }
            .card h3 { margin: 0 0 5px 0; font-family: 'Segoe UI', sans-serif; font-size: 1.1rem; color: #2c3e50; }
            .sku-ticker { font-family: monospace; color: #7f8c8d; font-size: 0.8rem; }

            .financial-breakdown { padding: 15px; flex-grow: 1; font-size: 0.9rem; }
            .row { display: flex; justify-content: space-between; margin-bottom: 8px; align-items: flex-end; }
            .row.highlight { color: #27ae60; font-weight: bold; border-top: 1px dashed #ddd; border-bottom: 1px dashed #ddd; padding: 8px 0; margin: 10px 0; }
            .row.details { color: #7f8c8d; font-size: 0.8rem; }
            
            .price { font-size: 1.1rem; font-weight: bold; color: #2c3e50; }

            .stock-status { font-size: 0.75rem; text-align: center; color: #95a5a6; margin-bottom: 10px; }

            button { 
                background: #2c3e50; color: white; border: none; 
                padding: 15px; width: 100%; font-size: 0.9rem; 
                text-transform: uppercase; letter-spacing: 1px; font-weight: bold; 
                cursor: pointer; transition: background 0.2s;
            }
            button:hover { background: #34495e; }
            button:disabled { background: #bdc3c7; cursor: not-allowed; }

            .loading { text-align: center; color: #7f8c8d; padding: 20px; }
            
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <div class="header-section">
            <h2>Portfolio Recommendations</h2>
            <div class="advisor-note">
                "For your Calgary profile: Stop renting liabilities. Investing in versatile, high-durability gear guarantees better returns in changing conditions."
            </div>
        </div>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);