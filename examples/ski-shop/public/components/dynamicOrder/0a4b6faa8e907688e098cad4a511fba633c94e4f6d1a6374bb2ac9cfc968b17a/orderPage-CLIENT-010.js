class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientProfile = null;
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.fetchClientProfile();
    this.render();
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

  async fetchClientProfile() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientProfile = await res.json();
        // Re-render if item is already loaded to update Aspen banner
        if (this.selectedItem) this.render();
      }
    } catch (e) {
      console.error('Failed to load client profile', e);
    }
  }

  // Helper to determine pricing strategy
  calculatePrice(item) {
    // Strategy: Racing gear (120% COGS) vs Standard (150% COGS)
    // keywords based on CRM notes and Past Purchases (World Cup, Piste, Race)
    const isRacingGear = /race|world cup|piste/i.test(item.name) || /race|world cup|piste/i.test(item.sku);
    const markup = isRacingGear ? 1.2 : 1.5;
    return {
      finalPrice: item.cost * markup,
      isSale: isRacingGear // Flag for UI "Blowout" tag
    };
  }

  // Public method called by Router
  loadItem(item) {
    this.selectedItem = item;
    this.render(); // Re-render with item data
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    
    // Recalculate price to ensure it matches the display logic
    const { finalPrice } = this.calculatePrice(this.selectedItem);
    
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.innerHTML = `
      <span class="spinner"></span> Processing...
    `;

    const payload = {
      clientId: this.clientId,
      items: [{ skuId: this.selectedItem.id, quantity: qty, price: finalPrice }],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Simple One-Click feedback animation
        btn.style.background = '#27ae60';
        btn.textContent = 'Purchased!';
        setTimeout(() => {
            this.dispatchEvent(
            new CustomEvent('order-completed', { bubbles: true, composed: true })
            );
        }, 500);
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

  getUpsellHTML() {
    if (!this.selectedItem) return '';
    
    // Upsell Logic: Only show if buying skis
    // CRM Note: "Extremely technical... Prefers stiff boots and high DIN bindings."
    const isSki = /ski|racer|carver|explorer/i.test(this.selectedItem.name);
    
    if (isSki) {
      return `
        <div class="upsell-container">
          <div class="upsell-header">⚠️ Pro Racer Recommendation</div>
          <div class="upsell-item">
            <div class="upsell-text">
              <strong>Match your style:</strong> Based on your preference for hardpack groomers, 
              we recommend the <em>Titanium 18 DIN Race Bindings</em>.
            </div>
            <button class="upsell-add-btn">+ Add for $250</button>
          </div>
        </div>
      `;
    }
    return '';
  }

  render() {
    // If no item loaded yet, show placeholder
    if (!this.selectedItem) {
      this.shadowRoot.innerHTML = ``;
      return;
    }

    const { finalPrice, isSale } = this.calculatePrice(this.selectedItem);
    const isAspen = this.clientProfile && this.clientProfile.city === 'Aspen';

    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            }
            
            /* MacBook Pro / High-End UI Styling */
            .card { 
                background: #ffffff; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.08); 
                max-width: 550px; 
                margin: 0 auto; 
                text-align: left;
                border: 1px solid #f0f0f0;
            }

            h2 { 
                text-align: center; 
                font-weight: 600; 
                color: #1d1d1f; 
                margin-bottom: 30px;
            }

            h3 { 
                margin: 0 0 5px 0; 
                color: #1d1d1f; 
                font-size: 1.5rem; 
            }

            .sku {
                color: #86868b;
                font-size: 0.9rem;
                font-family: 'SF Mono', 'Consolas', monospace;
                margin-bottom: 15px;
            }

            .price-container {
                display: flex;
                align-items: baseline;
                gap: 10px;
                margin-bottom: 20px;
            }

            .price { 
                font-size: 1.8rem; 
                color: #1d1d1f; 
                font-weight: 700; 
            }

            .sale-tag {
                background: #ff3b30;
                color: white;
                font-size: 0.75rem;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Aspen Banner */
            .aspen-banner {
                background: linear-gradient(90deg, #f5d020 0%, #f53803 100%);
                color: white;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-weight: 600;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 8px;
                box-shadow: 0 4px 10px rgba(245, 166, 35, 0.3);
            }

            hr { border: 0; border-top: 1px solid #e5e5e5; margin: 25px 0; }

            /* Controls */
            .controls {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 25px;
            }

            select { 
                padding: 8px 12px; 
                border: 1px solid #d2d2d7; 
                border-radius: 6px; 
                font-size: 1rem;
                background-color: #fff;
                min-width: 80px;
            }

            /* MacBook One-Click Button Style */
            .buy-btn { 
                background: #0071e3; 
                color: white; 
                border: none; 
                padding: 16px 24px; 
                border-radius: 8px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1.1rem; 
                font-weight: 500;
                transition: all 0.2s ease;
                /* Larger touch target for Touch Pad/Screen */
                min-height: 55px; 
            }
            .buy-btn:hover { background: #0077ed; transform: scale(1.01); }
            .buy-btn:active { transform: scale(0.99); }
            .buy-btn:disabled { background: #d2d2d7; cursor: not-allowed; transform: none; }

            .cancel-btn { 
                background: transparent; 
                color: #0071e3;
                margin-top: 15px; 
                font-size: 0.9rem;
            }
            .cancel-btn:hover { text-decoration: underline; background: transparent; }

            /* Upsell Styles */
            .upsell-container {
                background: #fbfbfd;
                border: 1px solid #d2d2d7;
                border-radius: 8px;
                padding: 15px;
                margin-top: 20px;
            }
            .upsell-header {
                font-size: 0.8rem;
                text-transform: uppercase;
                color: #86868b;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .upsell-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
                font-size: 0.9rem;
            }
            .upsell-add-btn {
                background: white;
                border: 1px solid #0071e3;
                color: #0071e3;
                padding: 6px 12px;
                border-radius: 15px;
                font-size: 0.8rem;
                cursor: pointer;
                white-space: nowrap;
                width: auto;
                min-height: auto;
            }
            .upsell-add-btn:hover { background: #eff6ff; }

            @keyframes slideUp { 
                from { opacity: 0; transform: translateY(20px); } 
                to { opacity: 1; transform: translateY(0); } 
            }
        </style>

        <h2>Checkout</h2>
        <div class="card">
            
            ${isAspen ? `
                <div class="aspen-banner">
                    <span>🏔️</span>
                    <span>Free Express Shipping to Aspen included for our VIP members.</span>
                </div>
            ` : ''}

            <h3 id="orderItemName">${this.selectedItem.name}</h3>
            <div class="sku">SKU: ${this.selectedItem.sku}</div>
            
            <div class="price-container">
                <span class="price">$${finalPrice.toFixed(2)}</span>
                ${isSale ? '<span class="sale-tag">Racing Blowout Sale</span>' : ''}
            </div>

            <div class="controls">
                <label>Quantity</label>
                <select id="orderQty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                </select>
            </div>

            <button class="buy-btn" id="btnConfirm">
                 One-Click Buy &nbsp; ($<span id="orderTotal">${finalPrice.toFixed(2)}</span>)
            </button>
            
            <button class="buy-btn cancel-btn" id="btnCancel">Cancel Order</button>

            ${this.getUpsellHTML()}
        </div>
        `;

    // Re-attach listeners after innerHTML replacement
    const qtySelect = this.shadowRoot.getElementById('orderQty');
    const totalSpan = this.shadowRoot.getElementById('orderTotal');

    if(qtySelect) {
        qtySelect.onchange = () => {
            const qty = parseInt(qtySelect.value);
            totalSpan.textContent = (finalPrice * qty).toFixed(2);
        };
    }

    this.shadowRoot.getElementById('btnConfirm').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);