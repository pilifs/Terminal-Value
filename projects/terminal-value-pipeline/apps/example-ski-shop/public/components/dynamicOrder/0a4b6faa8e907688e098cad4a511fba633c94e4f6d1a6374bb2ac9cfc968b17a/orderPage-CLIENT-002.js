class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.upsellItem = null;
    this.isUpsellSelected = false;
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

  // Logic to determine pricing strategy based on item type
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    // Pricing Strategy: Racing gear @ 120% COGS ("Sales Blowout")
    // All other gear @ Standard 150% markup
    const isRacing =
      name.includes('race') || name.includes('comp') || name.includes('speed');
    const markup = isRacing ? 1.2 : 1.5;
    return item.cost * markup;
  }

  // Logic to generate an Upsell based on Past Purchases (Freestyle, Carver, Powder)
  // User values durability and is high-income.
  generateUpsell(mainItem) {
    const name = mainItem.name.toLowerCase();

    // Only upsell if buying Skis
    if (
      name.includes('ski') ||
      name.includes('board') ||
      name.includes('freestyle')
    ) {
      return {
        id: 'UP-POLE-001', // Mock ID
        name: 'Vail Series Carbon Poles (Durability Edt.)',
        price: 120.0, // Premium price point
        cost: 60.0,
        description:
          'Ultra-light, shatter-proof carbon. Perfect for your upcoming Vail trip.',
      };
    }
    return null;
  }

  loadItem(item) {
    this.selectedItem = item;
    const basePrice = this.calculatePrice(item);
    this.upsellItem = this.generateUpsell(item);

    // Reset State
    this.isUpsellSelected = false;

    // DOM Elements
    const root = this.shadowRoot;

    // 1. Main Product Details
    root.getElementById('productName').textContent = item.name;
    root.getElementById('productSku').textContent = item.sku;
    root.getElementById('productPrice').textContent = `$${basePrice.toFixed(
      2
    )}`;

    // 2. Pricing Logic (Standard vs Racing)
    const isRacing = item.name.toLowerCase().includes('race');
    const badge = root.getElementById('priceBadge');
    if (isRacing) {
      badge.textContent = 'Sales Blowout (Racing Special)';
      badge.className = 'badge badge-sale';
    } else {
      badge.textContent = 'Premium Quality';
      badge.className = 'badge badge-standard';
    }

    // 3. Upsell Section
    const upsellContainer = root.getElementById('upsellContainer');
    if (this.upsellItem) {
      upsellContainer.style.display = 'flex';
      root.getElementById('upsellName').textContent = this.upsellItem.name;
      root.getElementById(
        'upsellPrice'
      ).textContent = `+$${this.upsellItem.price.toFixed(2)}`;
      root.getElementById('upsellDesc').textContent =
        this.upsellItem.description;

      // Auto-check logic could go here, but we'll leave it unchecked for user consent
      root.getElementById('upsellCheckbox').checked = false;
    } else {
      upsellContainer.style.display = 'none';
    }

    // 4. Update Totals
    this.updateTotal();
  }

  updateTotal() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const basePrice = this.calculatePrice(this.selectedItem);

    let total = basePrice * qty;

    if (this.isUpsellSelected && this.upsellItem) {
      total += this.upsellItem.price; // Usually 1 pair of poles per order logic for simplicity
    }

    root.getElementById('btnTotal').textContent = total.toFixed(2);
  }

  toggleUpsell(e) {
    this.isUpsellSelected = e.target.checked;
    this.updateTotal();
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const basePrice = this.calculatePrice(this.selectedItem);
    const btn = root.getElementById('btnBuy');

    // UI Feedback
    btn.disabled = true;
    btn.innerHTML = '<span>Processing...</span>';

    // Construct Payload
    const items = [
      {
        skuId: this.selectedItem.id,
        quantity: qty,
        price: basePrice,
      },
    ];

    // Add Upsell if selected
    if (this.isUpsellSelected && this.upsellItem) {
      items.push({
        skuId: this.upsellItem.id,
        quantity: 1,
        price: this.upsellItem.price,
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
        // macOS style success feedback could go here
        this.dispatchEvent(
          new CustomEvent('order-completed', { bubbles: true, composed: true })
        );
      } else {
        alert('Order Error: ' + data.error);
        btn.disabled = false;
        btn.innerHTML = `One-Click Buy ($<span id="btnTotal">${(
          basePrice * qty
        ).toFixed(2)}</span>)`;
        this.updateTotal(); // Restore correct total text
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
              display: block; 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #333;
              animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* Layout Containers */
            .checkout-container {
              background: #fff;
              border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.1);
              max-width: 550px;
              margin: 20px auto;
              overflow: hidden;
            }

            /* Vancouver Banner */
            .vip-banner {
              background: #e8f5e9;
              color: #2e7d32;
              padding: 12px 20px;
              font-size: 0.9rem;
              font-weight: 600;
              display: flex;
              align-items: center;
              justify-content: center;
              border-bottom: 1px solid #c8e6c9;
            }
            .vip-icon { margin-right: 8px; }

            /* Content Padding */
            .content { padding: 30px; }

            /* Typography */
            h2 { margin-top: 0; font-weight: 700; font-size: 1.5rem; color: #1d1d1f; }
            h3 { margin: 0; font-size: 1.2rem; color: #1d1d1f; }
            .sku { color: #86868b; font-size: 0.85rem; margin-bottom: 8px; display: block; }
            .price { font-size: 1.4rem; font-weight: 600; color: #1d1d1f; margin: 5px 0 15px 0; }
            
            /* Badges */
            .badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .badge-sale { background: #ffebee; color: #c62828; }
            .badge-standard { background: #f5f5f7; color: #666; }

            /* Forms */
            .form-group { margin: 20px 0; }
            label { display: block; font-size: 0.9rem; color: #86868b; margin-bottom: 5px; }
            select {
              width: 100%;
              padding: 10px;
              border-radius: 8px;
              border: 1px solid #d2d2d7;
              font-size: 1rem;
              background-color: #fafafa;
              -webkit-appearance: none;
            }

            /* Upsell Box */
            .upsell-box {
              background: #fbfbfd;
              border: 1px solid #d2d2d7;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .upsell-check {
              transform: scale(1.3);
              accent-color: #0071e3;
              cursor: pointer;
            }
            .upsell-info h4 { margin: 0 0 4px 0; font-size: 0.95rem; }
            .upsell-info p { margin: 0; font-size: 0.8rem; color: #86868b; }
            .upsell-price { color: #0071e3; font-weight: bold; }

            /* One-Click Button (MacBook Pro Touch Target Optimized) */
            .action-bar { margin-top: 30px; }
            
            button.buy-btn {
              background: #000000; /* Apple Pay style black */
              color: white;
              border: none;
              border-radius: 8px;
              width: 100%;
              min-height: 54px; /* Large touch target for MacBook */
              font-size: 1.1rem;
              font-weight: 500;
              cursor: pointer;
              transition: transform 0.1s, background 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            button.buy-btn:hover { background: #333; }
            button.buy-btn:active { transform: scale(0.99); }
            
            button.cancel-btn {
              background: transparent;
              color: #0071e3;
              border: none;
              margin-top: 15px;
              cursor: pointer;
              font-size: 0.9rem;
              width: 100%;
            }
            button.cancel-btn:hover { text-decoration: underline; }

            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
        </style>

        <!-- Dynamic Context-Aware Banner -->
        <div class="checkout-container">
            <div class="vip-banner">
                <span class="vip-icon">🚚</span> 
                Free Express Shipping to Vancouver included for VIP members.
            </div>

            <div class="content">
                <h2>Secure Checkout</h2>
                
                <span id="priceBadge" class="badge"></span>
                <h3 id="productName">Loading...</h3>
                <span class="sku">SKU: <span id="productSku"></span></span>
                <div class="price" id="productPrice"></div>

                <div class="form-group">
                    <label for="orderQty">Quantity</label>
                    <select id="orderQty">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                    </select>
                </div>

                <!-- Intelligent Upsell for High Income/Vail Trip -->
                <div id="upsellContainer" class="upsell-box" style="display:none">
                    <input type="checkbox" id="upsellCheckbox" class="upsell-check">
                    <div class="upsell-info">
                        <h4>Add <span id="upsellName">Accessory</span>?</h4>
                        <p id="upsellDesc">Description...</p>
                        <div class="upsell-price" id="upsellPrice">+$0.00</div>
                    </div>
                </div>

                <div class="action-bar">
                    <button id="btnBuy" class="buy-btn">
                         Pay &nbsp; | &nbsp; One-Click Buy ($<span id="btnTotal">0.00</span>)
                    </button>
                    <button id="btnCancel" class="cancel-btn">Cancel Order</button>
                </div>
            </div>
        </div>
        `;

    // Event Listeners
    this.shadowRoot.getElementById('btnBuy').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
    this.shadowRoot.getElementById('orderQty').onchange = () =>
      this.updateTotal();
    this.shadowRoot.getElementById('upsellCheckbox').onchange = (e) =>
      this.toggleUpsell(e);
  }
}

customElements.define('order-page', OrderPage);
