class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.calculatedPrice = 0;
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.render();
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
    }
  }

  // Helper to determine if item is "Racing" gear based on Context
  isRacingGear(item) {
    const keywords = ['race', 'carbon', 'speed', 'nano', 'pro'];
    return keywords.some(k => item.name.toLowerCase().includes(k));
  }

  // Helper to get client City safely from global state
  getClientCity() {
    // Accessing the global state defined in app.js
    return window.state?.clientProfile?.city || '';
  }

  loadItem(item) {
    this.selectedItem = item;
    const root = this.shadowRoot;
    
    // 1. Pricing Strategy: 120% for Racing, 150% (Standard) otherwise
    const isRace = this.isRacingGear(item);
    const markup = isRace ? 1.2 : 1.5;
    this.calculatedPrice = item.cost * markup;

    // UI Updates
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    
    // Price Display
    const priceDisplay = root.getElementById('orderItemPrice');
    priceDisplay.textContent = `$${this.calculatedPrice.toFixed(2)}`;
    
    if (isRace) {
      priceDisplay.innerHTML += ` <span class="badge">🔥 BLOWOUT SALE</span>`;
    }

    // 2. Banff Banner Logic
    const city = this.getClientCity();
    const banner = root.getElementById('banffBanner');
    if (city.toLowerCase() === 'banff') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    // 3. Upsell Logic (Based on buying Skis & Past Purchases context)
    const upsellContainer = root.getElementById('upsellContainer');
    if (item.name.toLowerCase().includes('ski')) {
      upsellContainer.classList.remove('hidden');
      // Contextual Upsell based on "Nordic/Backcountry" history
      root.getElementById('upsellText').innerHTML = 
        `<strong>Complete your setup:</strong> Add <em>Featherweight Nordic Carbon Poles</em>? <br><small>Matches your 'Backcountry Tour' history.</small>`;
    } else {
      upsellContainer.classList.add('hidden');
    }

    // Reset Totals
    root.getElementById('orderTotal').textContent = this.calculatedPrice.toFixed(2);
    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';

    qtySelect.onchange = () => {
      root.getElementById('orderTotal').textContent = (
        this.calculatedPrice * qtySelect.value
      ).toFixed(2);
    };
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    
    // Use the specific calculated price (Sales Blowout logic)
    const price = this.calculatedPrice;
    
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.innerHTML = 'Processing Payment...';

    // Simulate "One-Click" speed
    const payload = {
      clientId: this.clientId,
      items: [{ skuId: this.selectedItem.id, quantity: qty, price: price }],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Visual feedback for iPad user
        btn.style.background = '#27ae60';
        btn.textContent = 'Success! Redirecting...';
        setTimeout(() => {
             this.dispatchEvent(
            new CustomEvent('order-completed', { bubbles: true, composed: true })
          );
        }, 800);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        btn.textContent = 'One-Click Buy';
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      btn.textContent = 'One-Click Buy';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.4s ease-out; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            }
            .card { 
                background: white; 
                padding: 30px; 
                border-radius: 12px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.15); 
                max-width: 600px; 
                margin: 0 auto; 
            }
            h2 { color: #2c3e50; font-weight: 300; margin-bottom: 20px; }
            h3 { margin: 0; color: #34495e; font-size: 1.5rem; }
            
            /* Pricing & Badges */
            .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; margin-top: 10px; display: block;}
            .badge { 
                background: #e74c3c; color: white; 
                font-size: 0.7rem; padding: 3px 8px; 
                border-radius: 4px; vertical-align: middle; 
                text-transform: uppercase; letter-spacing: 0.5px;
            }

            /* Geo-Target Banner */
            .banff-banner {
                background: linear-gradient(90deg, #3498db, #2980b9);
                color: white;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .banff-banner::before { content: '🏔️'; font-size: 1.5rem; }

            /* Upsell Section */
            .upsell {
                background: #f9f9f9;
                border: 1px dashed #bdc3c7;
                padding: 15px;
                border-radius: 8px;
                margin: 15px 0;
                color: #555;
                font-size: 0.95rem;
            }
            .upsell input { margin-right: 10px; transform: scale(1.3); }

            /* iPad Optimized Inputs */
            select { 
                width: 100%; padding: 12px; margin: 15px 0; 
                font-size: 1.1rem; border: 1px solid #ccc; border-radius: 8px; 
                background-color: #fcfcfc;
            }

            /* One-Click Button (iPad Touch Target) */
            .one-click-btn { 
                background: linear-gradient(to bottom, #2ecc71, #27ae60); 
                color: white; border: none; 
                padding: 20px; 
                border-radius: 12px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1.3rem; 
                font-weight: bold;
                box-shadow: 0 4px 10px rgba(46, 204, 113, 0.4);
                transition: transform 0.1s, box-shadow 0.1s;
                touch-action: manipulation;
                margin-top: 10px;
            }
            .one-click-btn:active { transform: scale(0.98); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
            .one-click-btn:disabled { background: #95a5a6; cursor: not-allowed; box-shadow: none; }
            
            .cancel-btn { 
                background: transparent; color: #7f8c8d; 
                border: none; padding: 15px; width: 100%; 
                font-size: 1rem; margin-top: 10px; text-decoration: underline;
                cursor: pointer;
            }

            .hidden { display: none !important; }

            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="card">
            <!-- Dynamic Banner for Banff -->
            <div id="banffBanner" class="banff-banner hidden">
                Free Express Shipping to Banff included for our VIP members.
            </div>

            <h3 id="orderItemName">Loading...</h3>
            <p style="color:#7f8c8d; margin-top:5px;">SKU: <span id="orderItemSku"></span></p>
            <div id="orderItemPrice" class="price"></div>
            
            <hr style="border:0; border-top:1px solid #eee; margin: 20px 0;">

            <!-- Upsell Module -->
            <div id="upsellContainer" class="upsell hidden">
                <label style="display:flex; align-items:center; cursor:pointer;">
                    <input type="checkbox" id="upsellCheck">
                    <span id="upsellText"></span>
                </label>
            </div>

            <label style="font-weight:bold; color:#555;">Quantity</label>
            <select id="orderQty">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
            </select>

            <!-- Touch-optimized Action -->
            <button id="btnConfirm" class="one-click-btn">
                One-Click Buy ($<span id="orderTotal"></span>)
            </button>
            
            <button class="cancel-btn" id="btnCancel">Not now</button>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnConfirm').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };

    // Simple visual logic for the checkbox (mock functionality for presentation)
    const upsellCheck = this.shadowRoot.getElementById('upsellCheck');
    upsellCheck.onchange = (e) => {
        const totalSpan = this.shadowRoot.getElementById('orderTotal');
        const currentTotal = parseFloat(totalSpan.textContent);
        const upsellPrice = 89.99; // Mock price for poles/bindings
        
        if(e.target.checked) {
            totalSpan.textContent = (currentTotal + upsellPrice).toFixed(2);
        } else {
            // Re-calculate based on Qty to be safe
            const qty = this.shadowRoot.getElementById('orderQty').value;
            totalSpan.textContent = (this.calculatedPrice * qty).toFixed(2);
        }
    }
  }
}

customElements.define('order-page', OrderPage);