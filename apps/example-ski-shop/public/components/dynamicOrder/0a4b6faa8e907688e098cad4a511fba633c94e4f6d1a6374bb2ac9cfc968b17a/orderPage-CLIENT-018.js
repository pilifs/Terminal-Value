class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.upsellItem = {
      id: 'UPSELL-POLE-001',
      name: 'Carbon Team Race Poles',
      price: 120.0,
      cost: 80.0,
    };
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

  // Detects if the item is "Racing" gear based on name/sku context
  // Returns the calculated sale price
  calculatePrice(item) {
    const nameLower = item.name.toLowerCase();
    // Pricing Strategy: Racing gear @ 120% COGS, Standard @ 150% COGS
    const isRacing =
      nameLower.includes('race') ||
      nameLower.includes('world cup') ||
      nameLower.includes('slalom');

    if (isRacing) {
      return { price: item.cost * 1.2, isSale: true };
    }
    return { price: item.cost * 1.5, isSale: false };
  }

  loadItem(item) {
    this.selectedItem = item;
    const { price, isSale } = this.calculatePrice(item);

    // Store calculated price for submission
    this.currentPrice = price;

    const root = this.shadowRoot;

    // Bind Item Data
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;

    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${price.toFixed(2)}`;

    // Sale Badge Logic
    if (isSale) {
      root.getElementById('saleBadge').style.display = 'inline-block';
      priceEl.classList.add('sale-text');
    } else {
      root.getElementById('saleBadge').style.display = 'none';
    }

    // Reset Form
    root.getElementById('orderQty').value = '1';
    root.getElementById('upsellCheckbox').checked = false;
    this.isUpsellSelected = false;

    // Render Upsell UI based on Past Purchases (Aggressive/Performance)
    // We only show pole upsells if they are buying Skis
    const isSki = true; // Assuming inventory items are skis for this context
    if (isSki) {
      root.getElementById('upsellSection').classList.remove('hidden');
    }

    this.updateTotal();
  }

  updateTotal() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    let total = this.currentPrice * qty;

    if (this.isUpsellSelected) {
      total += this.upsellItem.price;
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const btn = root.getElementById('btnOneClick');

    // UI Feedback for "One-Click" feel
    btn.disabled = true;
    btn.innerHTML = `<span>Processing...</span>`;
    btn.classList.add('processing');

    // Construct Payload
    const itemsPayload = [
      {
        skuId: this.selectedItem.id,
        quantity: qty,
        price: this.currentPrice,
      },
    ];

    // Add Upsell if selected
    if (this.isUpsellSelected) {
      itemsPayload.push({
        skuId: this.upsellItem.id,
        quantity: 1,
        price: this.upsellItem.price,
      });
    }

    const payload = {
      clientId: this.clientId,
      items: itemsPayload,
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

        btn.innerHTML = `<span>Purchase Complete!</span>`;
        btn.style.backgroundColor = '#27ae60';

        setTimeout(() => {
          this.dispatchEvent(
            new CustomEvent('order-completed', {
              bubbles: true,
              composed: true,
            })
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
    // Check Client Profile for Calgary (Accessing global state from app.js if available, or defaulting logic)
    // In a real scenario, this data might be passed in. We check the global state object.
    const city = window.state?.clientProfile?.city || '';
    const isCalgary = city.toLowerCase() === 'calgary';

    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.3s ease-out; 
                font-family: 'Roboto', 'Segoe UI', sans-serif; 
                padding-bottom: 80px; /* Space for mobile nav */
            }
            
            /* Pixel 6 / Android Styling Nuances */
            .card { 
                background: white; 
                border-radius: 24px; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.08); 
                padding: 24px;
                margin: 0 auto;
                max-width: 500px;
                position: relative;
                overflow: hidden;
            }

            /* Calgary Banner */
            .vip-banner {
                background: #e8f5e9;
                color: #2e7d32;
                font-size: 0.9rem;
                padding: 12px 24px;
                margin: -24px -24px 20px -24px;
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: 600;
                border-bottom: 1px solid #c8e6c9;
            }

            h2 { font-size: 1.5rem; color: #202124; margin-bottom: 20px; }
            h3 { margin: 0; color: #3c4043; font-size: 1.3rem; }
            
            .sku { color: #5f6368; font-size: 0.9rem; margin-top: 4px; }
            
            .price-container { margin: 15px 0; display: flex; align-items: center; gap: 10px; }
            .price { font-size: 1.8rem; color: #3c4043; font-weight: bold; }
            .sale-text { color: #d93025; }
            
            .badge {
                background: #d93025;
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: bold;
                text-transform: uppercase;
                display: none; /* Toggled by JS */
            }

            /* Upsell Section - "High Performance" theme */
            .upsell-box {
                background: #f8f9fa;
                border: 1px solid #dadce0;
                border-radius: 12px;
                padding: 16px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .upsell-box.hidden { display: none; }
            
            .upsell-info h4 { margin: 0 0 4px 0; color: #202124; }
            .upsell-info p { margin: 0; font-size: 0.85rem; color: #5f6368; }
            
            /* Custom Checkbox for Touch Targets */
            .checkbox-wrapper input {
                width: 24px;
                height: 24px;
                accent-color: #1a73e8;
                cursor: pointer;
            }

            .controls { display: flex; align-items: center; justify-content: space-between; margin: 20px 0; }
            select { 
                padding: 12px; 
                border-radius: 8px; 
                border: 1px solid #dadce0; 
                background: white;
                font-size: 1rem;
                min-width: 80px;
            }

            /* Pixel 6 "One-Click" Button Styles */
            .btn-one-click { 
                background: #1a73e8; 
                color: white; 
                border: none; 
                padding: 0;
                border-radius: 28px; /* Pill shape */
                cursor: pointer; 
                width: 100%; 
                font-size: 1.1rem; 
                font-weight: 500;
                height: 56px; /* Large touch target */
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background 0.2s, transform 0.1s;
                box-shadow: 0 4px 10px rgba(26, 115, 232, 0.3);
            }
            .btn-one-click:active { transform: scale(0.98); background: #1765cc; }
            .btn-one-click:disabled { background: #dadce0; color: #80868b; box-shadow: none; cursor: default; }

            .cancel-link {
                display: block;
                text-align: center;
                margin-top: 20px;
                color: #5f6368;
                text-decoration: underline;
                cursor: pointer;
                padding: 10px; /* Hit area */
            }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>

        <h2>Review Order</h2>
        <div class="card">
            ${
              isCalgary
                ? `
            <div class="vip-banner">
                <span>🚛</span> Free Express Shipping to Calgary included.
            </div>
            `
                : ''
            }

            <h3 id="orderItemName">Loading...</h3>
            <p class="sku">SKU: <span id="orderItemSku">...</span></p>
            
            <div class="price-container">
                <span id="orderItemPrice" class="price">$0.00</span>
                <span id="saleBadge" class="badge">Blowout Sale</span>
            </div>

            <!-- Smart Upsell for High Performance User -->
            <div id="upsellSection" class="upsell-box hidden">
                <div class="checkbox-wrapper">
                    <input type="checkbox" id="upsellCheckbox">
                </div>
                <div class="upsell-info">
                    <h4>Add Carbon Team Poles?</h4>
                    <p>Perfect match for your aggressive style. <br><strong>+$${this.upsellItem.price.toFixed(
                      0
                    )}</strong> (Special Offer)</p>
                </div>
            </div>

            <div class="controls">
                <label>Quantity</label>
                <select id="orderQty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                </select>
            </div>

            <button id="btnOneClick" class="btn-one-click">
                One-Click Buy &nbsp; • &nbsp; $<span id="orderTotal">...</span>
            </button>

            <a class="cancel-link" id="btnCancel">Cancel Order</a>
        </div>
        `;

    // Event Listeners
    const root = this.shadowRoot;

    // Qty Change
    root.getElementById('orderQty').onchange = () => this.updateTotal();

    // Upsell Toggle
    root.getElementById('upsellCheckbox').onchange = (e) => {
      this.isUpsellSelected = e.target.checked;
      this.updateTotal();
    };

    // One-Click Buy
    root.getElementById('btnOneClick').onclick = () => this.submitOrder();

    // Cancel
    root.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);
