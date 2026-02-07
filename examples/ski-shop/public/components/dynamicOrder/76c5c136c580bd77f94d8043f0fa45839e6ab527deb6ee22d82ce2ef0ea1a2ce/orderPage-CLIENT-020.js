class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientData = null;
    this.upsellItem = null;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.fetchClientData();
    }
  }

  connectedCallback() {
    this.render();
  }

  // Fetch client data to determine City (Banff) and Past Purchases
  async fetchClientData() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        this.clientData = await res.json();
        // Re-render if item is already loaded to update dynamic sections
        if (this.selectedItem) this.updateDynamicUI();
      }
    } catch (e) {
      console.error("Failed to fetch client context", e);
    }
  }

  // Public method called by Router
  loadItem(item) {
    this.selectedItem = item;
    this.updateDynamicUI();
  }

  updateDynamicUI() {
    if (!this.selectedItem) return;

    const root = this.shadowRoot;
    
    // --- PRICING LOGIC ---
    // Constraint: Racing gear (Nordic/Cross-country) @ 120% COGS ("Sales Blowout")
    // Others @ 150% COGS
    const isRacing = this.checkIfRacing(this.selectedItem);
    const markup = isRacing ? 1.2 : 1.5;
    const finalPrice = (this.selectedItem.cost * markup).toFixed(2);
    
    // --- BANNER LOGIC ---
    // Constraint: "Free Express Shipping to Banff"
    const isBanff = this.clientData?.city === 'Banff';
    const banner = root.getElementById('banffBanner');
    if (isBanff) {
      banner.style.display = 'block';
    } else {
      banner.style.display = 'none';
    }

    // --- UPSELL LOGIC ---
    // Suggest bindings/poles based on Past Purchases.
    // Logic: If buying Skis, suggest matching bindings.
    const upsellContainer = root.getElementById('upsellContainer');
    upsellContainer.innerHTML = ''; // Clear previous
    this.upsellItem = null;

    // Simple heuristic: If item name contains "Ski", offer upsell
    if (this.selectedItem.name.toLowerCase().includes('ski')) {
        this.upsellItem = this.determineUpsellItem(isRacing);
        if (this.upsellItem) {
            upsellContainer.innerHTML = `
                <div class="upsell-box">
                    <label>
                        <input type="checkbox" id="upsellCheck">
                        <strong>Add Matching Gear:</strong> ${this.upsellItem.name} (+$${this.upsellItem.price})
                    </label>
                    <p class="upsell-note">Selected based on your purchase history.</p>
                </div>
            `;
            
            // Add listener to update total
            const check = upsellContainer.querySelector('#upsellCheck');
            check.addEventListener('change', () => {
                this.updateTotal(finalPrice);
            });
        }
    }

    // --- RENDER DOM ELEMENTS ---
    root.getElementById('orderItemName').textContent = this.selectedItem.name;
    root.getElementById('orderItemSku').textContent = this.selectedItem.sku;
    
    // Highlight Sale Price
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${finalPrice}`;
    if (isRacing) {
        priceEl.classList.add('sale-price');
        root.getElementById('priceLabel').innerHTML = '<span class="sale-tag">BLOWOUT SALE</span> Price:';
    } else {
        priceEl.classList.remove('sale-price');
        root.getElementById('priceLabel').textContent = 'Price:';
    }

    // Reset Qty
    root.getElementById('orderQty').value = '1';
    this.updateTotal(finalPrice);
  }

  // Heuristic to detect Racing/Nordic gear based on CRM notes
  checkIfRacing(item) {
      const name = item.name.toLowerCase();
      // Keywords derived from User Profile "Cross-country" and "lightest possible"
      return name.includes('race') || name.includes('nordic') || name.includes('carbon') || name.includes('lite');
  }

  // Select upsell based on past purchase history context
  determineUpsellItem(isRacingItem) {
      // If current item is a Racing Ski, suggest lightweight poles (CRM requirement)
      if (isRacingItem) {
          return { id: 'UP-POLE-01', name: 'Carbon Race Poles', price: 120.00 };
      }
      
      // Fallback: Check past purchases for style
      const history = this.clientData?.pastPurchases || [];
      const hasPark = history.some(p => p.includes('Freestyle') || p.includes('Park'));
      
      if (hasPark) {
          return { id: 'UP-BIND-02', name: 'Pivot 15 Bindings', price: 250.00 };
      }
      
      // Default
      return { id: 'UP-WAX-01', name: 'Performance Wax Kit', price: 45.00 };
  }

  updateTotal(baseItemPrice) {
      const root = this.shadowRoot;
      const qty = parseInt(root.getElementById('orderQty').value);
      let total = parseFloat(baseItemPrice) * qty;

      // Add upsell price if checked
      const check = root.getElementById('upsellCheck');
      if (check && check.checked && this.upsellItem) {
          total += this.upsellItem.price;
      }

      root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const btn = root.getElementById('btnOneClick');
    
    // Visual Feedback
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processing...`;

    // Calculate Final Item Price (needs to be sent to backend)
    const isRacing = this.checkIfRacing(this.selectedItem);
    const itemPrice = this.selectedItem.cost * (isRacing ? 1.2 : 1.5);
    const qty = parseInt(root.getElementById('orderQty').value);

    // Build Items Array
    const items = [{ 
        skuId: this.selectedItem.id, 
        quantity: qty, 
        price: itemPrice 
    }];

    // Add upsell if selected
    const check = root.getElementById('upsellCheck');
    if (check && check.checked && this.upsellItem) {
        // Note: In a real app, upsellItem needs a real ID from inventory. 
        // We are mocking the ID here as per the presentation logic task.
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
        // Success Animation/Feedback
        btn.style.background = '#107c10'; // Windows Success Green
        btn.innerHTML = 'Order Placed!';
        setTimeout(() => {
            this.dispatchEvent(new CustomEvent('order-completed', { bubbles: true, composed: true }));
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
                animation: slideUp 0.4s ease-out; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            /* Windows Desktop / Fluent Design influences */
            .card { 
                background: #ffffff; 
                padding: 32px; 
                border-radius: 4px; 
                box-shadow: 0 8px 16px rgba(0,0,0,0.14); 
                max-width: 480px; 
                margin: 20px auto; 
                border: 1px solid #e1dfdd;
            }

            h2 { font-weight: 600; color: #323130; margin-bottom: 20px; }
            h3 { margin: 0; color: #201f1e; font-size: 1.5rem; }
            
            .sku { color: #605e5c; font-size: 0.9rem; margin-bottom: 15px; display: block; }
            
            .price-container { font-size: 1.5rem; margin: 20px 0; display: flex; align-items: baseline; gap: 10px; }
            .price { color: #323130; font-weight: 600; }
            .sale-price { color: #d13438; } /* Windows Error/Alert Red used for sales */
            .sale-tag { 
                background: #d13438; 
                color: white; 
                font-size: 0.7rem; 
                padding: 2px 6px; 
                border-radius: 2px; 
                vertical-align: middle;
                margin-right: 5px;
            }

            /* Inputs */
            label { font-weight: 600; color: #323130; display: block; margin-bottom: 5px; }
            select { 
                width: 100%; 
                padding: 10px; 
                border: 1px solid #8a8886; 
                border-radius: 2px; 
                font-family: inherit;
                font-size: 1rem;
                margin-bottom: 20px;
            }
            select:focus { outline: 2px solid #0078d4; border-color: transparent; }

            /* Upsell Box */
            .upsell-box {
                background: #f3f2f1;
                border: 1px solid #e1dfdd;
                padding: 15px;
                margin-bottom: 20px;
                border-radius: 2px;
            }
            .upsell-box label { display: flex; align-items: center; cursor: pointer; margin: 0; }
            .upsell-box input { width: 20px; height: 20px; margin-right: 10px; }
            .upsell-note { margin: 5px 0 0 30px; font-size: 0.85rem; color: #605e5c; font-style: italic; }

            /* Banner */
            #banffBanner {
                background: #0078d4; /* Windows Blue */
                color: white;
                padding: 12px;
                text-align: center;
                font-weight: 600;
                border-radius: 4px;
                margin-bottom: 15px;
                display: none;
                box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }

            /* One-Click Button */
            #btnOneClick {
                background: #0078d4;
                color: white;
                border: none;
                padding: 0;
                border-radius: 2px;
                cursor: pointer;
                width: 100%;
                font-size: 1.1rem;
                font-weight: 600;
                height: 52px; /* Large touch target for Windows touch */
                transition: background 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #btnOneClick:hover { background: #106ebe; }
            #btnOneClick:active { background: #005a9e; }
            #btnOneClick:disabled { background: #c8c6c4; color: #edebe9; cursor: not-allowed; }

            .cancel-btn {
                background: transparent;
                color: #0078d4;
                border: 1px solid transparent;
                margin-top: 15px;
                padding: 10px;
                width: 100%;
                cursor: pointer;
            }
            .cancel-btn:hover { text-decoration: underline; }

            .summary { 
                margin-top: 5px; 
                font-size: 0.9rem; 
                text-align: right; 
                color: #605e5c; 
            }

            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>

        <div class="card">
            <div id="banffBanner">📦 VIP: Free Express Shipping to Banff</div>

            <h3 id="orderItemName">Loading...</h3>
            <span class="sku">SKU: <span id="orderItemSku">-</span></span>
            
            <div class="price-container">
                <span id="priceLabel">Price:</span>
                <span id="orderItemPrice" class="price">-</span>
            </div>
            
            <label for="orderQty">Quantity</label>
            <select id="orderQty">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
            </select>

            <div id="upsellContainer"></div>

            <button id="btnOneClick">One-Click Buy ($<span id="orderTotal">0.00</span>)</button>
            <div class="summary">Secure Checkout via Edge • Windows Hello Ready</div>
            
            <button class="cancel-btn" id="btnCancel">Cancel Order</button>
        </div>
        `;

    // Event Binding
    this.shadowRoot.getElementById('orderQty').onchange = () => {
        // Recalculate based on current state (needs correct price reference)
        const isRacing = this.checkIfRacing(this.selectedItem);
        const price = (this.selectedItem.cost * (isRacing ? 1.2 : 1.5)).toFixed(2);
        this.updateTotal(price);
    };
    
    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);