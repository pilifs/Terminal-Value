class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientCity = null;
    this.isVip = true; // Assumed based on profile "Past Purchases" history
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
      const data = await res.json();
      this.clientCity = data.city;
      this.isRegistered = data.isRegistered;
      // Re-render to show/hide Whistler banner
      this.render();
      // Re-populate item data if we have one selected (to preserve view)
      if (this.selectedItem) this.loadItem(this.selectedItem);
    } catch (e) {
      console.error('Error fetching client details', e);
    }
  }

  // Helper to determine pricing strategy based on user profile context
  getPriceMultiplier(item) {
    const name = item.name.toLowerCase();
    // Pricing Constraint: Racing gear @ 120% COGS (1.2), others @ Standard (1.5)
    if (name.includes('race') || name.includes('racing')) {
      return 1.2;
    }
    return 1.5;
  }

  loadItem(item) {
    this.selectedItem = item;
    const multiplier = this.getPriceMultiplier(item);
    const price = item.cost * multiplier;

    const root = this.shadowRoot;

    // Safety check if render hasn't finished
    if (!root.getElementById('orderItemName')) return;

    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${price.toFixed(2)}`;
    root.getElementById('orderTotal').textContent = price.toFixed(2);

    // Upsell Logic: Check if buying skis, suggest rugged gear for this specific profile
    const upsellContainer = root.getElementById('upsellContainer');
    if (item.name.toLowerCase().includes('ski')) {
      upsellContainer.classList.remove('hidden');
      // Context: User destroys gear, needs rugged equipment
      root.getElementById('upsellText').textContent =
        'Recommended for your style: Titan-Grade Rugged Poles. Keep your balance on rough terrain.';
    } else {
      upsellContainer.classList.add('hidden');
    }

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
    const multiplier = this.getPriceMultiplier(this.selectedItem);
    const price = this.selectedItem.cost * multiplier;

    const btn = root.getElementById('btnConfirm');

    // UI Feedback for "One-Click" feel
    btn.disabled = true;
    btn.innerHTML = 'Processing Payment...';
    btn.style.backgroundColor = '#27ae60'; // Success green transition

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
        // Slight delay to show the "Processing" state to user
        setTimeout(() => {
          alert('Order Confirmed! ID: ' + data.orderId);
          this.dispatchEvent(
            new CustomEvent('order-completed', {
              bubbles: true,
              composed: true,
            })
          );
        }, 500);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        btn.textContent = 'One-Click Buy';
        btn.style.backgroundColor = '#e74c3c';
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      btn.textContent = 'One-Click Buy';
    }
  }

  render() {
    const isWhistler = this.clientCity === 'Whistler';

    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.4s ease-out; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            }
            .container {
                max-width: 600px;
                margin: 0 auto;
            }
            .card { 
                background: white; 
                padding: 30px; 
                border-radius: 12px; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
            }
            
            /* Typography */
            h2 { font-weight: 300; margin-bottom: 20px; }
            h3 { margin: 0 0 5px 0; color: #2c3e50; font-size: 1.5rem; }
            .sku { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 20px; display: block;}
            
            .price-tag { 
                font-size: 1.8rem; 
                color: #2c3e50; 
                font-weight: bold; 
                display: block;
                margin-bottom: 20px;
            }

            /* Whistler Banner */
            .whistler-banner {
                background: linear-gradient(90deg, #f1c40f, #f39c12);
                color: #fff;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: bold;
                text-align: center;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .vip-badge {
                background: rgba(0,0,0,0.2);
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.8rem;
                margin-left: 5px;
            }

            /* Upsell Section */
            .upsell-box {
                background: #f4f7f6;
                border-left: 4px solid #34495e; /* Dark slate for "Rugged" feel */
                padding: 15px;
                margin: 15px 0;
                font-size: 0.95rem;
                color: #555;
            }
            .upsell-title { font-weight: bold; color: #2c3e50; display: block; margin-bottom: 5px; }

            /* Inputs */
            label { font-weight: bold; display: block; margin-bottom: 8px; }
            select { 
                width: 100%; 
                padding: 12px; 
                font-size: 1.1rem;
                border: 1px solid #bdc3c7; 
                border-radius: 8px; 
                background: white;
                margin-bottom: 25px;
            }

            /* iPad Air Touch Targets & One-Click Button */
            .btn-group {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            
            button {
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-size: 1.2rem;
                font-weight: 600;
                transition: transform 0.1s, background 0.2s;
                touch-action: manipulation; /* Optimize for touch */
            }
            
            #btnConfirm {
                background: #e74c3c; /* Urgent Red */
                color: white;
                padding: 20px; /* Large touch target for iPad */
                box-shadow: 0 4px 10px rgba(231, 76, 60, 0.3);
            }
            #btnConfirm:active { transform: scale(0.98); }
            
            .cancel-btn {
                background: transparent;
                color: #7f8c8d;
                padding: 15px;
                border: 2px solid #ecf0f1;
            }

            .hidden { display: none; }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>

        <div class="container">
            <h2>Checkout</h2>
            
            ${
              isWhistler
                ? `
            <div class="whistler-banner">
                🏔️ FREE Express Shipping to Whistler 
                <span class="vip-badge">VIP MEMBER</span>
            </div>
            `
                : ''
            }

            <div class="card">
                <h3 id="orderItemName">Loading...</h3>
                <span class="sku">SKU: <span id="orderItemSku">-</span></span>
                
                <span id="orderItemPrice" class="price-tag">$0.00</span>

                <!-- Upsell Logic based on 'Rugged/Adventure' profile -->
                <div id="upsellContainer" class="upsell-box hidden">
                    <span class="upsell-title">💡 Gear Tip for Heavy Usage</span>
                    <span id="upsellText"></span>
                </div>

                <hr style="border:0; border-top:1px solid #eee; margin: 20px 0;">

                <label>Quantity</label>
                <select id="orderQty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4 (Team Pack)</option>
                </select>

                <div class="btn-group">
                    <button id="btnConfirm">
                        One-Click Buy ($<span id="orderTotal"></span>)
                    </button>
                    <button class="cancel-btn" id="btnCancel">Cancel Order</button>
                </div>
            </div>
        </div>
    `;

    // Re-attach listeners after render
    this.shadowRoot.getElementById('btnConfirm').onclick = () =>
      this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };

    // If we had an item loaded, ensure data is consistent after re-render
    if (this.selectedItem) this.loadItem(this.selectedItem);
  }
}

customElements.define('order-page', OrderPage);
