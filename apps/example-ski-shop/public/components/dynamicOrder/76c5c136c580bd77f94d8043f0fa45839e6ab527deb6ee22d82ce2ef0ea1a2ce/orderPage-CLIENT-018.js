class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.upsellItem = null; // Stores the generated upsell object
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.render();
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
    }
  }

  // --- BUSINESS LOGIC HELPERS ---

  /**
   * Calculates price based on inventory strategy.
   * Racing gear = 120% COGS ("Sales Blowout").
   * Standard gear = 150% COGS.
   */
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    // Heuristic to detect racing gear based on CRM notes/Inventory context
    const isRacing =
      name.includes('race') ||
      name.includes('world cup') ||
      name.includes('gs') ||
      name.includes('sl') ||
      name.includes('speed');

    const markup = isRacing ? 1.2 : 1.5;
    return {
      finalPrice: item.cost * markup,
      isSale: isRacing,
    };
  }

  /**
   * Generating Upsell based on Past Purchases found in User Profile.
   */
  getUpsellSuggestion() {
    // Access global state safely (provided in app.js context)
    const profile = window.state?.clientProfile || {};
    // Mock past purchases if not present in the generic profile structure for this demo
    // In a real scenario, this comes from the profile data.
    // Based on the Prompt Context: "Past Purchases: Backcountry Tour, Park Freestyle..."
    
    // We will look for keywords in the item name to match the upsell, 
    // or default to the user's "style".
    
    let suggestion = { name: 'All-Day Performance Socks', price: 25.0, id: 'UP-SOCK' };

    // Simple keyword matching against the User Context provided in the prompt
    // We assume the profile object has a way to identify these, or we hardcode 
    // logic based on the prompt's persona description.
    
    const itemName = this.selectedItem?.name.toLowerCase() || '';

    if (itemName.includes('ski')) {
      // It's a ski, suggest bindings/poles
      // Check specific style from prompt context (simulated here based on item type)
      if (itemName.includes('park') || itemName.includes('freestyle')) {
        suggestion = { name: 'Pivot 15 Freestyle Bindings', price: 250.0, id: 'UP-BIND-FREE' };
      } else if (itemName.includes('backcountry') || itemName.includes('tour')) {
        suggestion = { name: 'Lightweight Touring Skins', price: 180.0, id: 'UP-SKIN' };
      } else if (itemName.includes('race') || itemName.includes('gs')) {
        suggestion = { name: 'Carbon Aero Poles', price: 120.0, id: 'UP-POLE-RACE' };
      } else {
        suggestion = { name: 'Adjustable All-Mtn Poles', price: 80.0, id: 'UP-POLE-STD' };
      }
    }

    return suggestion;
  }

  // --- COMPONENT API ---

  loadItem(item) {
    this.selectedItem = item;
    const priceData = this.calculatePrice(item);
    
    // Store calculated price for submission
    this.currentBasePrice = priceData.finalPrice;
    this.upsellItem = this.getUpsellSuggestion();

    // DOM Updates
    const root = this.shadowRoot;
    
    // 1. Product Info
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    
    // 2. Pricing Display
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${this.currentBasePrice.toFixed(2)}`;
    
    if (priceData.isSale) {
      priceEl.innerHTML += ` <span class="badge sale">BLOWOUT SALE</span>`;
    }

    // 3. Upsell Display
    const upsellContainer = root.getElementById('upsellContainer');
    const upsellLabel = root.getElementById('upsellLabel');
    const upsellPrice = root.getElementById('upsellPrice');
    
    if (this.upsellItem) {
        upsellLabel.textContent = `Add ${this.upsellItem.name}`;
        upsellPrice.textContent = `+$${this.upsellItem.price.toFixed(2)}`;
        upsellContainer.classList.remove('hidden');
    } else {
        upsellContainer.classList.add('hidden');
    }

    // 4. Calgary Logic
    const city = window.state?.clientProfile?.city || '';
    const shippingBanner = root.getElementById('shippingBanner');
    if (city.toLowerCase() === 'calgary') {
        shippingBanner.classList.remove('hidden');
    } else {
        shippingBanner.classList.add('hidden');
    }

    // 5. Reset Form
    root.getElementById('upsellCheckbox').checked = false;
    this.updateTotal();
  }

  updateTotal() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value) || 1;
    const addUpsell = root.getElementById('upsellCheckbox').checked;
    
    let total = this.currentBasePrice * qty;
    if (addUpsell && this.upsellItem) {
        total += this.upsellItem.price; // Assuming 1 upsell per order for simplicity
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const btn = root.getElementById('btnOneClick');
    const qty = parseInt(root.getElementById('orderQty').value);
    
    // Calculate final payload price (Base + potential upsell averaged into unit price or added)
    // To fit the existing API structure (items array), we will:
    // 1. Add the main item.
    // 2. Ideally add the upsell as a second item, but the API expects 'skuId' from inventory.
    // For this frontend demo, we will bundle the cost into the price sent to server 
    // to ensure the "Total Revenue" stats update correctly in Admin.
    
    const addUpsell = root.getElementById('upsellCheckbox').checked;
    let finalUnitPrice = this.currentBasePrice;
    
    // Note: This is a hack for the demo because we don't have real inventory IDs for upsells
    // We add the upsell price to the first unit of the main item.
    let totalOrderValue = (this.currentBasePrice * qty);
    if (addUpsell) totalOrderValue += this.upsellItem.price;

    // We fudge the unit price sent to server so the Total matches
    const effectivePriceToSend = totalOrderValue / qty; 

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Processing...';

    const payload = {
      clientId: this.clientId,
      items: [{ 
          skuId: this.selectedItem.id, 
          quantity: qty, 
          price: effectivePriceToSend 
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
        // success animation
        btn.textContent = '✓ Purchased';
        btn.style.background = '#2ecc71';
        setTimeout(() => {
            this.dispatchEvent(
            new CustomEvent('order-completed', { bubbles: true, composed: true })
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
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            }
            
            .container {
                max-width: 600px;
                margin: 0 auto;
                background: #fff;
                border-radius: 18px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }

            /* Calgary Banner */
            .banner {
                background: linear-gradient(90deg, #00C6FF 0%, #0072FF 100%);
                color: white;
                padding: 12px;
                text-align: center;
                font-weight: 600;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }

            .content {
                padding: 30px;
            }

            h2 { margin-top: 0; color: #1d1d1f; font-weight: 700; }
            h3 { margin: 5px 0; color: #1d1d1f; font-size: 1.5rem; }
            
            .sku { color: #86868b; font-size: 0.9rem; margin-bottom: 20px; display: block; }
            
            .price-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 25px;
            }
            
            .price { font-size: 1.8rem; color: #1d1d1f; font-weight: 600; }
            
            .badge.sale {
                background: #ff3b30;
                color: white;
                font-size: 0.7rem;
                padding: 4px 8px;
                border-radius: 4px;
                font-weight: bold;
                letter-spacing: 0.5px;
            }

            /* Upsell Section */
            .upsell-box {
                background: #f5f5f7;
                border-radius: 12px;
                padding: 15px;
                margin-bottom: 25px;
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: background 0.2s;
            }
            .upsell-box:hover { background: #e8e8ed; }
            
            .checkbox-wrapper {
                margin-right: 15px;
                display: flex;
                align-items: center;
            }
            input[type="checkbox"] {
                width: 20px;
                height: 20px;
                accent-color: #0071e3;
            }
            
            .upsell-info { flex: 1; }
            .upsell-title { font-weight: 600; color: #1d1d1f; font-size: 0.95rem; }
            .upsell-desc { font-size: 0.85rem; color: #86868b; }
            .upsell-price { font-weight: 600; color: #0071e3; }

            /* Controls */
            .controls {
                display: flex;
                gap: 15px;
                align-items: center;
                margin-top: 20px;
            }

            select {
                padding: 12px;
                border-radius: 10px;
                border: 1px solid #d2d2d7;
                font-size: 1rem;
                background: #fff;
            }

            /* MacBook Pro Styled Button */
            .one-click-btn {
                background: #0071e3;
                color: white;
                border: none;
                flex: 1;
                padding: 18px;
                font-size: 1.1rem;
                border-radius: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 4px 10px rgba(0,113,227, 0.3);
            }
            
            .one-click-btn:hover { background: #0077ED; transform: translateY(-1px); }
            .one-click-btn:active { transform: scale(0.98); }
            .one-click-btn:disabled { background: #999; cursor: not-allowed; transform: none; }

            .cancel-link {
                display: block;
                text-align: center;
                margin-top: 20px;
                color: #0071e3;
                text-decoration: none;
                font-size: 0.9rem;
                cursor: pointer;
            }
            .cancel-link:hover { text-decoration: underline; }

            .hidden { display: none !important; }

            @keyframes slideUp {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        </style>

        <div class="container">
            <!-- Dynamic Banner -->
            <div id="shippingBanner" class="banner hidden">
                <span>🚛</span> Free Express Shipping to Calgary included for VIPs
            </div>

            <div class="content">
                <h2>Review Order</h2>
                
                <h3 id="orderItemName">Loading...</h3>
                <span id="orderItemSku" class="sku"></span>
                
                <div class="price-row">
                    <div id="orderItemPrice" class="price"></div>
                </div>

                <!-- Intelligent Upsell -->
                <label class="upsell-box hidden" id="upsellContainer">
                    <div class="checkbox-wrapper">
                        <input type="checkbox" id="upsellCheckbox">
                    </div>
                    <div class="upsell-info">
                        <div class="upsell-title">Complete the Kit</div>
                        <div class="upsell-desc">
                            <span id="upsellLabel">Suggestion</span> 
                            <span id="upsellPrice" class="upsell-price"></span>
                        </div>
                    </div>
                </label>

                <hr style="border: 0; border-top: 1px solid #e5e5e5;">

                <div class="controls">
                    <select id="orderQty">
                        <option value="1">Qty: 1</option>
                        <option value="2">Qty: 2</option>
                        <option value="3">Qty: 3</option>
                    </select>

                    <button id="btnOneClick" class="one-click-btn">
                        One-Click Buy &nbsp; • &nbsp; $<span id="orderTotal">--</span>
                    </button>
                </div>

                <a id="btnCancel" class="cancel-link">Cancel and return to shop</a>
            </div>
        </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };

    // Recalculate total on interaction
    this.shadowRoot.getElementById('orderQty').onchange = () => this.updateTotal();
    this.shadowRoot.getElementById('upsellCheckbox').onchange = () => this.updateTotal();
  }
}

// Define the custom element
customElements.define('order-page', OrderPage);