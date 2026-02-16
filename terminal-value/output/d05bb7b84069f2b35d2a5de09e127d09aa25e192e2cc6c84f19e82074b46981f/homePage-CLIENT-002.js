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
    
    grid.innerHTML = '<div class="loading">Analyzing market availability...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // Personalize for the Client (SLC -> Vail, Wide Fit needs)
      advisorNote.innerHTML = `
        <div class="briefing-header">
            <strong>CLIENT PORTFOLIO BRIEF // VAIL EXPEDITION</strong>
        </div>
        <p>
            For the upcoming Vail acquisition, we are deprioritizing short-term savings in favor of 
            <strong>long-term value</strong> and biomechanical alignment. 
            <br><br>
            <em>Note:</em> Previous assets resulted in compression fatigue (tight boots). 
            Current selection methodology prioritizes <strong>Wide-Chassis</strong> architecture 
            to ensure maximum durability and happiness dividends over the 10-year asset lifecycle.
        </p>
      `;

      grid.innerHTML = inventory
        .map((item) => {
            // Financial Reframing Math
            const price = item.cost * 1.5;
            const years = 10;
            const annualCost = (price / years).toFixed(2);
            const resaleVal = (price * 0.45).toFixed(0); // Est 45% resale
            
            // Highlight higher cost items as "Better Investments"
            const isPremium = price > 800;
            const durabilityClass = isPremium ? 'grade-a' : 'grade-b';
            const durabilityText = isPremium ? 'Ti-Reinforced / Lifetime' : 'Standard Composite';

            return `
                <div class="asset-card ${isPremium ? 'premium-highlight' : ''}">
                    <div class="card-header">
                        <h3>${item.name}</h3>
                        ${isPremium ? '<span class="badge">AAA RATED</span>' : ''}
                    </div>
                    
                    <div class="financial-breakdown">
                        <div class="row">
                            <span class="label">Initial Capital:</span>
                            <span class="value price">$${price.toFixed(2)}</span>
                        </div>
                        <div class="row">
                            <span class="label">Amortized Cost:</span>
                            <span class="value">$${annualCost} / yr</span>
                        </div>
                        <div class="row">
                            <span class="label">Est. Resale Value:</span>
                            <span class="value green">+$${resaleVal}</span>
                        </div>
                    </div>

                    <div class="specs">
                        <div class="spec-row">
                            <span>Durability:</span>
                            <strong class="${durabilityClass}">${durabilityText}</strong>
                        </div>
                        <div class="spec-row">
                            <span>Fit Profile:</span>
                            <strong>${isPremium ? 'Wide / Comfort Max' : 'Standard'}</strong>
                        </div>
                    </div>

                    <div class="availability">
                        Market Availability: ${item.stock > 0 ? item.stock + ' Units' : 'Out of Stock'}
                    </div>

                    <button 
                        class="acquire-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'ACQUIRE ASSET' : 'WAITLIST'}
                    </button>
                    
                    <div class="guarantee">
                        Shielded by Durability Guarantee™
                    </div>
                </div>
            `;
        })
        .join('');

      // Event Listeners
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
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Georgia', serif; color: #2c3e50; }
            
            /* Dashboard Layout */
            h2 { font-family: 'Segoe UI', sans-serif; text-transform: uppercase; letter-spacing: 1px; font-size: 1.2rem; border-bottom: 2px solid #2c3e50; padding-bottom: 10px; }
            
            /* Advisor Note */
            #advisorNote { background: #f8f9fa; border-left: 4px solid #2c3e50; padding: 15px; margin-bottom: 30px; font-family: 'Segoe UI', sans-serif; font-size: 0.95rem; line-height: 1.5; color: #444; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
            .briefing-header { color: #c0392b; margin-bottom: 8px; font-size: 0.8rem; letter-spacing: 0.05em; }

            /* Grid */
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 25px; }
            
            /* Asset Card */
            .asset-card { background: white; border: 1px solid #e0e0e0; border-radius: 4px; padding: 20px; transition: transform 0.2s; position: relative; display: flex; flex-direction: column; }
            .asset-card:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(0,0,0,0.1); border-color: #bdc3c7; }
            
            .premium-highlight { border: 1px solid #f1c40f; box-shadow: 0 4px 15px rgba(241, 196, 15, 0.15); }
            
            .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
            .asset-card h3 { margin: 0; font-size: 1.1rem; color: #2c3e50; font-weight: bold; }
            .badge { background: #27ae60; color: white; font-size: 0.6rem; padding: 2px 6px; border-radius: 2px; font-family: sans-serif; font-weight: bold; }

            /* Financial Table */
            .financial-breakdown { background: #fdfdfd; border: 1px solid #eee; padding: 10px; margin-bottom: 15px; border-radius: 4px; }
            .row { display: flex; justify-content: space-between; font-size: 0.9rem; margin-bottom: 5px; }
            .row:last-child { margin-bottom: 0; }
            .label { color: #7f8c8d; font-size: 0.85rem; }
            .value { font-weight: bold; font-family: 'Consolas', monospace; }
            .price { color: #2c3e50; font-size: 1rem; }
            .green { color: #27ae60; }

            /* Specs */
            .specs { margin-bottom: 20px; font-size: 0.85rem; }
            .spec-row { display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dotted #eee; padding-bottom: 2px; }
            .grade-a { color: #27ae60; }
            .grade-b { color: #7f8c8d; }

            .availability { font-size: 0.75rem; color: #95a5a6; text-align: center; margin-bottom: 10px; text-transform: uppercase; }

            /* Action */
            .acquire-btn { background: #2c3e50; color: #fff; border: none; padding: 12px; width: 100%; font-family: 'Segoe UI', sans-serif; font-weight: 600; letter-spacing: 1px; cursor: pointer; border-radius: 2px; transition: background 0.2s; }
            .acquire-btn:hover { background: #34495e; }
            .acquire-btn:disabled { background: #bdc3c7; cursor: not-allowed; }
            
            .guarantee { font-size: 0.7rem; text-align: center; color: #7f8c8d; margin-top: 10px; font-style: italic; }

            .loading { text-align: center; color: #7f8c8d; padding: 40px; }

            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <h2>Asset Allocation Opportunities</h2>
        <div id="advisorNote">Loading Advisor Briefing...</div>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);