class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientProfile = null;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.fetchClientProfile();
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.fetchClientProfile();
    }
  }

  async fetchClientProfile() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientProfile = await res.json();
        this.updateBanner();
      }
    } catch (e) {
      console.error('Failed to load profile for banner logic');
    }
  }

  updateBanner() {
    const banner = this.shadowRoot.getElementById('aspenBanner');
    if (this.clientProfile && this.clientProfile.city === 'Aspen' && banner) {
      banner.classList.remove('hidden');
    }
  }

  // Calculate price based on Strategy: Racing (120%) vs Standard (150%)
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    // Keywords indicating racing gear based on User Profile context
    const isRacingGear = name.includes('race') || name.includes('world cup') || name.includes('pro');
    
    // Racing gear = 1.2x markup (Blowout), Standard = 1.5x
    const multiplier = isRacingGear ? 1.2 : 1.5;
    return (item.cost * multiplier).toFixed(2);
  }

  loadItem(item) {
    this.selectedItem = item;
    const finalPrice = this.calculatePrice(item);
    
    const root = this.shadowRoot;
    
    // Update Text
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${finalPrice}`;
    
    // Determine visual price display (showing discount if racing)
    const priceDisplay = root.getElementById('priceContainer');
    if (item.name.toLowerCase().includes('race') || item.name.toLowerCase().includes('world cup')) {
        const standardPrice = (item.cost * 1.5).toFixed(2);
        priceDisplay.innerHTML = `
            <span class="strikethrough">$${standardPrice}</span> 
            <span class="sale-price">$${finalPrice}</span> 
            <span class="badge">RACER DEAL</span>
        `;
    } else {
        priceDisplay.innerHTML = `<span class="price">$${finalPrice}</span>`;
    }

    // Update Button Total
    this.updateTotal(finalPrice);

    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';
    qtySelect.onchange = () => {
      const total = (finalPrice * qtySelect.value).toFixed(2);
      this.updateTotal(total);
    };

    // Render Upsell Logic based on Past Purchases (Pro Racer/Technical)
    this.renderUpsell(item);
  }

  updateTotal(amount) {
    const btn = this.shadowRoot.getElementById('btnOneClick');
    btn.innerHTML = `
      <span class="btn-icon">⚡</span> 
      <div>
        <div style="font-size: 0.9rem; font-weight: normal;">One-Click Buy</div>
        <div style="font-size: 1.1rem; font-weight: bold;">$${amount}</div>
      </div>
    `;
  }

  renderUpsell(currentItem) {
    const upsellContainer = this.shadowRoot.getElementById('upsellContainer');
    
    // Only suggest bindings/poles if buying skis
    // Assuming context implies current items are Skis
    const isSki = true; 

    if (isSki) {
        upsellContainer.innerHTML = `
            <div class="upsell-box">
                <div class="upsell-header">PERFECT MATCH FOR YOUR STYLE</div>
                <div class="upsell-item">
                    <div style="font-size:24px;">🔧</div>
                    <div>
                        <strong>Marker Xcomp 16 (High DIN)</strong><br>
                        <span style="font-size:0.8rem; color:#666;">Recommended for Former Pro Racers.</span>
                    </div>
                    <button class="add-upsell-btn">+ Add</button>
                </div>
            </div>
        `;
        upsellContainer.classList.remove('hidden');
    }
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    
    // Recalculate price logic to ensure payload is correct
    const price = parseFloat(this.calculatePrice(this.selectedItem));
    
    const btn = root.getElementById('btnOneClick');

    btn.disabled = true;
    btn.classList.add('processing');
    const originalContent = btn.innerHTML;
    btn.innerHTML = 'Processing Payment...';

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
        // Haptic feedback simulation
        if (navigator.vibrate) navigator.vibrate(50);
        
        alert(`VIP Order Confirmed!\nShipping to: ${this.clientProfile?.city || 'Address'}`);
        this.dispatchEvent(
          new CustomEvent('order-completed', { bubbles: true, composed: true })
        );
      } else {
        alert('Error: ' + data.error);
        btn.innerHTML = originalContent;
      }
    } catch (e) {
      alert('Network Error');
      btn.innerHTML = originalContent;
    } finally {
      btn.disabled = false;
      btn.classList.remove('processing');
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.3s ease-out; 
                font-family: 'Roboto', 'Segoe UI', sans-serif; 
                color: #202124;
            }
            
            /* Aspen Banner */
            .banner {
                background: linear-gradient(90deg, #1e3c72 0%, #2a5298 100%);
                color: white;
                padding: 12px 15px;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                margin-bottom: 15px;
                border-radius: 4px;
            }
            .banner-icon { margin-right: 8px; font-size: 1.2rem; }
            
            .card { 
                background: white; 
                padding: 24px; 
                border-radius: 16px; /* Pixel UI rounded corners */
                box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
                max-width: 500px; 
                margin: 0 auto; 
            }

            h2 { font-weight: 400; font-size: 1.5rem; margin-top: 0; }
            h3 { margin: 0 0 5px 0; color: #3c4043; font-size: 1.3rem; }
            
            .sku { color: #5f6368; font-size: 0.85rem; margin-bottom: 15px; display: block; }

            /* Pricing Styling */
            .price-container { margin: 15px 0; display: flex; align-items: center; gap: 10px; }
            .price { font-size: 1.5rem; color: #202124; font-weight: 500; }
            .sale-price { font-size: 1.5rem; color: #d93025; font-weight: bold; }
            .strikethrough { text-decoration: line-through; color: #5f6368; font-size: 1rem; }
            .badge { 
                background: #d93025; color: white; 
                padding: 2px 8px; border-radius: 4px; 
                font-size: 0.75rem; font-weight: bold; text-transform: uppercase; 
            }

            hr { border: 0; border-top: 1px solid #dadce0; margin: 20px 0; }

            /* Input Styling */
            label { display: block; margin-bottom: 8px; color: #5f6368; font-size: 0.9rem; }
            select { 
                width: 100%; padding: 12px; margin-bottom: 20px; 
                border: 1px solid #dadce0; border-radius: 8px; 
                background: white; font-size: 1rem; height: 48px;
            }

            /* Pixel 6 "One-Click" Button Styling */
            .one-click-btn { 
                background: #1a73e8; 
                color: white; 
                border: none; 
                height: 56px; /* High touch target */
                width: 100%; 
                border-radius: 28px; /* Material Design Pill Shape */
                cursor: pointer; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                gap: 10px;
                box-shadow: 0 4px 6px rgba(26, 115, 232, 0.3);
                transition: transform 0.1s, box-shadow 0.1s;
                touch-action: manipulation;
            }
            .one-click-btn:active { transform: scale(0.98); box-shadow: 0 2px 4px rgba(26, 115, 232, 0.3); }
            .one-click-btn.processing { background: #5f6368; }
            .btn-icon { font-size: 1.2rem; }

            .cancel-btn { 
                background: transparent; color: #5f6368; 
                border: none; width: 100%; padding: 15px; 
                margin-top: 10px; cursor: pointer; font-size: 0.9rem;
            }

            /* Upsell Section */
            .upsell-box {
                margin-bottom: 20px;
                border: 1px dashed #1a73e8;
                background: #f8f9fa;
                border-radius: 8px;
                padding: 12px;
            }
            .upsell-header {
                font-size: 0.75rem;
                font-weight: bold;
                color: #1a73e8;
                text-transform: uppercase;
                margin-bottom: 8px;
            }
            .upsell-item {
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.9rem;
            }
            .add-upsell-btn {
                margin-left: auto;
                background: white;
                border: 1px solid #dadce0;
                padding: 5px 10px;
                border-radius: 4px;
                color: #1a73e8;
                font-weight: bold;
                cursor: pointer;
            }

            .hidden { display: none !important; }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>

        <div id="aspenBanner" class="banner hidden">
            <span class="banner-icon">🏔️</span>
            <span><strong>Aspen VIP:</strong> Free Express Shipping included!</span>
        </div>

        <div class="card">
            <h2>Review Order</h2>
            
            <h3 id="orderItemName">Loading...</h3>
            <span id="orderItemSku" class="sku"></span>
            
            <div id="priceContainer" class="price-container">
                <span id="orderItemPrice" class="price"></span>
            </div>

            <!-- Technical Upsell -->
            <div id="upsellContainer" class="hidden"></div>

            <hr>

            <label>Quantity</label>
            <select id="orderQty">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
            </select>

            <button id="btnOneClick" class="one-click-btn">
                Loading...
            </button>
            
            <button class="cancel-btn" id="btnCancel">Not now</button>
        </div>
    `;

    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);