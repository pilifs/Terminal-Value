class HomePage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.clientCity = 'Vancouver';
        this.persona = 'Executive Digital Nomad';
    }

    connectedCallback() {
        this.render();
        this.loadInventory();
        this.startUrgencyTimers();
    }

    async loadInventory() {
        const grid = this.shadowRoot.getElementById('productGrid');
        const exclusiveGrid = this.shadowRoot.getElementById('exclusiveGrid');
        
        // Simulating a delay to look like we are fetching "Secure Data"
        grid.innerHTML = '<div class="loading">Authenticating VIP Tier...</div>';

        try {
            const res = await fetch('/api/inventory');
            const inventory = await res.json();

            // CLEAR LOADERS
            grid.innerHTML = '';
            exclusiveGrid.innerHTML = '';

            // STRATEGY: Sort by most expensive first to anchor high prices
            inventory.sort((a, b) => b.cost - a.cost);

            inventory.forEach((item, index) => {
                // INTELLIGENT PRODUCT TRANSFORMATION
                // We rename items to fit the "Digital Nomad / Heated Tech" persona
                // and inflate prices significantly.
                
                let isExclusive = false;
                let marketingName = item.name;
                let badge = '';
                
                // INFLATION LOGIC: 
                // Standard site is Cost * 1.5. We want Price to be Cost * 5.
                // NewCost = (OriginalCost * 5) / 1.5
                const originalCost = item.cost;
                const inflatedCost = (originalCost * 5) / 1.5; 
                
                // Mutate item for the checkout process to capture higher revenue
                item.cost = inflatedCost; 
                const displayPrice = (item.cost * 1.5).toFixed(2);

                // Analyze keywords for the "Heated/Nomad" persona
                const lowerName = item.name.toLowerCase();
                
                if (lowerName.includes('glove') || lowerName.includes('sock') || lowerName.includes('boot')) {
                    isExclusive = true;
                    marketingName = `🔥 ${item.name} [Pyro-Tech Series]`;
                    badge = 'USB-C HEATED';
                } else if (lowerName.includes('ski') || lowerName.includes('board')) {
                    marketingName = `${item.name} // Lodge Edition`;
                    badge = 'VANCOUVER RELEASE';
                }

                // Copywriting Logic
                const urgencySeed = Math.floor(Math.random() * 5) + 2; // Random low number
                
                const cardHTML = `
                    <div class="card ${isExclusive ? 'exclusive-card' : ''}">
                        ${badge ? `<div class="badge">${badge}</div>` : ''}
                        <div class="img-placeholder"></div>
                        <h3>${marketingName}</h3>
                        <p class="description">
                            ${isExclusive 
                                ? "Engineered for slope-to-zoom-call transitions. Maximum thermal efficiency." 
                                : "High-performance gear for the modern remote executive."}
                        </p>
                        <div class="price-row">
                            <span class="price">$${displayPrice}</span>
                            <span class="scarcity">Only ${urgencySeed} reserved in ${this.clientCity}</span>
                        </div>
                        <button class="buy-btn ${isExclusive ? 'btn-gold' : ''}" data-id="${item.id}">
                            ${isExclusive ? 'SECURE ALLOCATION' : 'ADD TO CART'}
                        </button>
                        <div class="viewer-count">
                            <span class="dot"></span> ${Math.floor(Math.random() * 12) + 3} digital nomads viewing this
                        </div>
                    </div>
                `;

                if (isExclusive) {
                    exclusiveGrid.innerHTML += cardHTML;
                } else {
                    grid.innerHTML += cardHTML;
                }

                // Add event listener to the specific button created above
                // Note: We must wait for DOM update or use event delegation. 
                // For simplicity in this loop, we attach later via delegation.
            });

            // Event Delegation for Performance and simplicity
            this.shadowRoot.addEventListener('click', (e) => {
                if (e.target.classList.contains('buy-btn')) {
                    const itemId = e.target.dataset.id;
                    const selectedItem = inventory.find(i => i.id === itemId);
                    
                    // PASS THE INFLATED COST ITEM TO ORDER PAGE
                    this.dispatchEvent(new CustomEvent('navigate-order', {
                        detail: { item: selectedItem },
                        bubbles: true,
                        composed: true
                    }));
                }
            });

        } catch (e) {
            console.error(e);
            grid.innerHTML = '<p>Connection lost. Re-establishing secure link...</p>';
        }
    }

    startUrgencyTimers() {
        // Ticks down a "Reservation Timer" to induce panic buying
        let time = 15 * 60; // 15 minutes
        const timerEl = this.shadowRoot.getElementById('timer');
        
        setInterval(() => {
            const minutes = Math.floor(time / 60);
            const seconds = time % 60;
            if(timerEl) {
                timerEl.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            }
            if (time > 0) time--;
        }, 1000);
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: 'Helvetica Neue', 'Segoe UI', sans-serif;
                background-color: #1a1a1a; 
                color: #f0f0f0;
                min-height: 100vh;
                margin: -2rem -1rem; /* Break out of container padding */
                padding: 2rem;
            }

            /* HERO SECTION */
            .hero {
                background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
                padding: 40px;
                border-radius: 12px;
                margin-bottom: 40px;
                position: relative;
                overflow: hidden;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                border: 1px solid #34495e;
            }
            .hero h1 {
                font-size: 2.5rem;
                margin: 0;
                background: -webkit-linear-gradient(#f1c40f, #bf953f);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-transform: uppercase;
                letter-spacing: 2px;
            }
            .hero p {
                font-size: 1.1rem;
                color: #bdc3c7;
                max-width: 600px;
                line-height: 1.6;
            }
            .status-bar {
                display: flex;
                gap: 20px;
                margin-top: 20px;
                font-family: 'Consolas', monospace;
                font-size: 0.9rem;
                color: #2ecc71;
            }

            /* SECTION TITLES */
            h2 {
                color: #ecf0f1;
                border-bottom: 1px solid #333;
                padding-bottom: 10px;
                margin-top: 40px;
                font-weight: 300;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            /* GRIDS */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
                gap: 25px; 
            }

            /* PRODUCT CARDS */
            .card { 
                background: #252525; 
                padding: 25px; 
                border-radius: 4px; 
                border: 1px solid #333;
                transition: transform 0.2s, box-shadow 0.2s;
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }
            .card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                border-color: #f1c40f;
            }
            .exclusive-card {
                background: linear-gradient(180deg, #252525 0%, #2c2c2c 100%);
                border: 1px solid #b8860b;
            }

            /* CARD CONTENT */
            .badge {
                position: absolute;
                top: -10px;
                right: -10px;
                background: #c0392b;
                color: white;
                padding: 5px 10px;
                font-size: 0.7rem;
                font-weight: bold;
                border-radius: 2px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            .card h3 { 
                margin: 10px 0; 
                color: #ecf0f1; 
                font-size: 1.2rem;
            }
            .description {
                font-size: 0.85rem;
                color: #95a5a6;
                margin-bottom: 15px;
                font-style: italic;
            }
            .price-row {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
                margin-bottom: 15px;
            }
            .price { 
                font-size: 1.5rem; 
                color: #f1c40f; 
                font-weight: bold; 
                font-family: 'Consolas', monospace;
            }
            .scarcity {
                font-size: 0.75rem;
                color: #e74c3c;
                font-weight: bold;
            }

            /* BUTTONS */
            button { 
                background: #34495e; 
                color: white; 
                border: none; 
                padding: 15px; 
                border-radius: 2px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 0.9rem; 
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: background 0.2s;
            }
            button:hover { background: #2c3e50; }
            
            .btn-gold {
                background: linear-gradient(45deg, #f1c40f, #d4ac0d);
                color: #1a1a1a;
            }
            .btn-gold:hover {
                background: linear-gradient(45deg, #d4ac0d, #b7950b);
            }

            /* SOCIAL PROOF DOT */
            .viewer-count {
                margin-top: 10px;
                font-size: 0.75rem;
                color: #7f8c8d;
                display: flex;
                align-items: center;
            }
            .dot {
                height: 8px;
                width: 8px;
                background-color: #2ecc71;
                border-radius: 50%;
                display: inline-block;
                margin-right: 6px;
                animation: blink 2s infinite;
            }
            .loading {
                color: #f1c40f;
                font-family: monospace;
                font-size: 1.2rem;
            }

            @keyframes blink {
                0% { opacity: 1; }
                50% { opacity: 0.4; }
                100% { opacity: 1; }
            }
        </style>

        <div class="hero">
            <h1>The Nomad Lodge // VIP Access</h1>
            <p>Welcome back. We've curated a selection of gear engineered for the Vancouver lifestyle—transition seamlessly from the lodge workspace to the black diamond runs.</p>
            
            <div class="status-bar">
                <span>📍 VANCOUVER, BC</span>
                <span>🌡️ -4°C (POWDER ALERT)</span>
                <span>⏱️ RESERVATION EXPIRES: <span id="timer">15:00</span></span>
            </div>
        </div>

        <h2>🔥 Thermodynamic Essentials (Slope & Desk)</h2>
        <div id="exclusiveGrid" class="grid"></div>

        <h2>⛷️ Priority Access: Alpine Gear</h2>
        <div id="productGrid" class="grid"></div>
        `;
    }
}

customElements.define('home-page', HomePage);