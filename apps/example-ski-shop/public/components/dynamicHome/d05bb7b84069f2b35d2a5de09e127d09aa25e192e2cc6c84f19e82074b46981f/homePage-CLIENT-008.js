class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  calculateMetrics(cost) {
    const marketPrice = cost * 1.5;
    // Financial framing: High-end gear retains ~60% value on resale market
    const resaleValue = marketPrice * 0.6; 
    const netCost = marketPrice - resaleValue;
    return {
      marketPrice: marketPrice.toFixed(2),
      resaleValue: resaleValue.toFixed(2),
      netCost: netCost.toFixed(2)
    };
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    grid.innerHTML = '<div class="loading">Analyzing market availability...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map((item) => {
          const metrics = this.calculateMetrics(item.cost);
          const isStocked = item.stock > 0;

          return `
            <div class="asset-card ${!isStocked ? 'out-of-market' : ''}">
                <div class="card-header">
                    <h3>${item.name}</h3>
                    <span class="rating">AAA RATED DURABILITY</span>
                </div>
                
                <div class="financial-breakdown">
                    <div class="row">
                        <span class="label">Acquisition Cost:</span>
                        <span class="value price">$${metrics.marketPrice}</span>
                    </div>
                    <div class="row highlight">
                        <span class="label">Est. Resale Value:</span>
                        <span class="value resale">-$${metrics.resaleValue}*</span>
                    </div>
                    <div class="divider"></div>
                    <div class="row net-cost">
                        <span class="label">Proj. Net Cost:</span>
                        <span class="value">$${metrics.netCost}</span>
                    </div>
                </div>

                <div class="meta-info">
                    <p class="stock-status">
                        ${isStocked ? `Liquid Assets: ${item.stock}` : 'Market Illiquid (Sold Out)'}
                    </p>
                </div>

                <button 
                    class="acquire-btn" 
                    data-id="${item.id}"
                    ${!isStocked ? 'disabled' : ''}>
                    ${isStocked ? 'Acquire Asset' : 'Unavailble'}
                </button>
                <p class="disclaimer">*Based on secondary market liquidity for racing gear.</p>
            </div>
          `;
        })
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.acquire-btn').forEach((btn) => {
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
      grid.innerHTML = '<p class="error">Unable to fetch market data.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
          :host { 
              display: block; 
              animation: fadeIn 0.4s ease-out; 
              font-family: 'Segoe UI', sans-serif;
              color: #34495e;
          }
          
          /* Header Section */
          .advisor-header {
              background: #fff;
              padding: 20px;
              border-left: 5px solid #27ae60;
              margin-bottom: 25px;
              border-radius: 4px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          .advisor-header h2 { margin: 0; font-size: 1.5rem; color: #2c3e50; }
          .advisor-header p { margin: 5px 0 0 0; color: #7f8c8d; font-size: 0.95rem; line-height: 1.4; }
          .advisor-tag { 
              display: inline-block; 
              background: #e8f8f5; 
              color: #27ae60; 
              padding: 2px 8px; 
              border-radius: 4px; 
              font-size: 0.8rem; 
              font-weight: bold; 
              margin-bottom: 5px;
          }

          /* Grid Layout */
          .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
              gap: 25px; 
          }

          /* Asset Card */
          .asset-card { 
              background: white; 
              border: 1px solid #bdc3c7; 
              border-radius: 6px; 
              padding: 20px; 
              display: flex;
              flex-direction: column;
              transition: transform 0.2s, box-shadow 0.2s;
          }
          .asset-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
              border-color: #3498db;
          }
          .out-of-market { opacity: 0.7; background: #f9f9f9; }

          /* Card Header */
          .card-header h3 { margin: 0; font-size: 1.1rem; color: #2c3e50; }
          .rating { 
              font-size: 0.7rem; 
              background: #f1c40f; 
              color: #7f8c00; 
              padding: 2px 5px; 
              border-radius: 2px; 
              font-weight: bold; 
              letter-spacing: 0.5px;
          }

          /* Financial Breakdown Table */
          .financial-breakdown {
              margin: 15px 0;
              background: #f8f9fa;
              padding: 10px;
              border-radius: 4px;
              font-size: 0.9rem;
          }
          .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .label { color: #7f8c8d; }
          .value { font-family: 'Consolas', monospace; font-weight: 600; }
          .price { color: #2c3e50; }
          .resale { color: #27ae60; } /* Green for money back */
          .highlight { color: #27ae60; }
          
          .divider { border-top: 1px dashed #bdc3c7; margin: 8px 0; }
          
          .net-cost .label { font-weight: bold; color: #2c3e50; }
          .net-cost .value { font-size: 1.1rem; color: #2980b9; }

          /* Meta & Buttons */
          .stock-status { font-size: 0.8rem; color: #95a5a6; margin: 10px 0; font-style: italic; }
          
          button.acquire-btn { 
              background: #2c3e50; 
              color: white; 
              border: none; 
              padding: 12px; 
              border-radius: 4px; 
              cursor: pointer; 
              width: 100%; 
              font-weight: bold;
              text-transform: uppercase;
              font-size: 0.9rem;
              letter-spacing: 1px;
              margin-top: auto;
          }
          button.acquire-btn:hover { background: #34495e; }
          button.acquire-btn:disabled { background: #bdc3c7; cursor: not-allowed; }

          .disclaimer { font-size: 0.7rem; color: #bdc3c7; margin-top: 8px; text-align: right; }
          .loading, .error { text-align: center; padding: 20px; color: #7f8c8d; }

          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="advisor-header">
          <span class="advisor-tag">FAMILY WEALTH STRATEGY</span>
          <h2>Performance Asset Allocation</h2>
          <p>
            Avoid the "rental trap." High-performance racing gear is a durable asset class with strong resale liquidity. 
            Invest in your children's development today, and recover up to 60% of capital on the secondary market next season.
          </p>
      </div>

      <div id="productGrid" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);