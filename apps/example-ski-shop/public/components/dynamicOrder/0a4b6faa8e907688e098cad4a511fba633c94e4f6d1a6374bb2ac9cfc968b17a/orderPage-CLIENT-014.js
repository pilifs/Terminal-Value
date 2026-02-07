class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientProfile = null;
    this.hasUpsell = false;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.fetchClientProfile();
    }
  }

  connectedCallback() {
    this.render(); // Initial render
  }

  async fetchClientProfile() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientProfile = await res.json();
        this.updateView();
      }
    } catch (e) {
      console.error('Failed to load client profile', e);
    }
  }

  // Logic to determine pricing strategy
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    // Pricing Strategy: Racing gear (World Cup, Racer) at 120%, others at 150%
    const isRacing = name.includes('race') || name.includes('world cup');

    const margin = isRacing ? 1.2 : 1.5;
    const finalPrice = item.cost * margin;

    return {
      price: finalPrice,
      isSale: isRacing, // Flag for UI styling
      originalPrice: item.cost * 1.5, // Compare against standard markup
    };
  }

  // Logic to determine Upsell based on Past Purchases style
  getUpsellItem(item) {
    // If buying skis, suggest accessories
    if (
      item.name.toLowerCase().includes('ski') ||
      item.name.toLowerCase().includes('mountain')
    ) {
      return {
        id: 'ACC-BINDING-PRO', // Mock ID
        name: 'Pro Performance Bindings',
        price: 150.0,
        img: '🎿',
      };
    }
    return null;
  }

  loadItem(item) {
    this.selectedItem = item;
    this.updateView();
  }

  updateView() {
    if (!this.selectedItem) return;

    const root = this.shadowRoot;
    const item = this.selectedItem;

    // 1. Calculate Price
    const pricing = this.calculatePrice(item);

    // 2. Determine UI Data
    const isVancouver = this.clientProfile?.city === 'Vancouver';
    const upsell = this.getUpsellItem(item);

    // 3. Populate DOM Elements
    const nameEl = root.getElementById('orderItemName');
    if (nameEl) nameEl.textContent = item.name;

    const skuEl = root.getElementById('orderItemSku');
    if (skuEl) skuEl.textContent = `SKU: ${item.sku}`;

    // Price Display Logic
    const priceContainer = root.getElementById('priceContainer');
    if (priceContainer) {
      if (pricing.isSale) {
        priceContainer.innerHTML = `
                <span class="old-price">$${pricing.originalPrice.toFixed(
                  2
                )}</span>
                <span class="sale-price">$${pricing.price.toFixed(2)}</span>
                <span class="badge">BLOWOUT DEAL</span>
            `;
      } else {
        priceContainer.innerHTML = `<span class="std-price">$${pricing.price.toFixed(
          2
        )}</span>`;
      }
    }

    // VIP Banner Logic
    const banner = root.getElementById('vipBanner');
    if (banner) {
      if (isVancouver) {
        banner.style.display = 'block';
        banner.innerHTML = `🚚 <strong>VIP Benefit:</strong> Free Express Shipping to Vancouver included.`;
      } else {
        banner.style.display = 'none';
      }
    }

    // Upsell Logic
    const upsellContainer = root.getElementById('upsellContainer');
    if (upsellContainer && upsell) {
      upsellContainer.style.display = 'block';
      root.getElementById('upsellName').textContent = upsell.name;
      root.getElementById('upsellPrice').textContent = `$${upsell.price.toFixed(
        2
      )}`;

      const checkbox = root.getElementById('upsellCheckbox');
      checkbox.onclick = (e) => {
        this.hasUpsell = e.target.checked;
        this.updateTotalButton(pricing.price, upsell.price);
      };
    } else if (upsellContainer) {
      upsellContainer.style.display = 'none';
    }

    // Initial Button State
    this.updateTotalButton(pricing.price, upsell ? upsell.price : 0);
  }

  updateTotalButton(basePrice, upsellPrice) {
    const total = basePrice + (this.hasUpsell ? upsellPrice : 0);
    const btn = this.shadowRoot.getElementById('btnConfirm');
    if (btn) btn.textContent = `One-Click Buy ($${total.toFixed(2)})`;
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const pricing = this.calculatePrice(this.selectedItem);
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.textContent = 'Processing...';

    // Construct Payload
    const items = [
      {
        skuId: this.selectedItem.id,
        quantity: 1, // Defaulting to 1 based on "One-Click" requirement
        price: pricing.price,
      },
    ];

    // Add Upsell if selected
    if (this.hasUpsell) {
      const upsell = this.getUpsellItem(this.selectedItem);
      items.push({
        skuId: upsell.id,
        quantity: 1,
        price: upsell.price,
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
        // Loyalty Note Interaction
        alert(
          `Order Confirmed!\n\nWe're prepping your gear. Your coffee is brewing! ☕`
        );

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
      // Re-calculate total for button text reset
      const upsell = this.getUpsellItem(this.selectedItem);
      this.updateTotalButton(pricing.price, upsell ? upsell.price : 0);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.3s ease-out; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                padding-bottom: 40px;
            }
            
            /* iPhone 13 / Mobile Optimized Card */
            .card { 
                background: #ffffff; 
                padding: 25px; 
                border-radius: 20px; 
                box-shadow: 0 10px 25px rgba(0,0,0,0.05); 
                max-width: 100%; 
                margin: 0 auto; 
                box-sizing: border-box;
            }

            /* Typography */
            h3 { font-size: 1.5rem; margin: 0 0 5px 0; color: #1a1a1a; letter-spacing: -0.5px; }
            .sku { color: #888; font-size: 0.85rem; margin-bottom: 20px; display: block; }
            
            /* Pricing Styles */
            .price-container { margin: 15px 0; display: flex; align-items: center; gap: 10px; }
            .std-price { font-size: 1.8rem; font-weight: 700; color: #333; }
            .sale-price { font-size: 1.8rem; font-weight: 700; color: #d32f2f; }
            .old-price { text-decoration: line-through; color: #999; font-size: 1.1rem; }
            .badge { 
                background: #d32f2f; color: white; 
                padding: 4px 8px; border-radius: 4px; 
                font-size: 0.7rem; font-weight: bold; text-transform: uppercase; 
            }

            /* VIP Banner */
            .vip-banner { 
                background: #fff8e1; 
                border-left: 4px solid #f1c40f; 
                color: #8d6e03; 
                padding: 12px; 
                font-size: 0.9rem; 
                margin-bottom: 20px; 
                border-radius: 0 4px 4px 0;
                display: none; /* Toggled via JS */
            }

            /* CRM / Comfort Note */
            .coffee-note {
                background: #fdfbf7;
                color: #5d4037;
                padding: 12px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                gap: 10px;
                font-size: 0.9rem;
                margin-bottom: 20px;
                border: 1px solid #efebe9;
            }

            /* Upsell Section */
            .upsell-box {
                border: 2px solid #e0e0e0;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 25px;
                display: none; /* Toggled via JS */
            }
            .upsell-header { font-weight: bold; font-size: 0.9rem; color: #555; margin-bottom: 10px; }
            .upsell-row { display: flex; justify-content: space-between; align-items: center; }
            .upsell-info { display: flex; flex-direction: column; }
            .upsell-name { font-weight: 600; font-size: 1rem; }
            .upsell-price { color: #555; font-size: 0.9rem; }
            
            /* Checkbox Styling (Large Touch Target) */
            input[type="checkbox"] {
                width: 24px; height: 24px; accent-color: #2c3e50; cursor: pointer;
            }

            /* Buttons - Apple Style "One Click" */
            .action-area { margin-top: 20px; }
            button#btnConfirm { 
                background: #000; 
                color: white; 
                border: none; 
                padding: 18px; 
                border-radius: 14px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1.1rem; 
                font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                transition: transform 0.1s;
                -webkit-tap-highlight-color: transparent;
            }
            button#btnConfirm:active { transform: scale(0.98); }
            button#btnConfirm:disabled { background: #999; transform: none; }
            
            .cancel-btn { 
                background: transparent; 
                color: #888; 
                border: none; 
                padding: 15px; 
                width: 100%; 
                font-size: 1rem; 
                margin-top: 5px; 
                cursor: pointer;
            }

            hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }

            @keyframes slideUp { 
                from { transform: translateY(20px); opacity: 0; } 
                to { transform: translateY(0); opacity: 1; } 
            }
        </style>

        <div class="vip-banner" id="vipBanner"></div>

        <div class="card">
            <h3 id="orderItemName">Loading...</h3>
            <span id="orderItemSku" class="sku"></span>
            
            <div id="priceContainer" class="price-container"></div>
            
            <!-- CRM Note: Catering to "Comfort" and "Coffee" preference -->
            <div class="coffee-note">
                <span style="font-size: 1.5rem">☕</span> 
                <div>
                    <strong>Welcome back!</strong><br>
                    Your complimentary double espresso will be ready upon pickup.
                </div>
            </div>

            <!-- Smart Upsell Logic -->
            <div id="upsellContainer" class="upsell-box">
                <div class="upsell-header">RECOMMENDED FOR YOUR STYLE</div>
                <div class="upsell-row">
                    <div class="upsell-info">
                        <span id="upsellName" class="upsell-name"></span>
                        <span id="upsellPrice" class="upsell-price"></span>
                    </div>
                    <input type="checkbox" id="upsellCheckbox">
                </div>
            </div>

            <div class="action-area">
                <button id="btnConfirm">One-Click Buy</button>
                <button class="cancel-btn" id="btnCancel">Cancel Order</button>
            </div>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnConfirm').onclick = () =>
      this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);
