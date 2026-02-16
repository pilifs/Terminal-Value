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
    const advisorNote = this.shadowRoot.getElementById('advisorNote');
    
    grid.innerHTML = '<div class="loading">Analyzing Market Data...</div>';

    try {
      const res = await fetch('/api/inventory');
      let inventory = await res.json();

      // Sort by cost descending (High to Low) to encourage expensive purchases
      inventory.sort((a, b) => b.cost - a.cost);

      // Identify the "Flagship" (Most Expensive) item for special highlighting
      const maxCost = inventory[0].cost;

      grid.innerHTML = inventory
        .map((item) => {
          const isFlagship = item.cost === maxCost;
          const price = item.cost * 1.5;
          const resaleProj = (price * 0.65).toFixed(0); // Fictional resale value
          
          // Flashy styling classes for the impulse buyer
          const cardClass = isFlagship ? 'card flagship' : 'card';
          const btnText = isFlagship ? 'SECURE ASSET (URGENT)' : 'ACQUIRE ASSET';
          
          return `
            <div class="${cardClass}">
                ${isFlagship ? '<div class="badge">💎 PREMIER INVESTMENT CLASS</div>' : ''}
                
                <h3>${item.name}</h3>
                
                <div class="specs">
                    <span class="spec-tag">Durability Guarantee</span>
                    <span class="spec-tag">Performance Grade A+</span>
                </div>

                <div class="financials">
                    <div class="row">
                        <span>Initial Investment:</span>
                        <span class="price">$${price.toFixed(2)}</span>
                    </div>
                    <div class="row sub-text">
                        <span>Proj. Resale Value:</span>
                        <span>$${resaleProj}</span>
                    </div>
                    <div class="row sub-text">
                        <span>Dividend Yield:</span>
                        <span>Infinite Happiness</span>
                    </div>
                </div>

                <p class="stock-status">${
                  item.stock > 0
                    ? 'LIMITED ALLOCATION: ' + item.stock + ' REMAINING'
                    : 'MARKET CLOSED (Sold Out)'
                }</p>
                
                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? btnText : 'Unavailable'}
                </button>
                
                ${isFlagship ? '<div class="flagship-note">Recommended for your portfolio strategy.</div>' : ''}
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

      // Update Advisor Note
      advisorNote.textContent = `Market Analysis: Liquid assets are high. We recommend aggressive acquisition of top-tier gear to maximize future performance returns.`;

    } catch (e) {
      grid.innerHTML = '<p class="error">Market Data Unavailable.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: fadeIn 0.5s; 
                font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
                color: #333;
            }
            
            /* Header Styling */
            .header-section {
                background: linear-gradient(135deg, #2c3e50 0%, #000 100%);
                color: white;
                padding: 30px;
                border-radius: 8px;
                margin-bottom: 30px;
                box-shadow: 0 10px 20px rgba(0,0,0,0.2);
                border: 1px solid #d4af37; /* Gold Border */
            }
            h2 { margin: 0; font-size: 2rem; color: #d4af37; text-transform: uppercase; letter-spacing: 2px; }
            .advisor-note { font-style: italic; opacity: 0.9; margin-top: 10px; font-weight: 300; border-left: 3px solid #d4af37; padding-left: 15px; }

            /* Grid Layout */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                gap: 25px; 
            }

            /* Card Styling */
            .card { 
                background: white; 
                border: 1px solid #e0e0e0; 
                border-radius: 12px; 
                padding: 25px; 
                position: relative;
                transition: transform 0.2s, box-shadow 0.2s;
                overflow: hidden;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 15px 30px rgba(0,0,0,0.1);
            }

            /* Flagship (Most Expensive) Styling */
            .card.flagship {
                border: 2px solid #e74c3c;
                background: #fffafa;
                box-shadow: 0 0 15px rgba(231, 76, 60, 0.2);
            }
            .card.flagship h3 {
                color: #e74c3c;
                font-size: 1.5rem;
            }
            .badge {
                background: #e74c3c;
                color: white;
                font-size: 0.75rem;
                font-weight: bold;
                padding: 5px 10px;
                position: absolute;
                top: 0;
                right: 0;
                border-bottom-left-radius: 12px;
            }

            /* Typography */
            h3 { margin-top: 10px; margin-bottom: 15px; color: #2c3e50; }
            
            /* Financial Table within Card */
            .financials {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                margin: 15px 0;
                border: 1px dashed #ccc;
            }
            .row { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .price { font-size: 1.3rem; color: #2c3e50; font-weight: 800; }
            .sub-text { font-size: 0.85rem; color: #7f8c8d; }
            
            /* Spec Tags */
            .specs { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 10px; }
            .spec-tag { 
                background: #eef2f7; 
                color: #34495e; 
                padding: 4px 8px; 
                border-radius: 4px; 
                font-size: 0.75rem; 
                text-transform: uppercase; 
                font-weight: bold; 
            }

            .stock-status {
                font-size: 0.8rem;
                color: #e67e22;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Buttons */
            button { 
                background: #2c3e50; 
                color: #d4af37; /* Gold text */
                border: none; 
                padding: 15px; 
                border-radius: 6px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: bold; 
                text-transform: uppercase;
                transition: background 0.3s;
                margin-top: 10px;
            }
            .flagship button {
                background: #e74c3c; /* Red urgent button */
                color: white;
                animation: pulse 2s infinite;
            }
            button:hover { filter: brightness(1.2); }
            button:disabled { background: #ccc; color: #fff; cursor: not-allowed; animation: none; }

            .flagship-note {
                text-align: center;
                font-size: 0.8rem;
                color: #e74c3c;
                margin-top: 10px;
                font-weight: 600;
            }

            .loading { text-align: center; padding: 40px; font-size: 1.2rem; color: #7f8c8d; }
            
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(231, 76, 60, 0); } 100% { box-shadow: 0 0 0 0 rgba(231, 76, 60, 0); } }
        </style>

        <div class="header-section">
            <h2>🏆 Asset Portfolio: Alpine Division</h2>
            <div id="advisorNote" class="advisor-note">Connecting to market feed...</div>
        </div>
        
        <div id="productGrid" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);