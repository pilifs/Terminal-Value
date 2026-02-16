class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // Attempt to get client details from global state if available
    this.clientName = window.state?.clientProfile?.name || 'Client';
    this.clientCity = window.state?.clientProfile?.city || 'Vancouver';
    this.render();
    this.loadInventory();
  }

  // Helper to generate "Financial Advisor" copy based on item price/name
  getAdvisorAnalysis(item) {
    const price = item.cost * 1.5;
    
    // Logic to tailor the pitch
    if (price > 1000) {
      return {
        badge: "BLUE CHIP ASSET",
        note: "This 'World Cup' tier construction offers maximum resale value retention. A durable legacy asset for your portfolio.",
        roi: "High Performance Yield"
      };
    } else if (item.name.includes("Mountain") || item.name.includes("Explorer")) {
      return {
        badge: "HYBRID UTILITY",
        note: "Perfect for the slope-to-lodge transition. Maximizes utility for the digital nomad lifestyle by reducing gear-change friction.",
        roi: "Lifestyle Dividend"
      };
    } else if (item.name.includes("Park") || item.name.includes("Freestyle")) {
      return {
        badge: "HIGH GROWTH",
        note: "An aggressive asset for skill acquisition. Durability guarantee ensures it withstands high-impact usage.",
        roi: "Skill Cap Increase"
      };
    } else {
      return {
        badge: "SOLID FOUNDATION",
        note: "Low entry cost with reliable returns on happiness. A stable cornerstone for your winter health strategy.",
        roi: "Mental Health ROI"
      };
    }
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    const portfolioSummary = this.shadowRoot.getElementById('portfolioSummary');
    
    grid.innerHTML = '<div class="loading">Analyzing Market Availability...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Calculate "Total Market Cap" purely for flavor
      const marketCap = inventory.reduce((acc, item) => acc + (item.cost * 1.5), 0);
      portfolioSummary.textContent = `Market Cap Available: $${marketCap.toLocaleString()} CAD`;

      grid.innerHTML = inventory
        .map((item) => {
          const price = item.cost * 1.5;
          const analysis = this.getAdvisorAnalysis(item);
          const isStocked = item.stock > 0;

          return `
            <div class="asset-card ${!isStocked ? 'delisted' : ''}">
                <div class="asset-header">
                  <span class="ticker">${item.sku.split('-')[1] || 'ASSET'}</span>
                  <span class="badge">${analysis.badge}</span>
                </div>
                
                <h3>${item.name}</h3>
                
                <div class="analysis-section">
                  <p class="advisor-note">"${analysis.note}"</p>
                  <div class="metrics">
                    <div class="metric">
                      <span>Durability</span>
                      <div class="bar"><div style="width: ${Math.min(100, (price/1200)*100)}%"></div></div>
                    </div>
                    <div class="metric">
                      <span>Resale Potential</span>
                      <div class="bar"><div style="width: ${Math.min(100, (price/1000)*90)}%"></div></div>
                    </div>
                  </div>
                </div>

                <div class="financials">
                   <div class="cost-row">
                      <span>Initial Investment</span>
                      <span class="price">$${price.toFixed(2)}</span>
                   </div>
                   <div class="roi-row">
                      <span>Projected ROI</span>
                      <span class="roi-val">${analysis.roi}</span>
                   </div>
                </div>

                <button 
                    class="acquire-btn" 
                    data-id="${item.id}"
                    ${!isStocked ? 'disabled' : ''}>
                    ${isStocked ? 'ACQUIRE ASSET' : 'DELISTED (OOS)'}
                </button>
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
      grid.innerHTML = '<p>Error retrieving market data.</p>';
      console.error(e);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
              display: block; 
              animation: fadeIn 0.4s ease-out; 
              font-family: 'Georgia', serif; /* More formal font */
              color: #2c3e50;
            }
            
            /* Header Section */
            .advisor-header {
              background: linear-gradient(135deg, #1a252f 0%, #2c3e50 100%);
              color: #ecf0f1;
              padding: 30px;
              border-radius: 8px;
              margin-bottom: 30px;
              border-bottom: 4px solid #f39c12; /* Gold accent */
            }
            .advisor-header h2 { margin: 0; font-family: 'Segoe UI', sans-serif; font-weight: 300; letter-spacing: 1px; }
            .advisor-header h1 { margin: 10px 0; font-size: 2rem; color: #fff; }
            .advisor-header p { opacity: 0.8; font-style: italic; max-width: 600px; }
            .market-stat { font-family: 'Consolas', monospace; color: #f39c12; margin-top: 10px; font-size: 0.9rem; }

            /* Grid Layout */
            .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); 
              gap: 25px; 
            }

            /* Asset Card */
            .asset-card { 
              background: white; 
              border: 1px solid #dcdcdc; 
              border-radius: 4px; 
              padding: 0;
              transition: transform 0.2s, box-shadow 0.2s;
              display: flex;
              flex-direction: column;
            }
            .asset-card:hover {
              transform: translateY(-5px);
              box-shadow: 0 10px 20px rgba(0,0,0,0.1);
              border-color: #f39c12;
            }
            .delisted { opacity: 0.6; pointer-events: none; }

            .asset-header {
              background: #f8f9fa;
              padding: 15px 20px;
              border-bottom: 1px solid #eee;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .ticker { font-family: 'Consolas', monospace; color: #7f8c8d; font-weight: bold; }
            .badge { 
              background: #2c3e50; 
              color: #f39c12; 
              padding: 4px 8px; 
              font-size: 0.7rem; 
              text-transform: uppercase; 
              letter-spacing: 1px;
              border-radius: 2px;
            }

            .asset-card h3 { 
              margin: 20px; 
              font-family: 'Segoe UI', sans-serif; 
              font-size: 1.4rem;
            }

            .analysis-section {
              padding: 0 20px;
              flex-grow: 1;
            }
            .advisor-note {
              font-style: italic;
              color: #555;
              border-left: 3px solid #f39c12;
              padding-left: 10px;
              margin-bottom: 20px;
              font-size: 0.95rem;
              line-height: 1.5;
            }

            /* Metrics Visuals */
            .metrics { margin-bottom: 20px; }
            .metric { display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px; color: #7f8c8d; font-family: 'Segoe UI', sans-serif; }
            .bar { width: 100px; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
            .bar div { height: 100%; background: #27ae60; }

            /* Financials Footer */
            .financials {
              background: #fcfcfc;
              border-top: 1px solid #eee;
              padding: 20px;
            }
            .cost-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
            .price { font-size: 1.4rem; font-weight: bold; color: #2c3e50; font-family: 'Segoe UI', sans-serif; }
            .roi-row { display: flex; justify-content: space-between; font-size: 0.85rem; color: #27ae60; font-weight: bold; }

            /* Button */
            .acquire-btn { 
              width: 100%; 
              padding: 15px; 
              background: #2c3e50; 
              color: white; 
              border: none; 
              font-size: 1rem; 
              text-transform: uppercase; 
              letter-spacing: 2px; 
              cursor: pointer; 
              transition: background 0.2s;
            }
            .acquire-btn:hover { background: #34495e; }
            .acquire-btn:disabled { background: #bdc3c7; cursor: not-allowed; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            .loading { text-align: center; padding: 40px; color: #7f8c8d; font-style: italic; }
        </style>

        <div class="advisor-header">
            <h2>PRIVATE WEALTH ADVISORY</h2>
            <h1>Portfolio Strategy for ${this.clientCity}</h1>
            <p>
              "Investing in premium gear isn't an expense—it's capital allocation towards your physical and mental longevity. 
              Quality assets guarantee reduced downtime and higher performance returns on the mountain."
            </p>
            <div id="portfolioSummary" class="market-stat">Loading Market Data...</div>
        </div>

        <div id="productGrid" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);