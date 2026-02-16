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
    const grid = this.shadowRoot.getElementById('assetGrid');
    const advisorNote = this.shadowRoot.getElementById('advisorNote');
    
    // Personalize based on Global State if available
    const city = window.state?.clientProfile?.city || 'Aspen';
    advisorNote.innerHTML = `
      <strong>Advisor Note for ${city} Conditions:</strong> 
      Current hardpack requires maximum torsional rigidity. 
      Allocating capital to stiffer platforms will yield higher long-term dividends in edge retention and joint preservation.
    `;

    grid.innerHTML = '<div class="loading">Analyzing Market Availability...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Filter logic: In a real app we might filter for "Race" gear, 
      // but here we apply the "Asset" framing to all items.
      grid.innerHTML = inventory
        .map((item) => {
           // Calculate a mock "5-Year Value" to show ROI
           const price = item.cost * 1.5;
           const resaleVal = (price * 0.4).toFixed(0); // Arbitrary high resale value
           const costPerSeason = (price / 5).toFixed(2); // "Amortization"
           
           return `
            <div class="asset-card">
                <div class="card-header">
                  <span class="asset-class">CLASS: TACTICAL / RACE</span>
                  <span class="stock-status ${item.stock > 0 ? 'liquid' : 'illiquid'}">
                    ${item.stock > 0 ? '• MARKET LIQUID' : '• ASSET FROZEN'}
                  </span>
                </div>
                
                <h3>${item.name}</h3>
                <div class="specs">
                  <p><strong>Durability Rating:</strong> AAA+ (High DIN Rated)</p>
                  <p><strong>Est. Resale Value:</strong> $${resaleVal} (Yr 3)</p>
                </div>

                <div class="financials">
                  <div class="row">
                    <span>Acquisition Cost:</span>
                    <span class="val price">$${price.toFixed(2)}</span>
                  </div>
                  <div class="row details">
                    <span>Amortized Cost (5 yrs):</span>
                    <span class="val">$${costPerSeason} / yr</span>
                  </div>
                </div>

                <button 
                    class="invest-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? 'EXECUTE ACQUISITION' : 'UNAVAILABLE'}
                </button>
            </div>
          `;
        })
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.invest-btn').forEach((btn) => {
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
      grid.innerHTML = '<p class="error">Market Data Connection Failed.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
              display: block; 
              animation: fadeIn 0.4s; 
              font-family: 'Georgia', 'Times New Roman', serif; /* Financial/Serious feel */
              color: #333;
            }
            
            /* Header Section */
            .brief-container {
              background: #fff;
              border-left: 5px solid #2c3e50;
              padding: 20px;
              margin-bottom: 30px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.05);
            }
            h2 { 
              margin: 0 0 10px 0; 
              color: #2c3e50; 
              font-size: 1.8rem;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .sub-head {
              font-family: 'Segoe UI', sans-serif;
              color: #7f8c8d;
              font-style: italic;
              margin-bottom: 15px;
            }
            #advisorNote {
              font-family: 'Segoe UI', sans-serif;
              background: #fdfefe;
              border: 1px solid #bdc3c7;
              padding: 15px;
              border-radius: 4px;
              color: #2c3e50;
              font-size: 0.95rem;
              line-height: 1.5;
            }

            /* Value Props */
            .value-props {
              display: flex;
              gap: 20px;
              margin-bottom: 30px;
            }
            .prop {
              flex: 1;
              background: #ecf0f1;
              padding: 15px;
              text-align: center;
              border-radius: 4px;
              font-family: 'Segoe UI', sans-serif;
              font-size: 0.85rem;
              color: #555;
            }
            .prop strong { display: block; color: #2980b9; margin-bottom: 5px; font-size: 1rem; }

            /* Grid */
            .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
              gap: 25px; 
            }
            
            /* Asset Card */
            .asset-card { 
              background: white; 
              border: 1px solid #dcdcdc; 
              border-top: 4px solid #gold;
              border-radius: 2px;
              padding: 25px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.05); 
              transition: transform 0.2s;
              display: flex;
              flex-direction: column;
            }
            .asset-card:hover {
              transform: translateY(-3px);
              box-shadow: 0 5px 15px rgba(0,0,0,0.1);
              border-color: #2980b9;
            }

            .card-header {
              display: flex;
              justify-content: space-between;
              font-size: 0.7rem;
              font-family: 'Segoe UI', sans-serif;
              margin-bottom: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .stock-status { font-weight: bold; }
            .stock-status.liquid { color: #27ae60; }
            .stock-status.illiquid { color: #c0392b; }

            h3 { 
              margin: 0 0 15px 0; 
              font-size: 1.4rem; 
              color: #2c3e50; 
            }

            .specs {
              font-family: 'Segoe UI', sans-serif;
              font-size: 0.85rem;
              color: #7f8c8d;
              margin-bottom: 20px;
              border-bottom: 1px solid #eee;
              padding-bottom: 10px;
            }
            .specs p { margin: 5px 0; }

            .financials {
              background: #f9f9f9;
              padding: 15px;
              border-radius: 4px;
              margin-bottom: 20px;
              font-family: 'Consolas', monospace; /* Ticker tape style */
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .row.details {
              color: #95a5a6;
              font-size: 0.8rem;
            }
            .price { 
              color: #2c3e50; 
              font-weight: bold; 
              font-size: 1.1rem;
            }

            /* Buttons */
            .invest-btn { 
              background: #2c3e50; 
              color: #ecf0f1; 
              border: none; 
              padding: 15px; 
              text-transform: uppercase;
              letter-spacing: 1px;
              font-weight: bold;
              cursor: pointer; 
              width: 100%; 
              margin-top: auto;
              font-family: 'Segoe UI', sans-serif;
              transition: background 0.2s;
            }
            .invest-btn:hover { background: #34495e; }
            .invest-btn:disabled { background: #bdc3c7; cursor: not-allowed; }

            .loading { text-align: center; color: #7f8c8d; padding: 40px; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="brief-container">
          <h2>Portfolio Allocation: Alpine Hardware</h2>
          <div class="sub-head">Prepared for: Professional Tier // Technical Division</div>
          <div id="advisorNote">
            <!-- Dynamic Content -->
          </div>
        </div>

        <div class="value-props">
          <div class="prop">
            <strong>Health Dividend</strong>
            Vibration dampening reduces knee load by 40%. Investment in longevity.
          </div>
          <div class="prop">
            <strong>Performance Yield</strong>
            Pro-stock stiffness guarantees zero deflection on high-G turns.
          </div>
          <div class="prop">
            <strong>Asset Durability</strong>
            Limited run manufacturing. High resale potential in secondary collector markets.
          </div>
        </div>

        <div id="assetGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);