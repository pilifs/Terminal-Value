class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;

    // Bind methods
    this.submitOrder = this.submitOrder.bind(this);
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      // Re-render if client changes to update location-based logic
      if (this.selectedItem) this.render();
    }
  }

  /**
   * Main logic to load product data and apply pricing strategies
   * based on the context provided.
   */
  loadItem(item) {
    this.selectedItem = item;

    // --- PRICING STRATEGY ---
    // Context: Racing gear is overstocked ("Sales Blowout").
    // Constraint: Racing gear @ 120% COGS, others @ 150% (Standard).
    // Identification: Look for "Racer", "World Cup", "Competition" keywords.
    const isRacingGear = /racer|world cup|competition/i.test(item.name);
    const markup = isRacingGear ? 1.2 : 1.5;
    const finalPrice = (item.cost * markup).toFixed(2);

    // Update State
    this.selectedItem.finalPrice = finalPrice;
    this.selectedItem.isRacingGear = isRacingGear;

    // --- DOM UPDATES ---
    const root = this.shadowRoot;

    // Text Content
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    root.getElementById('orderItemPrice').textContent = `$${finalPrice}`;
    root.getElementById('orderTotal').textContent = finalPrice;

    // Pricing Badge
    const badge = root.getElementById('priceBadge');
    if (isRacingGear) {
      badge.textContent = '🔥 SALES BLOWOUT';
      badge.className = 'badge sale';
    } else {
      badge.textContent = 'Standard Price';
      badge.className = 'badge standard';
    }

    // --- UPSELL LOGIC ---
    // Context: Transitions from slope to apres-ski. Past purchases: Racing gear.
    // Logic: If buying Skis, upsell bindings/poles matching "World Cup/Racer" style.
    const upsellContainer = root.getElementById('upsellContainer');
    upsellContainer.innerHTML = ''; // Clear previous

    if (item.name.toLowerCase().includes('ski')) {
      upsellContainer.innerHTML = `
        <div class="upsell-box">
          <strong>Recommended for your style:</strong>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
            <span>Carbon Race Bindings (Pro)</span>
            <button class="add-upsell-btn">+ Add ($120.00)</button>
          </div>
          <small style="color:#666;">Matches your <em>World Cup Racer</em> profile.</small>
        </div>
      `;
      // Logic to actually add to order would go here, omitting for visual-only task
    }

    // Qty Logic
    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';
    qtySelect.onchange = () => {
      root.getElementById('orderTotal').textContent = (
        finalPrice * qtySelect.value
      ).toFixed(2);
    };
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const btn = root.getElementById('btnOneClick');
    const qty = parseInt(root.getElementById('orderQty').value);

    // UX: Immediate feedback
    btn.disabled = true;
    btn.innerHTML = `<span>Processing...</span>`;

    const payload = {
      clientId: this.clientId,
      items: [
        {
          skuId: this.selectedItem.id,
          quantity: qty,
          price: parseFloat(this.selectedItem.finalPrice),
        },
      ],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Windows-style success state
        btn.style.backgroundColor = '#107C10'; // Windows Success Green
        btn.innerHTML = `<span>✓ Purchase Complete</span>`;

        setTimeout(() => {
          this.dispatchEvent(
            new CustomEvent('order-completed', {
              bubbles: true,
              composed: true,
            })
          );
        }, 1000);
      } else {
        alert('Error: ' + data.error);
        btn.disabled = false;
        btn.textContent = '1-Click Buy';
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      btn.textContent = '1-Click Buy';
    }
  }

  render() {
    // Access global state to check Client Profile location
    // Note: In a real app, we might fetch this internally, but app.js provides global state.
    const clientProfile = window.state?.clientProfile || {};
    const city = clientProfile.city || '';
    const isVancouver = city.toLowerCase() === 'vancouver';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: 'Segoe UI', 'Segoe WP', Tahoma, Arial, sans-serif;
          animation: slideUp 0.4s ease-out;
          color: #1a1a1a;
        }

        /* Layout Container */
        .order-card {
          background: #ffffff;
          border: 1px solid #e5e5e5;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          max-width: 550px;
          margin: 0 auto;
          position: relative;
          overflow: hidden;
        }

        /* Banner Styles */
        .banner {
          padding: 12px 20px;
          font-weight: 600;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .banner.vip {
          background-color: #dff6dd;
          color: #107c10;
          border-left: 5px solid #107c10;
        }

        /* Content Padding */
        .content {
          padding: 30px;
        }

        /* Typography */
        h2 { margin-top: 0; font-weight: 300; font-size: 1.8rem; margin-bottom: 20px; }
        h3 { margin: 0; font-size: 1.4rem; color: #000; }
        
        .sku { color: #666; font-size: 0.9rem; margin-top: 4px; display: block; }
        
        .price-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 20px 0;
        }
        .price { font-size: 2rem; font-weight: bold; color: #2b2b2b; }
        
        /* Badges */
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; }
        .badge.sale { background: #e81123; color: white; }
        .badge.standard { background: #f2f2f2; color: #666; }

        /* Form Elements */
        .form-group { margin-bottom: 25px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        select { 
          width: 100%; 
          padding: 10px; 
          font-size: 1rem; 
          border: 2px solid #ccc; /* Thicker border for touch */
          border-radius: 0; /* Windows Metro style */
        }
        select:focus { border-color: #0078d7; outline: none; }

        /* Upsell Area */
        .upsell-box {
          background: #f0f6ff;
          border: 1px dashed #0078d7;
          padding: 15px;
          margin-bottom: 25px;
        }
        .add-upsell-btn {
          background: transparent;
          border: 1px solid #0078d7;
          color: #0078d7;
          cursor: pointer;
          padding: 5px 10px;
          font-weight: bold;
        }
        .add-upsell-btn:hover { background: #0078d7; color: white; }

        /* Windows Desktop Touch Targets */
        .actions {
          display: grid;
          gap: 15px;
        }
        
        button.primary-btn {
          background-color: #0078d7; /* Windows Blue */
          color: white;
          border: none;
          /* Large touch target */
          padding: 18px 24px; 
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          /* Metro style */
          border-radius: 2px; 
          box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        button.primary-btn:hover {
          background-color: #005a9e;
          transform: translateY(-1px);
        }
        button.primary-btn:active {
          transform: translateY(1px);
        }
        
        button.secondary-btn {
          background: transparent;
          border: 2px solid #ccc;
          color: #333;
          padding: 15px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }
        button.secondary-btn:hover {
          border-color: #999;
          background-color: #f2f2f2;
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>

      <div class="order-card">
        <!-- Conditional Banner for Vancouver -->
        ${
          isVancouver
            ? `
          <div class="banner vip">
            <span>🚛</span>
            <span>Free Express Shipping to Vancouver included for our VIP members.</span>
          </div>
        `
            : ''
        }

        <div class="content">
          <h2>Review & Buy</h2>
          
          <div class="product-header">
            <h3 id="orderItemName">Loading...</h3>
            <span class="sku">SKU: <span id="orderItemSku">...</span></span>
          </div>

          <div class="price-row">
            <div id="orderItemPrice" class="price">$0.00</div>
            <div id="priceBadge" class="badge standard">Standard Price</div>
          </div>

          <!-- Dynamic Upsell Section -->
          <div id="upsellContainer"></div>

          <div class="form-group">
            <label for="orderQty">Quantity</label>
            <select id="orderQty">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>

          <div class="actions">
            <!-- Windows Touch Style Button -->
            <button id="btnOneClick" class="primary-btn">
              1-Click Buy — $<span id="orderTotal">0.00</span>
            </button>
            <button id="btnCancel" class="secondary-btn">Cancel Order</button>
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btnOneClick').onclick = this.submitOrder;
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);
