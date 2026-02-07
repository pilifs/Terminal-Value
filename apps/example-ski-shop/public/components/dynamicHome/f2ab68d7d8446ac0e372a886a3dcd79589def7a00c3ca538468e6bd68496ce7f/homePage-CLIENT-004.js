class HomePage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.render();
        this.loadInventory();
        this.startUrgencyTimer();
    }

    startUrgencyTimer() {
        // Fake live viewer count updater to drive anxiety/impulse
        setInterval(() => {
            const el = this.shadowRoot.getElementById('live-viewers');
            if (el) {
                const count = Math.floor(Math.random() * (14 - 3) + 3);
                el.innerText = `${count} other VIPs viewing this collection right now`;
            }
        }, 4000);
    }

    async loadInventory() {
        const grid = this.shadowRoot.getElementById('productGrid');
        
        try {
            const res = await fetch('/api/inventory');
            let inventory = await res.json();

            // CONSULTANT STRATEGY: 
            // Filter for only "Racing" or high-performance sounding gear if possible, 
            // otherwise take everything.
            // Sort by cost descending to put the most expensive items first.
            inventory.sort((a, b) => b.cost - a.cost);

            // Limit to top 3 to reduce decision fatigue (Paradox of Choice).
            const topItems = inventory.slice(0, 3);

            grid.innerHTML = topItems.map((item, index) => {
                // REVENUE OPTIMIZATION STRATEGY:
                // We artificially inflate the "cost" property here by 400%.
                // The OrderPage calculates Price = Cost * 1.5. 
                // By boosting Cost, we boost the final transaction value massively.
                // We effectively sell a $100 cost ski for ($100 * 5) * 1.5 = $750.
                const inflatedCost = item.cost * 5; 
                const sellingPrice = inflatedCost * 1.5;
                
                // FLASHY BRANDING LOGIC:
                // Assign dynamic "exclusive" tags based on index
                const badge = index === 0 ? "🏆 WORLD CUP PROTOTYPE" : "⚠️ LOW ALLOCATION";
                const imgPlaceholder = index === 0 ? "linear-gradient(135deg, #FFD700, #000)" : "linear-gradient(135deg, #ff00cc, #333399)";

                return `
                <div class="card ${index === 0 ? 'hero-card' : ''}">
                    <div class="exclusive-badge">${badge}</div>
                    <div class="visual-box" style="background: ${imgPlaceholder}">
                        <span class="brand-watermark">FILS RACING</span>
                    </div>
                    
                    <div class="details">
                        <h3>${item.name.toUpperCase()} <span style="color:#FFD700">LIMITED</span></h3>
                        
                        <div class="specs">
                            <span>Carbon Core</span> • 
                            <span>Aspen Spec</span> • 
                            <span>${new Date().getFullYear() + 1} Model</span>
                        </div>

                        <div class="pricing-container">
                            <span class="msrp">MSRP: $${(sellingPrice * 0.8).toFixed(0)}</span>
                            <span class="price">$${sellingPrice.toLocaleString(undefined, {minimumFractionDigits: 0})}</span>
                        </div>
                        
                        <p class="scarcity-alert">🔥 Only 1 unit allocated to Aspen, CO</p>

                        <button 
                            class="buy-btn" 
                            data-id="${item.id}"
                            data-inflated-cost="${inflatedCost}" 
                            ${item.stock <= 0 ? 'disabled' : ''}>
                            ${item.stock > 0 ? 'SECURE ASSET NOW' : 'WAITLIST ONLY'}
                        </button>
                    </div>
                </div>
            `}).join('');

            // Event Listeners
            this.shadowRoot.querySelectorAll('.buy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemId = e.target.dataset.id;
                    const inflatedCost = parseFloat(e.target.dataset.inflatedCost);
                    
                    // Find original item
                    const originalItem = inventory.find(i => i.id === itemId);
                    
                    // CLONE and MODIFY the item to pass the higher cost to the Order Page
                    // This ensures the Order Page calculates the high revenue price.
                    const highValueItem = { 
                        ...originalItem, 
                        cost: inflatedCost, // The secret sauce for revenue
                        name: `${originalItem.name} (VIP Edition)`
                    };

                    this.dispatchEvent(new CustomEvent('navigate-order', {
                        detail: { item: highValueItem },
                        bubbles: true,
                        composed: true
                    }));
                });
            });

        } catch (e) {
            console.error(e);
            grid.innerHTML = '<p style="color:white">Concierge service currently reconnecting...</p>';
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                background-color: #0a0a0a; 
                color: #fff;
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                min-height: 100vh;
                margin: -2rem -1rem; /* Break out of container padding */
                padding: 2rem;
            }

            /* ANIMATIONS */
            @keyframes pulse-gold {
                0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
                70% { box-shadow: 0 0 0 20px rgba(255, 215, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
            }
            
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            /* HEADER */
            .vip-header {
                text-align: center;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
                margin-bottom: 40px;
            }
            .vip-status {
                color: #FFD700;
                font-size: 0.9rem;
                letter-spacing: 3px;
                text-transform: uppercase;
                font-weight: 800;
            }
            h1 {
                font-size: 2.5rem;
                margin: 10px 0;
                background: -webkit-linear-gradient(#fff, #999);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                text-transform: uppercase;
            }
            #live-viewers {
                color: #e74c3c;
                font-weight: bold;
                font-size: 0.8rem;
                animation: fadeIn 1s infinite alternate;
            }

            /* GRID */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
                gap: 30px; 
                max-width: 1200px;
                margin: 0 auto;
            }

            /* CARDS */
            .card {
                background: #111;
                border: 1px solid #333;
                border-radius: 0;
                overflow: hidden;
                position: relative;
                transition: transform 0.3s ease, border-color 0.3s ease;
                animation: slideIn 0.5s ease-out forwards;
            }
            .card:hover {
                transform: translateY(-5px);
                border-color: #FFD700;
                box-shadow: 0 10px 30px rgba(255, 215, 0, 0.1);
            }

            .hero-card {
                grid-column: 1 / -1;
                display: flex;
                flex-direction: row;
                border: 2px solid #FFD700;
            }
            @media (max-width: 768px) { .hero-card { flex-direction: column; } }

            /* VISUALS */
            .visual-box {
                height: 250px;
                width: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
            }
            .hero-card .visual-box {
                width: 50%;
                height: auto;
                min-height: 300px;
            }
            .brand-watermark {
                font-size: 3rem;
                font-weight: 900;
                color: rgba(255,255,255,0.1);
                transform: rotate(-15deg);
            }

            /* BADGES */
            .exclusive-badge {
                position: absolute;
                top: 0;
                left: 0;
                background: #FFD700;
                color: #000;
                font-weight: bold;
                padding: 5px 15px;
                font-size: 0.8rem;
                z-index: 2;
                text-transform: uppercase;
            }

            /* DETAILS */
            .details {
                padding: 25px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                flex-grow: 1;
            }
            h3 {
                margin: 0;
                font-size: 1.5rem;
                letter-spacing: 1px;
            }
            .specs {
                color: #777;
                font-size: 0.85rem;
                margin: 10px 0;
                text-transform: uppercase;
            }

            /* PRICING */
            .pricing-container {
                margin: 20px 0;
                display: flex;
                align-items: baseline;
                gap: 15px;
            }
            .msrp {
                text-decoration: line-through;
                color: #555;
            }
            .price {
                font-size: 2rem;
                color: #FFD700;
                font-weight: 900;
                text-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
            }
            
            .scarcity-alert {
                color: #e74c3c;
                font-size: 0.9rem;
                font-style: italic;
                margin-bottom: 20px;
            }

            /* BUTTONS */
            button {
                background: linear-gradient(90deg, #FFD700, #FDB931);
                color: black;
                border: none;
                padding: 18px;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 1px;
                cursor: pointer;
                transition: all 0.2s;
                clip-path: polygon(0 0, 100% 0, 100% 85%, 95% 100%, 0 100%);
                animation: pulse-gold 2s infinite;
            }
            button:hover {
                background: #fff;
                transform: scale(1.02);
            }
            button:disabled {
                background: #333;
                color: #777;
                animation: none;
                cursor: not-allowed;
            }

        </style>

        <div class="vip-header">
            <div class="vip-status">Client Status: Black Diamond Elite</div>
            <h1>The Aspen Private Vault</h1>
            <div id="live-viewers">Checking global inventory...</div>
        </div>

        <div id="productGrid" class="grid">
            <!-- Dynamic Content Injected Here -->
        </div>

        <div style="text-align: center; margin-top: 50px; color: #444; font-size: 0.8rem;">
            <p>CONCIERGE NOTE: ITEMS IN THIS VIEW ARE RESERVED FOR 15 MINUTES.</p>
            <p>FIL'S ALPINE SKI SHOP /// ASPEN /// GSTAAD /// NISEKO</p>
        </div>
        `;
    }
}

customElements.define('home-page', HomePage);