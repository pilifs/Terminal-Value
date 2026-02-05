//
class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientProfile = null;
  }

  connectedCallback() {
    this.render();
    this.clientId = this.getAttribute('client-id');
    if (this.clientId) {
      this.fetchClientData(this.clientId);
    }
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id' && newValue !== oldValue) {
      this.clientId = newValue;
      this.fetchClientData(newValue);
    }
  }

  async fetchClientData(id) {
    try {
      // Fetching client data to determine City and Past Purchases for personalization
      const res = await fetch(`/api/clients/${id}`);
      if (res.ok) {
        this.clientProfile = await res.json();
        // Re-render to show banners/upsells if data is available
        this.render();
        // Re-populate item data if we have one selected
        if (this.selectedItem) this.loadItem(this.selectedItem);
      }
    } catch (e) {
      console.error('Failed to load client profile for order customization', e);
    }
  }

  // Public method called by Router
  loadItem(item) {
    this.selectedItem = item;
    const price = item.cost * 1.5;

    // Check if shadowDOM is ready (it should be from connectedCallback)
    if (!this.shadowRoot.getElementById('orderItemName')) {
      this.render();
    }

    const root = this.shadowRoot;

    // 1. Populate Basic Info
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${price.toFixed(2)}`;
    root.getElementById('orderTotal').textContent = price.toFixed(2);

    // 2. Logic: Upsell System
    // Check if item is likely a Ski (contains "Ski", "Racer", "Carver", etc)
    const isSki = /Ski|Racer|Carver|Explorer|Powder/i.test(item.name);
    const upsellContainer = root.getElementById('upsellContainer');

    if (isSki && this.clientProfile) {
      // Mock logic: Suggest poles/bindings based on "Past Purchases" style
      // If they bought "World Cup Racer" before, sell them "Carbon Race Poles"
      upsellContainer.classList.remove('hidden');
      root.getElementById(
        'upsellMessage'
      ).textContent = `Complete your kit! Based on your ${
        this.clientProfile.pastPurchases
          ? 'history of high-performance gear'
          : 'style'
      }, we recommend:`;
    } else {
      upsellContainer.classList.add('hidden');
    }

    // 3. Setup Quantity Logic
    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';
    qtySelect.onchange = () => {
      const currentQty = parseInt(qtySelect.value);
      root.getElementById('orderTotal').textContent = (
        price * currentQty
      ).toFixed(2);
    };
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const price = this.selectedItem.cost * 1.5;
    const btn = root.getElementById('btnOneClick'); // Using the new One-Click button

    btn.disabled = true;
    btn.textContent = 'Processing...';

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
        alert('Order Confirmed! ID: ' + data.orderId);
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
      btn.textContent = 'Buy Now (1-Click)';
    }
  }

  render() {
    // Determine if Calgary Banner is needed
    const isCalgary =
      this.clientProfile &&
      (this.clientProfile.city === 'Calgary' ||
        this.clientProfile.city === 'YYC');

    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.3s; font-family: 'Segoe UI', sans-serif; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: left; max-width: 500px; margin: 0 auto; position: relative; overflow: hidden; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            hr { border: 0; border-top: 1px solid #eee; margin: 15px 0; }
            
            /* VIP Banner */
            .vip-banner {
                background: linear-gradient(90deg, #f1c40f, #f39c12);
                color: #fff;
                font-weight: bold;
                text-align: center;
                padding: 8px;
                margin: -20px -20px 20px -20px; /* Flush with card edges */
                font-size: 0.9rem;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            /* Upsell Section */
            .upsell-box {
                background: #f0f3f4;
                border-left: 4px solid #3498db;
                padding: 10px;
                margin: 15px 0;
                font-size: 0.9rem;
                color: #2c3e50;
            }
            .upsell-box strong { display: block; margin-bottom: 5px; color: #2980b9; }

            /* Standard Inputs */
            select { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #bdc3c7; border-radius: 4px; font-size: 1rem; }
            
            /* Pixel 6 Optimized Button */
            /* Material Design touch target size ~48dp */
            .one-click-btn {
                background: #27ae60; 
                color: white; 
                border: none; 
                padding: 16px 20px; /* Tall touch target */
                border-radius: 8px; /* Slightly more rounded for modern mobile feel */
                cursor: pointer; 
                width: 100%; 
                font-size: 1.1rem; 
                font-weight: bold;
                margin-top: 15px;
                min-height: 48px; /* Accessibility Requirement */
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                transition: transform 0.1s, background 0.2s;
            }
            .one-click-btn:active {
                transform: scale(0.98);
                background: #219150;
            }
            .one-click-btn:disabled { background: #95a5a6; cursor: not-allowed; }

            .cancel-btn { 
                background: transparent; 
                color: #7f8c8d; 
                border: 1px solid #bdc3c7; 
                padding: 12px; 
                width: 100%; 
                margin-top: 10px; 
                border-radius: 4px; 
                cursor: pointer;
            }
            .cancel-btn:hover { background: #ecf0f1; }
            .hidden { display: none; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Complete Your Order</h2>
        
        <div class="card">
            ${
              isCalgary
                ? `<div class="vip-banner">📦 Free Express Shipping to Calgary included for our VIP members!</div>`
                : ''
            }

            <h3 id="orderItemName">Loading Item...</h3>
            <p>SKU: <span id="orderItemSku">-</span></p>
            <p>Price: <span id="orderItemPrice" class="price">$0.00</span></p>
            
            <div id="upsellContainer" class="upsell-box hidden">
                <strong>⚡ Recommended Upgrade</strong>
                <span id="upsellMessage"></span>
                <div style="margin-top:5px; font-style:italic; font-size:0.85rem;">
                   + High-Grip Carbon Bindings added to cart suggestion
                </div>
            </div>

            <hr>
            <label>Quantity:</label>
            <select id="orderQty">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
            </select>

            <button id="btnOneClick" class="one-click-btn">
                Buy Now (1-Click) - $<span id="orderTotal">0.00</span>
            </button>
            
            <button class="cancel-btn" id="btnCancel">Cancel</button>
        </div>
    `;

    // Re-attach event listeners after innerHTML replacement
    const btnOneClick = this.shadowRoot.getElementById('btnOneClick');
    if (btnOneClick) btnOneClick.onclick = () => this.submitOrder();

    const btnCancel = this.shadowRoot.getElementById('btnCancel');
    if (btnCancel)
      btnCancel.onclick = () => {
        this.dispatchEvent(
          new CustomEvent('navigate-home', { bubbles: true, composed: true })
        );
      };
  }
}

customElements.define('order-page', OrderPage);
