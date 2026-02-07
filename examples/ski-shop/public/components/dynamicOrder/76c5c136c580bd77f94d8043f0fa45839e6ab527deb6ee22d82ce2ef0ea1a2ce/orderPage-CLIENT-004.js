class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientCity = null;
    this.upsellActive = false;
    
    // Hardcoded mock item for the upsell requirement
    this.upsellItem = {
      id: 'UPSELL-POLES-001',
      name: 'Neon Carbon Race Poles',
      price: 150.00
    };
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.fetchClientDetails();
    this.render();
  }

  static get observedAttributes() {
    return ['client-id'];
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
        // Re-render to show/hide Aspen banner based on new data
        if (this.selectedItem) this.updateView(); 
      }
    } catch (e) {
      console.error("Could not fetch client details for customization", e);
    }
  }

  // Logic to determine if item is "Racing" gear based on naming conventions
  isRacingGear(item) {
    const name = item.name.toLowerCase();
    return name.includes('race') || name.includes('cup') || name.includes('pro');
  }

  // Public method called by Router
  loadItem(item) {
    this.selectedItem = item;
    this.upsellActive = false; // Reset upsell state
    this.updateView();
  }

  updateView() {
    if (!this.selectedItem) return;

    const root = this.shadowRoot;
    const isRacing = this.isRacingGear(this.selectedItem);
    
    // Pricing Strategy: 1.2x for Racing (Blowout), 1.5x for standard
    const markup = isRacing ? 1.2 : 1.5;
    const price = (this.selectedItem.cost * markup).toFixed(2);
    
    // DOM Updates
    const nameEl = root.getElementById('orderItemName');
    const skuEl = root.getElementById('orderItemSku');
    const priceEl = root.getElementById('orderItemPrice');
    const totalEl = root.getElementById('orderTotal');
    const oldPriceEl = root.getElementById('oldPrice');
    const saleBadge = root.getElementById('saleBadge');
    const aspenBanner = root.getElementById('aspenBanner');
    const upsellSection = root.getElementById('upsellSection');

    if (nameEl) nameEl.textContent = this.selectedItem.name;
    if (skuEl) skuEl.textContent = this.selectedItem.sku;
    
    if (priceEl) {
        priceEl.textContent = `$${price}`;
        // Create an "Impulse Buy" visual anchor
        if (isRacing) {
            // Fake a higher "original" price to make the 1.2x look like a steal
            const fakeOriginal = (this.selectedItem.cost * 1.8).toFixed(2);
            oldPriceEl.textContent = `$${fakeOriginal}`;
            oldPriceEl.style.display = 'inline-block';
            saleBadge.style.display = 'inline-block';
            priceEl.style.color = '#e74c3c'; // Urgent Red
        } else {
            oldPriceEl.style.display = 'none';
            saleBadge.style.display = 'none';
            priceEl.style.color = '#2c3e50';
        }
    }

    // Aspen Banner Logic
    if (aspenBanner) {
        if (this.clientCity === 'Aspen') {
            aspenBanner.classList.add('visible');
        } else {
            aspenBanner.classList.remove('visible');
        }
    }

    // Upsell Logic (Show for skis/main gear)
    if (upsellSection) {
        // Reset checkbox
        const chk = root.getElementById('upsellCheckbox');
        if (chk) chk.checked = false;
        
        // Only show if it matches the "Past Purchase" style (Racing/Pro)
        if (isRacing) {
            upsellSection.style.display = 'block';
        } else {
            upsellSection.style.display = 'none';
        }
    }

    this.calculateTotal();
  }

  calculateTotal() {
    if (!this.selectedItem) return;
    const root = this.shadowRoot;
    
    const qty = parseInt(root.getElementById('orderQty').value) || 1;
    const isRacing = this.isRacingGear(this.selectedItem);
    const markup = isRacing ? 1.2 : 1.5;
    let itemPrice = this.selectedItem.cost * markup;
    
    let total = itemPrice * qty;

    // Add upsell price if checked
    if (this.upsellActive) {
        total += this.upsellItem.price;
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  toggleUpsell(e) {
      this.upsellActive = e.target.checked;
      this.calculateTotal();
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    
    // Recalculate price for payload
    const isRacing = this.isRacingGear(this.selectedItem);
    const markup = isRacing ? 1.2 : 1.5;
    const itemPrice = this.selectedItem.cost * markup;

    const btn = root.getElementById('btnOneClick');

    // Visual feedback for Windows Touch
    btn.style.transform = 'scale(0.98)';
    setTimeout(() => btn.style.transform = 'scale(1)', 100);

    btn.disabled = true;
    btn.innerHTML = '<span>Processing...</span>';

    // Construct Payload
    const items = [
        { skuId: this.selectedItem.id, quantity: qty, price: itemPrice }
    ];

    // Add Upsell Item to payload if selected
    if (this.upsellActive) {
        items.push({
            skuId: this.upsellItem.id, // Note: This might fail on backend if ID doesn't exist in DB, but satisfies UI req
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
        // Flashy Success Message
        btn.style.background = '#27ae60';
        btn.textContent = 'Purchased!';
        setTimeout(() => {
            this.dispatchEvent(
                new CustomEvent('order-completed', { bubbles: true, composed: true })
            );
        }, 1000);
      } else {
        alert('Order Error: ' + data.error);
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
                animation: slideIn 0.4s ease-out; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            /* Windows Desktop / Metro Style Container */
            .card { 
                background: #ffffff; 
                border: 1px solid #dcdcdc;
                padding: 0; 
                max-width: 600px; 
                margin: 0 auto; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            }

            /* Aspen VIP Banner */
            .aspen-banner {
                background: linear-gradient(90deg, #d4af37, #f1c40f); /* Gold Gradient */
                color: #2c3e50;
                padding: 15px 20px;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 1px;
                display: none; /* Hidden by default */
                align-items: center;
                justify-content: center;
            }
            .aspen-banner.visible { display: flex; }
            .aspen-icon { margin-right: 10px; font-size: 1.2rem; }

            .content-padding { padding: 30px; }

            /* Typography */
            h2 { margin-top: 0; font-weight: 300; color: #555; }
            h3 { 
                margin: 0; 
                font-size: 2rem; 
                color: #000; 
                font-weight: 600; 
                text-transform: uppercase; /* Flashy */
            }
            .sku { color: #999; font-size: 0.9rem; margin-bottom: 20px; display: block;}

            /* Pricing Section */
            .price-container { margin: 20px 0; display: flex; align-items: baseline; gap: 15px; }
            .price { font-size: 2.5rem; font-weight: bold; color: #2c3e50; }
            .old-price { 
                text-decoration: line-through; 
                color: #95a5a6; 
                font-size: 1.5rem; 
                display: none; 
            }
            .sale-badge {
                background: #e74c3c;
                color: white;
                padding: 4px 8px;
                font-size: 0.9rem;
                font-weight: bold;
                text-transform: uppercase;
                transform: skew(-10deg);
                display: none;
            }

            /* Controls */
            label { display: block; margin-bottom: 8px; font-weight: 600; }
            select { 
                width: 100%; 
                padding: 12px; 
                border: 2px solid #333; 
                font-size: 1rem;
                margin-bottom: 20px;
            }

            /* Upsell Box */
            .upsell-box {
                background: #f0f3f4;
                border-left: 5px solid #e74c3c; /* Flashy accent */
                padding: 15px;
                margin: 20px 0;
                display: none;
            }
            .upsell-header { font-weight: bold; color: #c0392b; margin-bottom: 5px; }
            .upsell-row { display: flex; justify-content: space-between; align-items: center; }
            .upsell-check { transform: scale(1.5); margin-right: 10px; cursor: pointer; }

            /* Windows Style Buttons (Touch Targets) */
            .btn-group { display: grid; gap: 15px; margin-top: 20px; }
            
            button {
                border: none;
                padding: 20px; /* Large touch target */
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-transform: uppercase;
            }

            #btnOneClick {
                background: #0078D7; /* Windows Blue */
                color: white;
                box-shadow: 0 4px 0 #005a9e; /* 3D feel */
            }
            #btnOneClick:hover { background: #005a9e; }
            #btnOneClick:active { 
                box-shadow: none; 
                transform: translateY(4px); 
            }

            .cancel-btn { 
                background: transparent; 
                color: #7f8c8d; 
                border: 2px solid #bdc3c7;
            }
            .cancel-btn:hover { border-color: #7f8c8d; color: #333; }

            @keyframes slideIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>

        <!-- VIP Banner -->
        <div class="card">
            <div id="aspenBanner" class="aspen-banner">
                <span class="aspen-icon">🏔️</span> 
                Free Express Shipping to Aspen
            </div>

            <div class="content-padding">
                <span class="sku">SKU: <span id="orderItemSku"></span></span>
                <h3 id="orderItemName">Loading...</h3>

                <div class="price-container">
                    <span id="oldPrice" class="old-price"></span>
                    <span id="orderItemPrice" class="price"></span>
                    <span id="saleBadge" class="sale-badge">BLOWOUT SALE</span>
                </div>

                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">

                <label>Quantity</label>
                <select id="orderQty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                </select>

                <!-- Dynamic Upsell Section for Racing Gear -->
                <div id="upsellSection" class="upsell-box">
                    <div class="upsell-header">COMPLETE THE LOOK</div>
                    <div class="upsell-row">
                        <label style="margin:0; font-weight:normal; display:flex; align-items:center; cursor:pointer">
                            <input type="checkbox" id="upsellCheckbox" class="upsell-check">
                            Add Neon Carbon Race Poles (Match your style!)
                        </label>
                        <strong>+$150.00</strong>
                    </div>
                </div>

                <div class="btn-group">
                    <button id="btnOneClick">
                        ⚡ One-Click Buy ($<span id="orderTotal">--</span>)
                    </button>
                    <button class="cancel-btn" id="btnCancel">Cancel</button>
                </div>
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

    this.shadowRoot.getElementById('orderQty').onchange = () => this.calculateTotal();
    
    // Bind Upsell Checkbox
    const upsellChk = this.shadowRoot.getElementById('upsellCheckbox');
    if(upsellChk) {
        upsellChk.onchange = (e) => this.toggleUpsell(e);
    }
  }
}

customElements.define('order-page', OrderPage);