class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.upsellItem = null;
    this.hasUpsell = false;
    this.currentPrice = 0;
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

  // Logic to determine if this is racing gear based on the item name
  isRacingGear(item) {
    const name = item.name.toLowerCase();
    return (
      name.includes('race') ||
      name.includes('world cup') ||
      name.includes('comp')
    );
  }

  // Logic to generate a matching upsell based on user history/style
  generateUpsell(mainItem) {
    // Default Upsell
    let upsell = {
      id: 'UPSELL-ACC-001',
      name: 'Pro-Grip Carbon Poles (Neon Edition)',
      sku: 'POLE-NEON-X',
      cost: 80, // Base cost
    };

    // If buying skis, suggest bindings or poles
    if (
      mainItem.name.toLowerCase().includes('ski') ||
      mainItem.name.toLowerCase().includes('racer')
    ) {
      upsell = {
        id: 'UPSELL-BIND-002',
        name: 'Gold-Plated Pivot Bindings 18',
        sku: 'BIND-GOLD-VIP',
        cost: 200, // Expensive
        desc: 'Matches your flashy style perfectly.',
      };
    }

    return upsell;
  }

  loadItem(item) {
    this.selectedItem = item;
    this.hasUpsell = false; // Reset

    // 1. Pricing Strategy Logic
    // Racing gear = 120% COGS, Others = Standard (150% implied by original code)
    const isRace = this.isRacingGear(item);
    const markup = isRace ? 1.2 : 1.5;
    this.currentPrice = item.cost * markup;

    // 2. Upsell Logic
    this.upsellItem = this.generateUpsell(item);
    const upsellPrice = this.upsellItem.cost * 1.5; // Standard markup on accessories

    // 3. Render DOM updates
    const root = this.shadowRoot;

    // Header Info
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;

    // Price Display
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${this.currentPrice.toFixed(2)}`;

    // Sales Blowout Badge
    const badge = root.getElementById('saleBadge');
    if (isRace) {
      badge.style.display = 'inline-block';
      badge.textContent = '🔥 RACING BLOWOUT DEAL';
      priceEl.style.color = '#d35400';
    } else {
      badge.style.display = 'none';
      priceEl.style.color = '#e74c3c';
    }

    // Upsell Section
    const upsellContainer = root.getElementById('upsellContainer');
    const upsellName = root.getElementById('upsellName');
    const upsellPriceEl = root.getElementById('upsellPrice');

    if (upsellContainer) {
      upsellName.textContent = this.upsellItem.name;
      upsellPriceEl.textContent = `$${upsellPrice.toFixed(2)}`;
      // Show container
      upsellContainer.classList.remove('hidden');
      // Reset checkbox
      root.getElementById('upsellCheck').checked = false;
    }

    this.updateTotal();
  }

  updateTotal() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    let total = this.currentPrice * qty;

    // Check Upsell
    const upsellCheck = root.getElementById('upsellCheck');
    if (upsellCheck && upsellCheck.checked) {
      this.hasUpsell = true;
      total += this.upsellItem.cost * 1.5;
    } else {
      this.hasUpsell = false;
    }

    root.getElementById('orderTotal').textContent = total.toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.innerHTML = '⚡ Processing VIP Order...';

    // Construct Payload
    const items = [
      {
        skuId: this.selectedItem.id,
        quantity: qty,
        price: this.currentPrice,
      },
    ];

    // Add Upsell if selected
    if (this.hasUpsell) {
      items.push({
        skuId: this.upsellItem.id,
        quantity: 1,
        price: this.upsellItem.cost * 1.5,
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
        // Impulse buyer instant gratification message
        alert(
          `🎉 VIP ORDER CONFIRMED! \n\nGet ready to shred! Your ${this.selectedItem.name} is on the way.`
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
      btn.innerHTML = '⚡ One-Click Buy';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
          <style>
              :host { 
                  display: block; 
                  animation: slideUp 0.4s ease-out; 
                  font-family: 'Segoe UI', sans-serif; 
              }
              
              /* Container styled for "Flashy" persona */
              .card { 
                  background: linear-gradient(135deg, #ffffff 0%, #f9f9f9 100%);
                  padding: 25px; 
                  border-radius: 12px; 
                  box-shadow: 0 10px 25px rgba(0,0,0,0.15); 
                  max-width: 500px; 
                  margin: 0 auto; 
                  text-align: left;
                  border: 2px solid #f1c40f; /* Gold Border for VIP feel */
              }
  
              h2 { text-align: center; color: #2c3e50; text-transform: uppercase; letter-spacing: 1px; }
              
              h3 { margin: 0; color: #2c3e50; font-size: 1.5rem; }
              
              .sku { color: #7f8c8d; font-size: 0.85rem; font-family: monospace; }
              
              .price-container { margin: 15px 0; }
              .price { font-size: 1.8rem; font-weight: 800; }
              
              .sale-badge {
                  background: #e74c3c;
                  color: white;
                  padding: 4px 8px;
                  border-radius: 4px;
                  font-size: 0.8rem;
                  font-weight: bold;
                  text-transform: uppercase;
                  vertical-align: middle;
                  margin-left: 10px;
                  display: none; /* Toggled in JS */
              }
  
              /* CALGARY BANNER */
              .vip-banner {
                  background: #27ae60;
                  color: white;
                  text-align: center;
                  padding: 8px;
                  border-radius: 6px;
                  font-weight: bold;
                  margin-bottom: 20px;
                  font-size: 0.9rem;
                  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              }
  
              /* UPSELL BOX */
              .upsell-box {
                  background: #fff3cd;
                  border: 1px solid #ffeeba;
                  padding: 15px;
                  border-radius: 8px;
                  margin: 15px 0;
                  animation: fadeIn 0.5s;
              }
              .upsell-header { font-weight: bold; color: #856404; display: flex; justify-content: space-between; align-items: center; }
              .upsell-item { font-size: 0.95rem; margin-top: 5px; color: #333; }
              .upsell-row { display: flex; align-items: center; gap: 10px; margin-top: 5px; cursor: pointer; }
              input[type="checkbox"] { transform: scale(1.5); accent-color: #d35400; }
  
              /* CONTROLS */
              label { font-weight: bold; display: block; margin-bottom: 5px; }
              select { 
                  width: 100%; 
                  padding: 12px; 
                  margin-bottom: 20px; 
                  border: 2px solid #bdc3c7; 
                  border-radius: 6px; 
                  font-size: 1rem;
                  background: white;
              }
  
              hr { border: 0; border-top: 1px solid #eee; margin: 20px 0; }
  
              /* PIXEL 6 OPTIMIZED BUTTONS */
              .btn-primary { 
                  background: linear-gradient(to right, #f39c12, #d35400); 
                  color: white; 
                  border: none; 
                  padding: 0;
                  height: 60px; /* Large touch target for Pixel 6 */
                  border-radius: 8px; 
                  cursor: pointer; 
                  width: 100%; 
                  font-size: 1.2rem; 
                  font-weight: bold;
                  text-transform: uppercase;
                  box-shadow: 0 4px 6px rgba(0,0,0,0.2);
                  transition: transform 0.1s, box-shadow 0.1s;
                  display: flex;
                  align-items: center;
                  justify-content: center;
              }
              .btn-primary:active { transform: translateY(2px); box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
              
              .cancel-btn { 
                  background: transparent; 
                  color: #7f8c8d; 
                  border: 2px solid #bdc3c7;
                  margin-top: 15px; 
                  height: 48px; /* Standard Android min touch target */
                  font-size: 1rem;
                  color: #555;
              }
              .cancel-btn:hover { background: #ecf0f1; }
  
              .hidden { display: none !important; }
  
              @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          </style>
  
          <h2>VIP Checkout</h2>
          
          <div class="card">
              <!-- Personalized Calgary Banner -->
              <div class="vip-banner">
                  🇨🇦 VIP MEMBER: Free Express Shipping to Calgary included!
              </div>
  
              <h3 id="orderItemName">Loading...</h3>
              <p class="sku">SKU: <span id="orderItemSku">...</span></p>
              
              <div class="price-container">
                  <span id="orderItemPrice" class="price">...</span>
                  <span id="saleBadge" class="sale-badge"></span>
              </div>
  
              <!-- Dynamic Upsell for the Impulse Buyer -->
              <div id="upsellContainer" class="upsell-box hidden">
                  <div class="upsell-header">
                      <span>✨ COMPLETE THE LOOK?</span>
                  </div>
                  <label class="upsell-row">
                      <input type="checkbox" id="upsellCheck">
                      <div>
                          <div class="upsell-item" id="upsellName"></div>
                          <div style="font-weight:bold; color:#d35400;" id="upsellPrice"></div>
                      </div>
                  </label>
              </div>
  
              <hr>
              
              <label>Quantity:</label>
              <select id="orderQty">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
              </select>
  
              <!-- Pixel 6 Styled "One-Click" Button -->
              <button id="btnConfirm" class="btn-primary">
                  ⚡ One-Click Buy ($<span id="orderTotal"></span>)
              </button>
              
              <button class="cancel-btn" id="btnCancel">Cancel</button>
          </div>
          `;

    this.shadowRoot.getElementById('btnConfirm').onclick = () =>
      this.submitOrder();

    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };

    const qtySelect = this.shadowRoot.getElementById('orderQty');
    qtySelect.onchange = () => this.updateTotal();

    const upsellCheck = this.shadowRoot.getElementById('upsellCheck');
    upsellCheck.onchange = () => this.updateTotal();
  }
}

customElements.define('order-page', OrderPage);
