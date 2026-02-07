class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.upsellItem = null;
    this.calculatedPrice = 0;
  }

  connectedCallback() {
    this.render();
    this.clientId = this.getAttribute('client-id');
    this.checkLocation();
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.checkLocation();
    }
  }

  // Check global state (from app.js) for location to show banner
  checkLocation() {
    // Accessing the global state object defined in app.js
    const profile = window.state?.clientProfile;
    const banner = this.shadowRoot.getElementById('calgaryBanner');
    
    if (banner && profile && profile.city === 'Calgary') {
      banner.style.display = 'block';
    }
  }

  loadItem(item) {
    this.selectedItem = item;
    
    // --- PRICING STRATEGY ---
    // Racing gear (Sales Blowout) at 120% COGS, others at standard 150%
    const isRaceGear = item.name.toLowerCase().includes('race') || 
                       item.name.toLowerCase().includes('pro'); // Assuming Pro is race-adjacent based on context
    
    const markup = isRaceGear ? 1.2 : 1.5;
    this.calculatedPrice = item.cost * markup;

    // --- DOM UPDATES ---
    const root = this.shadowRoot;
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${this.calculatedPrice.toFixed(2)}`;
    
    // Highlight discount if it's race gear
    if(isRaceGear) {
        root.getElementById('priceTag').innerHTML += ` <span class="badge">Sales Blowout!</span>`;
    }

    this.updateTotal();

    // --- UPSELL LOGIC ---
    this.generateUpsell(item);
  }

  updateTotal() {
    const qty = parseInt(this.shadowRoot.getElementById('orderQty').value);
    let total = this.calculatedPrice * qty;

    // Add upsell price if checked
    const upsellCheckbox = this.shadowRoot.getElementById('upsellCheck');
    if (upsellCheckbox && upsellCheckbox.checked && this.upsellItem) {
        total += this.upsellItem.price;
    }

    this.shadowRoot.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  generateUpsell(mainItem) {
    const upsellContainer = this.shadowRoot.getElementById('upsellContainer');
    const name = mainItem.name.toLowerCase();

    // Logic based on Past Purchases and current item context
    let suggestedProduct = null;

    if (name.includes('race') || name.includes('pro') || name.includes('piste')) {
        suggestedProduct = {
            id: 'UPSELL-BIND-RACE', 
            name: 'Titanium Race Bindings', 
            price: 150.00,
            desc: 'Perfect match for your racing setup.'
        };
    } else if (name.includes('powder') || name.includes('backcountry')) {
        suggestedProduct = {
            id: 'UPSELL-POLE-Tele', 
            name: 'Carbon Telescopic Poles', 
            price: 85.00,
            desc: 'Essential for your backcountry tours.'
        };
    } else {
        // Generic Fallback
        suggestedProduct = {
            id: 'UPSELL-WAX', 
            name: 'Pro Glide Wax Kit', 
            price: 25.00,
            desc: 'Keep your new gear running fast.'
        };
    }

    this.upsellItem = suggestedProduct;

    // Render Upsell UI
    upsellContainer.innerHTML = `
        <div class="upsell-box">
            <h4>Recommended for You:</h4>
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <strong>${suggestedProduct.name}</strong><br>
                    <small>${suggestedProduct.desc}</small>
                </div>
                <div style="color: #e74c3c; font-weight:bold;">$${suggestedProduct.price.toFixed(2)}</div>
            </div>
            <label class="upsell-label">
                <input type="checkbox" id="upsellCheck"> 
                Add to order
            </label>
        </div>
    `;

    // Re-attach event listener for the dynamic checkbox
    this.shadowRoot.getElementById('upsellCheck').addEventListener('change', () => {
        this.updateTotal();
    });
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const btn = root.getElementById('btnOneClick');

    btn.disabled = true;
    btn.innerHTML = 'Processing... <span class="spinner"></span>';

    // Prepare Items Array
    const items = [{ 
        skuId: this.selectedItem.id, 
        quantity: qty, 
        price: this.calculatedPrice 
    }];

    // Add Upsell if selected
    const upsellCheckbox = root.getElementById('upsellCheck');
    if (upsellCheckbox && upsellCheckbox.checked && this.upsellItem) {
        items.push({
            skuId: this.upsellItem.id,
            quantity: 1,
            price: this.upsellItem.price
        });
    }

    const payload = {
      clientId: this.clientId,
      items: items,
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Haptic feedback simulation for mobile feel
        if (navigator.vibrate) navigator.vibrate(200);
        
        alert('🎉 Order Confirmed! Reference: ' + data.orderId);
        this.dispatchEvent(
          new CustomEvent('order-completed', { bubbles: true, composed: true })
        );
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Network Error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'One-Click Buy ';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.4s ease-out; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            
            /* iPhone 13 Specific Styling Container */
            .card { 
                background: white; 
                padding: 24px; 
                border-radius: 20px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.1); 
                max-width: 100%; 
                margin: 10px auto;
            }

            h2 { font-size: 1.5rem; margin-bottom: 15px; color: #1c1c1e; }
            h3 { margin: 0; color: #000; font-size: 1.4rem; }
            
            .sku { color: #8e8e93; font-size: 0.9rem; margin-bottom: 5px; display: block; }
            .price { font-size: 1.8rem; color: #000; font-weight: 700; margin: 10px 0; }
            .badge { background: #ff3b30; color: white; font-size: 0.7rem; padding: 3px 8px; border-radius: 10px; vertical-align: middle; }

            /* Calgary Banner */
            #calgaryBanner {
                background: linear-gradient(90deg, #004C97 0%, #E31837 100%);
                color: white;
                padding: 12px;
                border-radius: 12px;
                margin-bottom: 20px;
                font-size: 0.9rem;
                font-weight: 600;
                text-align: center;
                display: none; /* Hidden by default */
                box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            }

            /* Upsell Section */
            .upsell-box {
                background: #f2f2f7;
                border-radius: 12px;
                padding: 15px;
                margin: 20px 0;
            }
            .upsell-box h4 { margin: 0 0 10px 0; font-size: 0.95rem; color: #3a3a3c; }
            .upsell-label {
                display: flex;
                align-items: center;
                margin-top: 10px;
                font-size: 0.9rem;
                cursor: pointer;
            }
            input[type="checkbox"] {
                width: 20px;
                height: 20px;
                margin-right: 10px;
                accent-color: #007aff;
            }

            /* Inputs */
            select { 
                width: 100%; 
                padding: 12px; 
                margin: 10px 0 20px 0; 
                border: 1px solid #d1d1d6; 
                border-radius: 10px; 
                font-size: 1rem; 
                background-color: #fff;
                -webkit-appearance: none;
            }

            /* Buttons - Apple Style Touch Targets */
            .action-area {
                position: sticky;
                bottom: 0;
                background: white;
                padding-top: 10px;
            }

            button#btnOneClick { 
                background: #000000; 
                color: white; 
                border: none; 
                padding: 16px; 
                border-radius: 14px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1.1rem; 
                font-weight: 600;
                min-height: 50px; /* iPhone Touch Target */
                margin-bottom: 12px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transition: transform 0.1s;
            }
            button#btnOneClick:active { transform: scale(0.98); }
            button#btnOneClick:disabled { background: #8e8e93; }

            .cancel-link {
                display: block;
                text-align: center;
                color: #007aff;
                text-decoration: none;
                font-size: 1rem;
                padding: 10px;
                cursor: pointer;
            }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            
            hr { border: 0; border-top: 1px solid #e5e5ea; margin: 20px 0; }
        </style>

        <div id="calgaryBanner">
            🇨🇦 VIP Alert: Free Express Shipping to Calgary included!
        </div>

        <h2>Checkout</h2>
        <div class="card">
            <span id="orderItemSku" class="sku"></span>
            <h3 id="orderItemName">Loading...</h3>
            <p id="priceTag" class="price"><span id="orderItemPrice"></span></p>
            
            <div id="upsellContainer"></div>

            <hr>
            <label style="font-weight:600; font-size:0.9rem;">Quantity for Team/Family:</label>
            <select id="orderQty">
                <option value="1">1 Pair</option>
                <option value="2">2 Pairs (Team Deal)</option>
                <option value="3">3 Pairs (Bulk)</option>
                <option value="4">4 Pairs (Bulk)</option>
            </select>

            <div class="action-area">
                <button id="btnOneClick">One-Click Buy  ($<span id="orderTotal"></span>)</button>
                <a class="cancel-link" id="btnCancel">Cancel Order</a>
            </div>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('orderQty').onchange = () => this.updateTotal();
    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);