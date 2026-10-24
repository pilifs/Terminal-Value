// --- FILE: components/dynamicHome/homePage-{clientId}.js ---

class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
    this.startCountdown();
  }

  startCountdown() {
    // Create artificial urgency: "Allocation expires in..."
    let minutes = 14;
    let seconds = 59;
    const timerEl = this.shadowRoot.getElementById('timer');

    this.timerInterval = setInterval(() => {
      seconds--;
      if (seconds < 0) {
        minutes--;
        seconds = 59;
      }
      if (minutes < 0) {
        minutes = 14; // Reset to loop urgency
      }
      const m = minutes < 10 ? '0' + minutes : minutes;
      const s = seconds < 10 ? '0' + seconds : seconds;
      if (timerEl) timerEl.innerText = `${m}:${s}`;
    }, 1000);
  }

  disconnectedCallback() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');

    try {
      const res = await fetch('/api/inventory');
      const rawInventory = await res.json();

      // --- STRATEGIC DATA MANIPULATION ---
      // We transform generic inventory into "Race Room" stock specifically for this user.
      // We interpret "High Value" as maximizing margin.

      const raceStock = rawInventory.map((item, index) => {
        // 1. Rename items to appeal to a former pro racer
        let newName = item.name;
        let description = 'Standard retail specs.';
        let isSki = item.name.toLowerCase().includes('ski');

        if (isSki) {
          const models = [
            'Lab Stock GS (193cm R30)',
            'FIS SL World Cup (165cm)',
            'Master GS Factory Stiffness',
          ];
          newName = models[index % models.length] + ' // PRO STOCK';
          description =
            '87° side edge, 0.5° base. Structure: Fine Cross (Aspen Cold Snow).';
        } else {
          newName = 'Carbon Injected ' + item.name + ' (150 Flex)';
          description = 'Plug boot construction. High DIN capability.';
        }

        // 2. ARTIFICIAL INFLATION
        // The generic OrderPage calculates Price = Cost * 1.5.
        // We want to sell these for $2,000+.
        // So we hack the 'cost' property on the object we pass to the router.
        // If we want Price = $2400, Cost must be $1600.
        const inflatedCost = 1600 + index * 150;

        return {
          ...item,
          originalId: item.id,
          name: newName,
          description: description,
          cost: inflatedCost, // HACK: Inflate cost so OrderPage calculates a massive price
          displayPrice: (inflatedCost * 1.5).toLocaleString(),
          stock: Math.max(1, Math.min(item.stock, 2)), // Create scarcity: never show more than 2
        };
      });

      // Render the "Vault"
      grid.innerHTML = raceStock
        .map(
          (item) => `
                <div class="tech-card">
                    <div class="badge">RACE ROOM ONLY</div>
                    <div class="card-header">
                        <h3>${item.name}</h3>
                        <div class="sku">FIS-HOMOLOGATED: ${item.sku}-PRO</div>
                    </div>
                    <div class="specs">
                        <div class="spec-row">
                            <span>Tuning:</span> <strong>Ceramic Disc Finish</strong>
                        </div>
                        <div class="spec-row">
                            <span>Flex:</span> <strong>World Cup Stiff</strong>
                        </div>
                        <div class="spec-row">
                            <span>Note:</span> <strong>${item.description}</strong>
                        </div>
                    </div>
                    <div class="pricing-zone">
                        <div class="price-label">PRO BUNDLE PRICE</div>
                        <div class="price">$${item.displayPrice}</div>
                        <div class="scarcity">⚠️ ONLY ${item.stock} PAIRS ALLOCATED TO ASPEN</div>
                    </div>
                    <button class="acquire-btn" data-id="${item.originalId}">
                        SECURE ALLOCATION
                    </button>
                </div>
            `
        )
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.acquire-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
          const item = raceStock[index];
          // Dispatch the hacked item object with the inflated cost
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
      grid.innerHTML =
        '<p class="error">SECURE CONNECTION TO VAULT FAILED.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                background-color: #0f1115; 
                color: #ecf0f1; 
                font-family: 'Segoe UI', system-ui, sans-serif;
                min-height: 100vh;
                margin: -2rem -1rem; /* Break out of container padding */
                padding: 2rem;
            }

            /* HERO SECTION */
            .hero {
                border-left: 5px solid #ff4500; /* Racing Orange */
                padding-left: 20px;
                margin-bottom: 40px;
                position: relative;
            }
            .hero h1 {
                font-size: 3.5rem;
                margin: 0;
                text-transform: uppercase;
                letter-spacing: -2px;
                line-height: 1;
            }
            .hero h2 {
                color: #ff4500;
                font-size: 1.2rem;
                letter-spacing: 4px;
                text-transform: uppercase;
                margin: 10px 0 0 0;
            }
            .location-stamp {
                font-family: monospace;
                color: #7f8c8d;
                margin-top: 10px;
            }

            /* URGENCY BAR */
            .urgency-bar {
                background: rgba(231, 76, 60, 0.1);
                border: 1px solid #e74c3c;
                color: #e74c3c;
                padding: 10px;
                text-align: center;
                font-weight: bold;
                margin-bottom: 30px;
                display: flex;
                justify-content: center;
                gap: 10px;
                text-transform: uppercase;
                font-size: 0.9rem;
            }
            .timer { color: white; font-family: monospace; font-size: 1.1rem; }

            /* GRID */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
                gap: 30px; 
            }

            /* TECH CARD (Replaces Standard Product Card) */
            .tech-card {
                background: #1a1d24;
                border: 1px solid #333;
                padding: 0;
                position: relative;
                transition: transform 0.2s, border-color 0.2s;
            }
            .tech-card:hover {
                transform: translateY(-5px);
                border-color: #ff4500;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }

            .badge {
                position: absolute;
                top: 0;
                right: 0;
                background: #ff4500;
                color: white;
                font-size: 0.7rem;
                font-weight: bold;
                padding: 5px 10px;
                text-transform: uppercase;
            }

            .card-header {
                padding: 20px;
                background: #232730;
                border-bottom: 1px solid #333;
            }
            .card-header h3 {
                margin: 0;
                color: white;
                font-size: 1.3rem;
                font-style: italic; /* Speed look */
            }
            .sku {
                font-family: monospace;
                color: #555;
                font-size: 0.8rem;
                margin-top: 5px;
            }

            .specs {
                padding: 20px;
                font-size: 0.9rem;
            }
            .spec-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                border-bottom: 1px dotted #333;
                padding-bottom: 4px;
            }
            .spec-row span { color: #888; }
            .spec-row strong { color: #ccc; }

            .pricing-zone {
                padding: 0 20px 20px 20px;
                text-align: right;
            }
            .price-label {
                font-size: 0.7rem;
                color: #888;
                text-transform: uppercase;
            }
            .price {
                font-size: 2rem;
                color: white;
                font-weight: bold;
                letter-spacing: -1px;
            }
            .scarcity {
                color: #e74c3c;
                font-size: 0.75rem;
                font-weight: bold;
                margin-top: 5px;
                animation: pulse 2s infinite;
            }

            .acquire-btn {
                width: 100%;
                background: #ff4500;
                color: white;
                border: none;
                padding: 15px;
                font-size: 1rem;
                font-weight: bold;
                text-transform: uppercase;
                cursor: pointer;
                transition: background 0.2s;
            }
            .acquire-btn:hover {
                background: #e03e00;
            }

            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }

            @media(max-width: 600px) {
                .hero h1 { font-size: 2rem; }
            }
        </style>

        <div class="hero">
            <h2>Fil's Alpine Racing Dept.</h2>
            <h1>Aspen Vault <br>Access Granted</h1>
            <div class="location-stamp">> LOCATION: ASPEN, CO // COND: HARDPACK // TUNE: 87°</div>
        </div>

        <div class="urgency-bar">
            <span>⚠️ Private Allocation for Former Pro Tier expires in:</span>
            <span class="timer" id="timer">15:00</span>
        </div>

        <div id="productGrid" class="grid">
            <div style="color: #555; padding: 20px;">Initializing secure connection to inventory...</div>
        </div>
        `;
  }
}

customElements.define('home-page', HomePage);
