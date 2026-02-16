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
    const advisorNote = this.shadowRoot.getElementById('advisor-note');
    
    // Personalized Advisor Note based on Client CRM Data
    advisorNote.innerHTML = `
      <strong>ADVISOR MEMO:</strong> Analyzing your usage patterns in Banff, we see a high rate of equipment depreciation due to "rough usage" and heavy camera loads. 
      <br><br>
      <em>Recommendation:</em> Shift strategy from consumable gear to <strong>Institutional-Grade Assets</strong>. Higher upfront capital allocation will yield long-term savings on replacement costs and protect your primary income assets (camera gear).
    `;

    grid.innerHTML = '<div class="loading">Analyzing Market Availability...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      grid.innerHTML = inventory
        .map((item) => {
            const price = item.cost * 1.5;
            // Calculate a fake "Durability ROI" based on price
            const durabilityScore = Math.min(10, Math.floor((price / 100) + 2));
            const isPremium = price > 800;
            
            return `
                <div class="asset-card ${isPremium ? 'premium-asset' : ''}">
                    <div class="asset-header">
                        <h3>${item.name}</h3>
                        ${isPremium ? '<span class="badge">AAA RATED</span>' : ''}
                    </div>
                    
                    <div class="asset-specs">
                        <div class="spec-row">
                            <span>Durability Index:</span>
                            <div class="meter">
                                <div class="fill" style="width:${durabilityScore * 10}%"></div>
                            </div>
                        </div>
                        <div class="spec-row">
                            <span>Load Stability:</span>
                            <span>${isPremium ? 'Maximum' : 'Standard'}</span>
                        </div>
                        <div class="spec-row">
                            <span>Est. Resale Value:</span>
                            <span>High</span>
                        </div>
                    </div>

                    <div class="financials">
                        <div class="cost-breakdown">
                            <span class="label">Initial Investment</span>
                            <span class="value">$${price.toFixed(2)}</span>
                        </div>
                        <div class="amortization">
                            Est. cost per season: $${(price / 5).toFixed(2)}
                        </div>
                    </div>

                    <button 
                        class="acquire-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'ACQUIRE ASSET' : 'MARKET CLOSED'}
                    </button>
                    
                    <p class="stock-status">
                        ${item.stock > 0 ? `Market Liquidity: ${item.stock} Units` : 'Asset Unavailable'}
                    </p>
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
      grid.innerHTML = '<p>Unable to retrieve market data.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: 'Segoe UI', 'Helvetica Neue', sans-serif; 
                color: #333;
                animation: fadeIn 0.4s ease-out;
            }
            
            h2 {
                font-weight: 300;
                text-transform: uppercase;
                letter-spacing: 2px;
                border-bottom: 2px solid #2c3e50;
                padding-bottom: 10px;
                color: #2c3e50;
            }

            .advisor-panel {
                background-color: #f8f9fa;
                border-left: 5px solid #27ae60;
                padding: 15px 20px;
                margin-bottom: 30px;
                font-size: 0.95rem;
                color: #555;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }

            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                gap: 25px; 
            }

            .asset-card { 
                background: white; 
                border: 1px solid #e0e0e0; 
                border-radius: 4px; 
                padding: 20px; 
                display: flex;
                flex-direction: column;
                transition: transform 0.2s, box-shadow 0.2s;
            }

            .asset-card:hover {
                transform: translateY(-3px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                border-color: #bdc3c7;
            }

            .asset-card.premium-asset {
                border-top: 4px solid #f1c40f; /* Gold for premium */
            }

            .asset-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: 15px;
            }

            .asset-header h3 {
                margin: 0;
                font-size: 1.1rem;
                color: #2c3e50;
                font-weight: 600;
            }

            .badge {
                background: #f1c40f;
                color: #fff;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 3px 6px;
                border-radius: 2px;
                text-shadow: 0 1px 1px rgba(0,0,0,0.2);
            }

            .asset-specs {
                margin-bottom: 20px;
                font-size: 0.85rem;
                color: #7f8c8d;
            }

            .spec-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                align-items: center;
            }

            .meter {
                width: 60px;
                height: 6px;
                background: #eee;
                border-radius: 3px;
                overflow: hidden;
            }

            .fill {
                height: 100%;
                background: #27ae60;
            }

            .financials {
                background: #fdfdfd;
                border: 1px solid #eee;
                padding: 10px;
                margin-bottom: 15px;
                border-radius: 4px;
            }

            .cost-breakdown {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }

            .cost-breakdown .label {
                font-size: 0.8rem;
                text-transform: uppercase;
                color: #95a5a6;
            }

            .cost-breakdown .value {
                font-size: 1.2rem;
                font-weight: bold;
                color: #2c3e50;
            }

            .amortization {
                font-size: 0.75rem;
                color: #27ae60;
                text-align: right;
                font-style: italic;
            }

            .acquire-btn { 
                background: #2c3e50; 
                color: white; 
                border: none; 
                padding: 12px; 
                border-radius: 2px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 0.9rem; 
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: background 0.2s;
            }

            .acquire-btn:hover { 
                background: #34495e; 
            }

            .acquire-btn:disabled { 
                background: #bdc3c7; 
                cursor: not-allowed; 
            }

            .stock-status {
                text-align: center;
                font-size: 0.75rem;
                color: #bdc3c7;
                margin-top: 10px;
            }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <h2>Strategic Equipment Portfolio</h2>
        
        <div id="advisor-note" class="advisor-panel">
            Loading advisor strategy...
        </div>

        <div id="productGrid" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);