class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
  }

  connectedCallback() {
    this.render();
    this.clientId = this.getAttribute('client-id');
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
    }
  }

  // Helper to determine if item is Racing gear based on context keywords
  isRacingGear(item) {
    const name = item.name.toLowerCase();
    const sku = item.sku.toLowerCase();
    return (
      name.includes('racer') ||
      name.includes('cup') ||
      name.includes('speed') ||
      sku.includes('rc')
    );
  }

  // Helper to determine if item is Backcountry/Touring
  isBackcountryGear(item) {
    const name = item.name.toLowerCase();
    return (
      name.includes('backcountry') ||
      name.includes('tour') ||
      name.includes('powder')
    );
  }

  loadItem(item) {
    this.selectedItem = item;
    const root = this.shadowRoot;

    // --- 1. Pricing Strategy Logic ---
    // Racing gear: ~120% COGS (Blowout)
    // Standard gear: ~150% COGS
    let multiplier = 1.5;
    let isBlowout = false;

    if (this.isRacingGear(item)) {
      multiplier = 1.2;
      isBlowout = true;
    }

    const price = item.cost * multiplier;

    // --- DOM Updates ---
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;

    // Formatting price
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${price.toFixed(2)}`;

    if (isBlowout) {
      priceEl.classList.add('blowout-price');
      root.getElementById('saleBadge').style.display = 'inline-block';
    } else {
      priceEl.classList.remove('blowout-price');
      root.getElementById('saleBadge').style.display = 'none';
    }

    // Set One-Click Button Text
    root.getElementById('btnOneClick').innerHTML = `
      <span class="btn-primary-text"> Pay / One-Click Buy</span>
      <span class="btn-sub-text">Total: $${price.toFixed(2)}</span>
    `;

    // --- 2. Upsell Logic ---
    const upsellContainer = root.getElementById('upsellContainer');
    upsellContainer.innerHTML = ''; // Reset

    // Context: "Past Purchases: Nordic Cross, Backcountry Tour..."
    // Context: "Excited to buy new stuff... lightweight setups"
    if (this.isBackcountryGear(item)) {
      upsellContainer.innerHTML = `
            <div class="upsell-box">
                <span class="upsell-icon">🏔️</span>
                <div class="upsell-text">
                    <strong>Complete your lightweight tour setup:</strong><br>
                    Add <em>Featherlight Carbon Poles</em> (150g)? 
                    <br><small>Perfect match for your avalanche safety kit.</small>
                </div>
                <button class="add-upsell-btn">+ Add ($89)</button>
            </div>
        `;
    } else if (this.isRacingGear(item)) {
      upsellContainer.innerHTML = `
            <div class="upsell-box">
                <span class="upsell-icon">🏁</span>
                <div class="upsell-text">
                    <strong>World Cup Standard:</strong><br>
                    Upgrade to <em>Titanium Race Bindings</em>? 
                </div>
                <button class="add-upsell-btn">+ Add ($240)</button>
            </div>
        `;
    }
  }

  async submitOrder() {
    const root = this.shadowRoot;
    // Default to 1 for One-Click logic to reduce friction
    const qty = 1;

    // Recalculate price based on logic in loadItem
    let multiplier = this.isRacingGear(this.selectedItem) ? 1.2 : 1.5;
    const price = this.selectedItem.cost * multiplier;

    const btn = root.getElementById('btnOneClick');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="btn-primary-text">Processing...</span>';

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
        btn.innerHTML = '<span class="btn-primary-text">Success! ⛷️</span>';

        setTimeout(() => {
          this.dispatchEvent(
            new CustomEvent('order-completed', {
              bubbles: true,
              composed: true,
            })
          );
        }, 1000);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1); 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            
            /* iPad Air / Tablet Specific Layout Tweaks */
            .container {
                max-width: 600px;
                margin: 0 auto;
                padding-bottom: 40px;
            }

            .card { 
                background: white; 
                border-radius: 16px; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
                overflow: hidden;
            }

            /* 3. Location Banner Logic: SLC Context */
            .location-banner {
                background: linear-gradient(90deg, #2c3e50 0%, #3498db 100%);
                color: white;
                padding: 12px 20px;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .location-badge {
                background: #f1c40f;
                color: #2c3e50;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.75rem;
                text-transform: uppercase;
            }

            .product-details {
                padding: 30px;
            }

            h2 { font-size: 1.8rem; margin: 0 0 5px 0; color: #333; }
            h3 { font-size: 1.4rem; margin: 0; color: #555; font-weight: 500; }
            
            .sku { color: #999; font-size: 0.9rem; margin-bottom: 20px; display: block; }

            .price-container {
                margin: 20px 0;
                display: flex;
                align-items: baseline;
                gap: 10px;
            }

            .price { 
                font-size: 2rem; 
                color: #333; 
                font-weight: 700; 
            }
            
            .blowout-price { color: #e74c3c; }
            
            .sale-badge {
                display: none; /* Toggled in JS */
                background: #e74c3c;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 0.9rem;
                transform: translateY(-4px);
            }

            /* Upsell Styles */
            .upsell-container {
                margin: 20px 0;
                border: 1px dashed #bdc3c7;
                border-radius: 8px;
                background: #f9f9f9;
            }
            .upsell-box {
                display: flex;
                align-items: center;
                padding: 15px;
                gap: 15px;
            }
            .upsell-icon { font-size: 24px; }
            .upsell-text { flex: 1; font-size: 0.9rem; line-height: 1.4; }
            .add-upsell-btn {
                background: white;
                border: 1px solid #3498db;
                color: #3498db;
                padding: 8px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: bold;
            }

            /* 4. One-Click Buy Button (iPad Target) */
            .one-click-btn {
                background: #000; /* Apple Pay style black */
                color: white;
                border: none;
                width: 100%;
                padding: 18px; /* Large touch target */
                border-radius: 12px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                transition: transform 0.1s, box-shadow 0.1s;
                touch-action: manipulation; /* Optimizes touch response */
                -webkit-tap-highlight-color: transparent;
            }
            
            .one-click-btn:active {
                transform: scale(0.98);
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }

            .btn-primary-text {
                font-size: 1.2rem;
                font-weight: 600;
                margin-bottom: 2px;
            }
            
            .btn-sub-text {
                font-size: 0.85rem;
                color: #ccc;
                font-weight: 400;
            }

            .cancel-link {
                display: block;
                text-align: center;
                margin-top: 20px;
                color: #7f8c8d;
                text-decoration: underline;
                cursor: pointer;
                padding: 10px; /* Touch target */
            }

            @keyframes slideUp { 
                from { opacity: 0; transform: translateY(20px); } 
                to { opacity: 1; transform: translateY(0); } 
            }
        </style>

        <div class="container">
            <div class="card">
                <!-- SLC Banner -->
                <div class="location-banner">
                    <span class="location-badge">VIP</span>
                    <span>Free Express Shipping to <strong>Salt Lake City</strong> included.</span>
                </div>

                <div class="product-details">
                    <h2>Checkout</h2>
                    <h3 id="orderItemName">Loading...</h3>
                    <span id="orderItemSku" class="sku"></span>
                    
                    <div class="price-container">
                        <span id="orderItemPrice" class="price"></span>
                        <span id="saleBadge" class="sale-badge">SALES BLOWOUT</span>
                    </div>

                    <!-- Dynamic Upsell Section -->
                    <div id="upsellContainer" class="upsell-container"></div>

                    <!-- iPad One-Click Button -->
                    <button id="btnOneClick" class="one-click-btn">
                        <span class="btn-primary-text">Buy Now</span>
                    </button>

                    <a id="btnCancel" class="cancel-link">Cancel Order</a>
                </div>
            </div>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnOneClick').onclick = () =>
      this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);
