class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientCity = null;
    this.upsellItem = null;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  connectedCallback() {
    this.render();
    this.clientId = this.getAttribute('client-id');
    this.fetchClientDetails();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.fetchClientDetails();
    }
  }

  async fetchClientDetails() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        const profile = await res.json();
        this.clientCity = profile.city;
        this.updateCityBanner();
      }
    } catch (e) {
      console.warn('Could not fetch client details for custom UX');
    }
  }

  updateCityBanner() {
    const banner = this.shadowRoot.getElementById('slcBanner');
    if (this.clientCity === 'Salt Lake City' && banner) {
      banner.style.display = 'block';
    }
  }

  // Logic to determine pricing strategy based on Item Category
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    // Pricing Strategy: Racing gear @ 120% COGS, others @ 150% (Standard)
    const isRacing = name.includes('race') || name.includes('world cup') || name.includes('speed');
    const multiplier = isRacing ? 1.2 : 1.5;
    return (item.cost * multiplier).toFixed(2);
  }

  // Logic to determine upsell based on item and past purchase context
  getUpsellSuggestion(item) {
    const name = item.name.toLowerCase();
    
    // Default Upsell
    let upsell = {
        name: "Premium Ski Wax Kit",
        price: 24.99,
        id: "UPSELL-WAX"
    };

    // Contextual Upsell Logic
    if (name.includes('race') || name.includes('world cup')) {
        upsell = {
            name: "Carbon Fiber Race Poles",
            price: 119.99, // High durability value
            id: "UPSELL-POLE-RACE"
        };
    } else if (name.includes('powder') || name.includes('big mountain')) {
        upsell = {
            name: "Wide-Brake Backcountry Bindings",
            price: 249.50,
            id: "UPSELL-BINDING-WIDE"
        };
    } else if (name.includes('park') || name.includes('freestyle')) {
        upsell = {
            name: "Impact Resistant Helmet",
            price: 89.00,
            id: "UPSELL-HELMET"
        };
    }

    return upsell;
  }

  loadItem(item) {
    this.selectedItem = item;
    const finalPrice = this.calculatePrice(item);
    this.upsellItem = this.getUpsellSuggestion(item);

    const root = this.shadowRoot;
    
    // Product Details
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${finalPrice}`;
    
    // Upsell Details
    root.getElementById('upsellName').textContent = this.upsellItem.name;
    root.getElementById('upsellPrice').textContent = this.upsellItem.price.toFixed(2);
    
    // Pricing Logic
    this.updateTotal(finalPrice);

    // Quantity Listener
    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';
    qtySelect.onchange = () => this.updateTotal(finalPrice);

    // Upsell Listener
    const upsellCheck = root.getElementById('upsellCheck');
    upsellCheck.checked = false; // Reset
    upsellCheck.onchange = () => this.updateTotal(finalPrice);
  }

  updateTotal(basePrice) {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const hasUpsell = root.getElementById('upsellCheck').checked;
    
    let total = (basePrice * qty);
    if (hasUpsell) {
        total += this.upsellItem.price;
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const itemPrice = parseFloat(this.calculatePrice(this.selectedItem));
    const hasUpsell = root.getElementById('upsellCheck').checked;
    const btn = root.getElementById('btnOneClick');

    // UI Feedback
    btn.disabled = true;
    btn.innerHTML = '<span>Processing VIP Order...</span>';

    // Construct Payload
    const items = [
        { skuId: this.selectedItem.id, quantity: qty, price: itemPrice }
    ];

    if (hasUpsell) {
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
        // Success Logic
        btn.style.background = "#27ae60";
        btn.textContent = "Success!";
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
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            
            /* Layout & Card */
            .card { 
                background: white; 
                border-radius: 12px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.08); 
                max-width: 600px; 
                margin: 0 auto; 
                overflow: hidden;
            }
            
            /* Banner Styles */
            .vip-banner {
                background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
                color: white;
                padding: 15px;
                text-align: center;
                font-weight: 600;
                font-size: 0.95rem;
                display: none; /* Hidden by default */
                border-bottom: 2px solid #ffd700;
            }
            .vip-banner span {
                color: #ffd700;
            }

            .content {
                padding: 30px;
            }

            /* Product Header */
            h2 { margin-top: 0; font-weight: 300; color: #7f8c8d; font-size: 1.1rem; text-transform: uppercase; letter-spacing: 1px;}
            h3 { margin: 10px 0; color: #2c3e50; font-size: 1.8rem; }
            
            .sku { color: #95a5a6; font-size: 0.9rem; margin-bottom: 20px; display: block;}
            .main-price { font-size: 2rem; color: #2c3e50; font-weight: bold; display: block; margin-bottom: 20px;}

            /* Upsell Section */
            .upsell-box {
                background: #f8f9fa;
                border: 2px dashed #bdc3c7;
                border-radius: 8px;
                padding: 15px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .upsell-info { flex-grow: 1; }
            .upsell-title { font-weight: bold; color: #34495e; display: block; margin-bottom: 4px; }
            .upsell-price { color: #e67e22; font-weight: bold; }
            .upsell-checkbox { transform: scale(1.5); cursor: pointer; }

            /* Controls */
            .controls {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 25px;
            }
            select { 
                padding: 12px; 
                border: 1px solid #bdc3c7; 
                border-radius: 8px; 
                font-size: 1rem; 
                background: white;
            }

            /* iPad Specific Touch Button */
            .one-click-btn { 
                background: #2980b9; 
                color: white; 
                border: none; 
                padding: 20px; 
                border-radius: 12px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1.3rem; 
                font-weight: 600;
                box-shadow: 0 4px 6px rgba(41, 128, 185, 0.3);
                transition: transform 0.1s, box-shadow 0.1s;
                
                /* Touch Target Optimization */
                min-height: 60px; 
                touch-action: manipulation;
            }
            .one-click-btn:active {
                transform: scale(0.98);
                box-shadow: 0 2px 3px rgba(41, 128, 185, 0.3);
            }
            .one-click-btn:disabled {
                background: #bdc3c7;
                box-shadow: none;
                cursor: not-allowed;
            }

            .cancel-link {
                display: block;
                text-align: center;
                margin-top: 15px;
                color: #7f8c8d;
                text-decoration: underline;
                cursor: pointer;
                font-size: 0.9rem;
                padding: 10px; /* Touch padding */
            }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>

        <div class="card">
            <div id="slcBanner" class="vip-banner">
                🚀 Free Express Shipping to <span>Salt Lake City</span> included for VIPs.
            </div>

            <div class="content">
                <h2>Complete Your Setup</h2>
                <h3 id="orderItemName">Loading...</h3>
                <span class="sku">SKU: <span id="orderItemSku"></span></span>
                <span id="orderItemPrice" class="main-price"></span>

                <div class="upsell-box">
                    <input type="checkbox" id="upsellCheck" class="upsell-checkbox">
                    <div class="upsell-info">
                        <span class="upsell-title">Recommended: <span id="upsellName">Accessory</span></span>
                        <span style="font-size: 0.9rem; color: #555;">Perfect match for your style.</span>
                    </div>
                    <span class="upsell-price">+$<span id="upsellPrice">0.00</span></span>
                </div>

                <div class="controls">
                    <label style="font-weight:600; color:#555;">Quantity:</label>
                    <select id="orderQty">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                    </select>
                </div>

                <button id="btnOneClick" class="one-click-btn">
                    One-Click Buy ($<span id="orderTotal"></span>)
                </button>
                
                <a class="cancel-link" id="btnCancel">Cancel Order</a>
            </div>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);