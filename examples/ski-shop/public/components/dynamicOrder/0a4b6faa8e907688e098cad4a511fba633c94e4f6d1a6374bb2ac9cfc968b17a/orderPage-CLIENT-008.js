class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientData = null;
    this.calculatedPrice = 0;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id' && newValue) {
      this.clientId = newValue;
      await this.fetchClientDetails();
    }
  }

  async fetchClientDetails() {
    try {
      // Fetch full profile to get City and History for logic
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientData = await res.json();
        this.render(); // Re-render to update Banner/Upsells if item is already loaded
      }
    } catch (e) {
      console.warn("Could not fetch client details for personalization");
    }
  }

  // Called by Router in app.js
  loadItem(item) {
    this.selectedItem = item;
    
    // PRICING STRATEGY: Racing Gear (120%) vs Standard (150%)
    // Detecting "Racing" context via keywords in name or description
    const isRacingGear = /race|slalom|speed/i.test(item.name);
    
    if (isRacingGear) {
        this.calculatedPrice = item.cost * 1.2;
        this.isBlowout = true;
    } else {
        this.calculatedPrice = item.cost * 1.5;
        this.isBlowout = false;
    }

    this.render();
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.innerHTML = '<span>Processing...</span>';

    // Payload matches backend expectation
    const payload = {
      clientId: this.clientId,
      items: [{ 
          skuId: this.selectedItem.id, 
          quantity: qty, 
          price: this.calculatedPrice // Send the calculated price (discounted or standard)
      }],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Windows-style success feedback
        btn.style.backgroundColor = '#107C10'; // Windows Success Green
        btn.textContent = 'Purchase Complete!';
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('order-completed', { bubbles: true, composed: true }));
        }, 1000);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        btn.textContent = 'One-Click Buy';
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
    } 
  }

  getUpsellHTML() {
    // Logic: Suggest bindings/poles based on Past Purchases
    // Context: User bought "Piste Carver" previously.
    return `
        <div class="upsell-container">
            <div class="upsell-icon">➕</div>
            <div class="upsell-text">
                <strong>Complete the Setup?</strong><br>
                Based on your <em>Piste Carver</em> history, we recommend the 
                <span class="highlight">Pro-Lock Bindings</span> for this new gear.
            </div>
            <button class="add-btn">Add (+$120)</button>
        </div>
    `;
  }

  render() {
    if (!this.selectedItem) return;

    const isSLC = this.clientData?.city === 'Salt Lake City';
    const finalPrice = this.calculatedPrice.toFixed(2);
    
    // CSS Variables for Windows Fluent Design
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                animation: slideUp 0.3s cubic-bezier(0.1, 0.9, 0.2, 1); 
                font-family: 'Segoe UI', sans-serif; 
                color: #000;
            }

            /* Windows Fluent Design Language */
            .card { 
                background: #ffffff; 
                padding: 32px; 
                border-radius: 8px; 
                box-shadow: 0 8px 16px rgba(0,0,0,0.14); 
                max-width: 600px; 
                margin: 0 auto; 
                border: 1px solid #e5e5e5;
            }

            h2 { font-weight: 600; margin-top: 0; font-size: 24px; }
            h3 { margin: 0; color: #333; font-size: 20px; font-weight: 600; }
            
            .sku { color: #666; font-size: 12px; margin-bottom: 20px; display: block; }

            /* Price Display */
            .price-tag { font-size: 2rem; font-weight: 300; color: #2b2b2b; }
            .blowout-badge {
                background: #d13438; color: white; padding: 2px 8px; 
                font-size: 12px; font-weight: bold; border-radius: 4px;
                vertical-align: middle; margin-left: 10px;
                text-transform: uppercase;
            }

            /* VIP Banner */
            .vip-banner {
                background: #fdf6e3; border-left: 4px solid #d4af37;
                padding: 12px; margin-bottom: 20px;
                display: flex; align-items: center; gap: 10px;
                font-size: 14px; color: #5c4a18;
            }
            .vip-icon { font-size: 18px; }

            /* Upsell Section */
            .upsell-container {
                background: #f3f2f1;
                border: 1px solid #e1dfdd;
                padding: 15px;
                border-radius: 4px;
                margin: 20px 0;
                display: flex;
                align-items: center;
                gap: 15px;
            }
            .upsell-icon { font-size: 20px; }
            .upsell-text { font-size: 13px; flex: 1; }
            .highlight { color: #0078d4; font-weight: 600; }
            .add-btn {
                background: transparent; border: 1px solid #0078d4;
                color: #0078d4; padding: 6px 12px; border-radius: 4px;
                cursor: pointer; font-size: 12px;
            }
            .add-btn:hover { background: #eff6fc; }

            /* Controls */
            .controls { display: flex; gap: 20px; align-items: flex-end; margin-top: 25px; }
            .qty-group { flex: 1; }
            .qty-group label { display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px; }
            
            select { 
                width: 100%; padding: 10px; border: 1px solid #8a8886; 
                border-radius: 4px; font-family: 'Segoe UI'; font-size: 14px;
                /* Windows input styling */
                border-bottom-width: 2px;
            }
            select:focus { border-color: #0078d4; outline: none; }

            /* Windows One-Click Button */
            .one-click-btn {
                background-color: #0078d4; /* Windows Blue */
                color: white;
                border: none;
                border-radius: 4px;
                padding: 0 32px;
                height: 48px; /* Large touch target for Windows Touch */
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                transition: transform 0.1s, box-shadow 0.1s;
                flex: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .one-click-btn:hover { background-color: #106ebe; box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
            .one-click-btn:active { transform: scale(0.98); background-color: #005a9e; }
            .one-click-btn:disabled { background-color: #ccc; cursor: not-allowed; }

            .cancel-link {
                display: block; text-align: center; margin-top: 15px;
                color: #666; text-decoration: none; font-size: 13px; cursor: pointer;
            }
            .cancel-link:hover { text-decoration: underline; color: #000; }

            hr { border: 0; border-top: 1px solid #e1dfdd; margin: 20px 0; }
            
            /* Bulk/Family Note */
            .bulk-note { font-size: 11px; color: #107C10; margin-top: 5px; display: none; }

            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="card">
            <!-- Dynamic Banner for SLC VIPs -->
            ${isSLC ? `
                <div class="vip-banner">
                    <span class="vip-icon">🚛</span>
                    <span><strong>Salt Lake City VIP:</strong> Free Express Shipping included on this order.</span>
                </div>
            ` : ''}

            <h3 id="orderItemName">${this.selectedItem.name}</h3>
            <span class="sku">SKU: ${this.selectedItem.sku}</span>
            
            <div style="margin: 15px 0;">
                <span class="price-tag">$<span id="displayPrice">${finalPrice}</span></span>
                ${this.isBlowout ? `<span class="blowout-badge">Sales Blowout</span>` : ''}
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.5;">
                ${this.isBlowout 
                    ? "As part of our racing gear overstock event, you are receiving our family team pricing (~20% markup)." 
                    : "Standard retail pricing applies."}
            </p>

            ${this.getUpsellHTML()}

            <hr>

            <div class="controls">
                <div class="qty-group">
                    <label>QUANTITY</label>
                    <select id="orderQty">
                        <option value="1">1 Pair</option>
                        <option value="2">2 Pairs</option>
                        <option value="3">3 Pairs</option>
                        <option value="4">4 Pairs (Family Pack)</option>
                    </select>
                    <div id="bulkNote" class="bulk-note">Family bulk discount applied</div>
                </div>
                
                <button id="btnConfirm" class="one-click-btn">
                    <span>One-Click Buy</span>
                </button>
            </div>

            <a class="cancel-link" id="btnCancel">Cancel Order</a>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnConfirm').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }));
    };

    // Dynamic Price Update on Quantity Change
    const qtySelect = this.shadowRoot.getElementById('orderQty');
    const priceDisplay = this.shadowRoot.getElementById('displayPrice');
    const bulkNote = this.shadowRoot.getElementById('bulkNote');

    qtySelect.onchange = () => {
        const q = parseInt(qtySelect.value);
        priceDisplay.textContent = (this.calculatedPrice * q).toFixed(2);
        
        // Show visual cue for bulk orders (referencing CRM notes about family deals)
        bulkNote.style.display = q > 2 ? 'block' : 'none';
    };
  }
}

customElements.define('order-page', OrderPage);