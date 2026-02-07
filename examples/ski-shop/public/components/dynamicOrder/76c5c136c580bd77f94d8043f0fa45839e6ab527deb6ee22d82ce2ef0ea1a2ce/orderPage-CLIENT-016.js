class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientData = null;
    this.currentPrice = 0;
    this.upsellItem = null;
    this.hasUpsellSelected = false;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.fetchClientData();
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.fetchClientData();
    }
  }

  async fetchClientData() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientData = await res.json();
        // Re-render to show/hide location specific banners
        this.render();
        // If we already have an item loaded, re-populate to ensure state consistency
        if (this.selectedItem) this.populateData();
      }
    } catch (e) {
      console.error("Could not fetch client data", e);
    }
  }

  // Logic to determine pricing and upsells based on Item Type & User Persona
  loadItem(item) {
    this.selectedItem = item;
    const lowerName = item.name.toLowerCase();
    
    // --- Pricing Strategy: "Sales Blowout" ---
    // Racing gear is 120% COGS, others are Standard 150%
    const isRacing = lowerName.includes('race') || lowerName.includes('cup') || lowerName.includes('piste');
    const markup = isRacing ? 1.2 : 1.5;
    this.currentPrice = item.cost * markup;

    // --- Upsell Logic based on Past Purchases & Usage ---
    // User destroys gear (Rugged) and likes Racing.
    if (isRacing) {
      this.upsellItem = {
        name: "Carbon World Cup Poles",
        description: "Ultra-light, high-stability for racing.",
        price: 120.00,
        id: "UPSELL-POLE-001"
      };
    } else {
      // For Powder/Mountain/Rough usage
      this.upsellItem = {
        name: "Titanium 'Indestructible' Bindings",
        description: "Rugged construction for heavy usage.",
        price: 250.00,
        id: "UPSELL-BINDING-002"
      };
    }

    this.hasUpsellSelected = false;
    this.populateData();
  }

  populateData() {
    const root = this.shadowRoot;
    if (!root.getElementById('orderItemName')) return; // Guard if render hasn't happened

    // Basic Item Info
    root.getElementById('orderItemName').textContent = this.selectedItem.name;
    root.getElementById('orderItemSku').textContent = this.selectedItem.sku;
    
    // Price Display
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${this.currentPrice.toFixed(2)}`;
    
    // Sale Badge Logic
    const isSale = this.selectedItem.name.toLowerCase().includes('race') || this.selectedItem.name.toLowerCase().includes('cup');
    root.getElementById('saleBadge').style.display = isSale ? 'inline-block' : 'none';

    // Upsell Section
    const upsellContainer = root.getElementById('upsellContainer');
    const upsellName = root.getElementById('upsellName');
    const upsellDesc = root.getElementById('upsellDesc');
    const upsellPrice = root.getElementById('upsellPrice');
    const upsellCheckbox = root.getElementById('upsellCheckbox');

    if (this.upsellItem) {
      upsellContainer.style.display = 'block';
      upsellName.textContent = this.upsellItem.name;
      upsellDesc.textContent = this.upsellItem.description;
      upsellPrice.textContent = `+$${this.upsellItem.price.toFixed(2)}`;
      upsellCheckbox.checked = false;
      upsellCheckbox.onclick = () => {
        this.hasUpsellSelected = upsellCheckbox.checked;
        this.updateTotal();
      };
    } else {
      upsellContainer.style.display = 'none';
    }

    this.updateTotal();
  }

  updateTotal() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value) || 1;
    let total = this.currentPrice * qty;

    if (this.hasUpsellSelected && this.upsellItem) {
      total += this.upsellItem.price; // Assuming 1 upsell per order for simplicity
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
    
    // Update Button Text for "One-Click" feel
    root.getElementById('btnConfirm').textContent = `PAY $${total.toFixed(2)} NOW`;
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.textContent = 'Processing Payment...';

    // Build payload
    const items = [
      { 
        skuId: this.selectedItem.id, 
        quantity: qty, 
        price: this.currentPrice // Send the calculated discounted/standard price
      }
    ];

    // Add upsell to payload if selected
    if (this.hasUpsellSelected && this.upsellItem) {
      items.push({
        skuId: this.upsellItem.id,
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
        // Windows Desktop Style Success Notification
        btn.style.background = '#27ae60';
        btn.textContent = 'Purchase Complete';
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('order-completed', { bubbles: true, composed: true }));
        }, 1000);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        this.updateTotal(); // Reset text
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      this.updateTotal();
    }
  }

  render() {
    // Check if client is from Banff for the Banner
    const isBanff = this.clientData && this.clientData.city === 'Banff';

    this.shadowRoot.innerHTML = `
      <style>
        :host { 
          display: block; 
          animation: slideUp 0.4s ease-out; 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          color: #333;
        }

        /* Layout */
        .order-container {
          max-width: 600px;
          margin: 0 auto;
          background: #ffffff;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          border: 1px solid #e0e0e0;
        }

        /* Banner Logic */
        .vip-banner {
          background: #2c3e50; /* Dark VIP color */
          color: #f1c40f; /* Gold text */
          padding: 12px;
          text-align: center;
          font-weight: bold;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        /* Product Header */
        .header {
          padding: 25px;
          background: #f9f9f9;
          border-bottom: 1px solid #eee;
        }
        h2 { margin: 0 0 5px 0; font-size: 1.8rem; color: #2c3e50; }
        .sku { color: #7f8c8d; font-size: 0.85rem; font-family: 'Consolas', monospace; }
        
        .price-tag {
          font-size: 2rem;
          color: #2c3e50;
          font-weight: 300;
          margin-top: 10px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .sale-badge {
          background: #e74c3c;
          color: white;
          font-size: 0.8rem;
          padding: 2px 8px;
          border-radius: 2px;
          font-weight: bold;
          text-transform: uppercase;
        }

        /* Content Area */
        .content { padding: 25px; }

        /* Upsell Box - Rugged/Technical Look */
        .upsell-box {
          border: 2px solid #3498db;
          background: #ebf5fb;
          padding: 15px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .upsell-info h4 { margin: 0; color: #2980b9; }
        .upsell-info p { margin: 5px 0 0 0; font-size: 0.85rem; color: #555; }
        .upsell-price { font-weight: bold; color: #2c3e50; }
        
        /* Windows Desktop Touch Target Inputs */
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        select {
          width: 100%;
          padding: 12px;
          font-size: 1rem;
          border: 2px solid #ccc;
          margin-bottom: 20px;
          background: white;
        }
        select:focus { border-color: #0078D7; outline: none; }

        /* Windows "One-Click" Button Style */
        .btn-primary {
          background: #0078D7; /* Windows Blue */
          color: white;
          border: none;
          padding: 18px;
          width: 100%;
          font-size: 1.2rem;
          font-weight: 600;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s;
          /* Sharp corners for Windows Metro/Fluent feel or slightly rounded */
          border-radius: 2px; 
        }
        .btn-primary:hover { background: #005a9e; }
        .btn-primary:disabled { background: #ccc; cursor: not-allowed; }

        .btn-cancel {
          background: transparent;
          color: #7f8c8d;
          border: none;
          width: 100%;
          padding: 15px;
          cursor: pointer;
          margin-top: 10px;
        }
        .btn-cancel:hover { text-decoration: underline; color: #333; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>

      <div class="order-container">
        ${isBanff ? `
          <div class="vip-banner">
            <span>🏔️ VIP MEMBER: Free Express Shipping to Banff included.</span>
          </div>
        ` : ''}

        <div class="header">
          <h2 id="orderItemName">Loading...</h2>
          <div class="sku">SKU: <span id="orderItemSku">...</span></div>
          <div class="price-tag">
            <span id="orderItemPrice">...</span>
            <span id="saleBadge" class="sale-badge" style="display:none">Racing Blowout</span>
          </div>
        </div>

        <div class="content">
          <!-- Upsell Section -->
          <div id="upsellContainer" class="upsell-box" style="display:none">
            <input type="checkbox" id="upsellCheckbox" style="transform: scale(1.5);">
            <div class="upsell-info">
              <h4>Recommended: <span id="upsellName"></span></h4>
              <p id="upsellDesc"></p>
              <div class="upsell-price" id="upsellPrice"></div>
            </div>
          </div>

          <label>Quantity</label>
          <select id="orderQty" onchange="this.getRootNode().host.updateTotal()">
            <option value="1">1 Pair</option>
            <option value="2">2 Pairs</option>
            <option value="3">3 Pairs (Team Pack)</option>
          </select>

          <button id="btnConfirm" class="btn-primary" onclick="this.getRootNode().host.submitOrder()">
            Calculate Total
          </button>
          
          <button id="btnCancel" class="btn-cancel" onclick="this.getRootNode().host.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }))">
            Cancel Order
          </button>
        </div>
        
        <div style="text-align:center; padding: 10px; background:#eee; font-size:0.8rem; color:#777;">
           Secure Checkout • Windows Encrypted
           <br><span style="font-size:0.7rem">Total: $<span id="orderTotal">0.00</span></span>
        </div>
      </div>
    `;
  }
}

customElements.define('order-page', OrderPage);