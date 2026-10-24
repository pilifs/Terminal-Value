class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  connectedCallback() {
    this.render();
    this.clientId = this.getAttribute('client-id');
    this.checkUserContext();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id') {
      this.clientId = newValue;
      this.checkUserContext();
    }
  }

  // Fetch client details to handle the Calgary Banner logic
  async checkUserContext() {
    if (!this.clientId) return;
    try {
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        const client = await res.json();
        const banner = this.shadowRoot.getElementById('calgaryBanner');

        // Logic: Calgary Resident Banner
        if (client.city === 'Calgary') {
          banner.classList.remove('hidden');
        }
      }
    } catch (e) {
      console.error('Error fetching client context', e);
    }
  }

  // Public method called by Router
  loadItem(item) {
    this.selectedItem = item;
    const root = this.shadowRoot;

    // --- PRICING LOGIC ---
    // Constraint: Racing gear @ 120% COGS ("Sales Blowout"). Standard @ 150%.
    // Detection: Checking for keywords "Race", "Carbon", or "Speed" to identify racing gear.
    const isRacingGear = /race|carbon|speed|light/i.test(item.name);
    const markup = isRacingGear ? 1.2 : 1.5;
    const price = item.cost * markup;

    // --- UPSELL LOGIC ---
    // Context: User likes Nordic/All Mtn, transitioning to Backcountry.
    const upsellContainer = root.getElementById('upsellContainer');
    const isSki = /ski/i.test(item.name);

    if (isSki) {
      upsellContainer.innerHTML = `
        <div class="upsell-box">
          <span class="upsell-badge">RECOMMENDED FOR YOU</span>
          <p><strong>Complete your Backcountry Setup:</strong></p>
          <p style="font-size: 0.9rem; color: #555;">
             Based on your experience with <em>Nordic Cross</em>, we recommend pairing these with <strong>Lightweight Touring Bindings</strong> and adjustable poles.
          </p>
          <div class="upsell-action">
             <span>+ Add Matching Bindings (Check availability)</span>
          </div>
        </div>
      `;
      upsellContainer.classList.remove('hidden');
    } else {
      upsellContainer.classList.add('hidden');
    }

    // --- DOM UPDATES ---
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;

    // Formatting price nicely
    const formattedPrice = price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
    root.getElementById('orderItemPrice').textContent = formattedPrice;

    // Show discount tag if racing gear
    const tagEl = root.getElementById('priceTag');
    if (isRacingGear) {
      tagEl.textContent = '🔥 SALES BLOWOUT PRICE';
      tagEl.className = 'tag tag-sale';
    } else {
      tagEl.textContent = 'Standard Retail';
      tagEl.className = 'tag tag-std';
    }

    // Initialize Total
    root.getElementById('btnTotal').textContent = formattedPrice;

    // Quantity Logic
    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';
    qtySelect.onchange = () => {
      const total = price * parseInt(qtySelect.value);
      root.getElementById('btnTotal').textContent = total.toLocaleString(
        'en-US',
        { style: 'currency', currency: 'USD' }
      );
    };
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);

    // Recalculate price based on the strategy defined in loadItem
    const isRacingGear = /race|carbon|speed|light/i.test(
      this.selectedItem.name
    );
    const markup = isRacingGear ? 1.2 : 1.5;
    const price = this.selectedItem.cost * markup;

    const btn = root.getElementById('btnOneClick');

    // UX: Button Loading State
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Processing...`;

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
        // iOS Style Success Feedback
        btn.style.background = '#2ecc71';
        btn.innerHTML = '✓ Purchased';
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
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            background: #f2f2f7; /* iOS background gray */
            height: 100%;
            position: relative;
        }

        /* Banner Styles */
        .banner {
            background: linear-gradient(90deg, #d4af37, #f1c40f);
            color: #333;
            padding: 12px;
            text-align: center;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .hidden { display: none; }

        .container {
            padding: 20px;
            max-width: 600px;
            margin: 0 auto;
            padding-bottom: 100px; /* Space for sticky button */
        }

        /* Card Styles */
        .card { 
            background: white; 
            border-radius: 16px; 
            padding: 24px; 
            box-shadow: 0 4px 12px rgba(0,0,0,0.05); 
            margin-bottom: 20px;
        }

        h2 { margin-top: 0; color: #1c1c1e; font-size: 1.5rem; }
        h3 { margin: 0 0 5px 0; color: #1c1c1e; font-size: 1.3rem; }
        
        .sku { color: #8e8e93; font-size: 0.9rem; margin-bottom: 15px; display: block;}
        
        .price-container {
            display: flex;
            align-items: baseline;
            gap: 10px;
            margin: 15px 0;
        }
        .price { font-size: 1.6rem; color: #000; font-weight: 700; }
        
        .tag { font-size: 0.75rem; padding: 4px 8px; border-radius: 6px; font-weight: bold; text-transform: uppercase; }
        .tag-sale { background: #ff3b30; color: white; }
        .tag-std { background: #e5e5ea; color: #8e8e93; }

        /* Form Elements */
        label { font-weight: 600; color: #3a3a3c; }
        select { 
            width: 100%; 
            padding: 12px; 
            margin-top: 8px; 
            border: 1px solid #d1d1d6; 
            border-radius: 10px; 
            font-size: 1rem; 
            background-color: #fff;
            -webkit-appearance: none;
        }

        /* Upsell Box */
        .upsell-box {
            background: #f0f8ff;
            border: 1px solid #add8e6;
            border-radius: 12px;
            padding: 15px;
            margin-top: 20px;
        }
        .upsell-badge {
            background: #007aff;
            color: white;
            font-size: 0.7rem;
            padding: 3px 6px;
            border-radius: 4px;
            font-weight: bold;
        }
        .upsell-action {
            margin-top: 10px;
            color: #007aff;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
        }

        /* Sticky One-Click Button (iPhone 13 style) */
        .bottom-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            background: rgba(255,255,255,0.9);
            backdrop-filter: blur(10px);
            border-top: 1px solid #c6c6c8;
            padding: 15px 20px 30px 20px; /* Extra bottom padding for iOS home indicator */
            box-sizing: border-box;
            display: flex;
            gap: 10px;
            justify-content: center;
        }

        .btn-one-click {
            background: #007aff; /* iOS Blue */
            color: white;
            border: none;
            height: 50px;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 600;
            width: 100%;
            max-width: 500px;
            cursor: pointer;
            box-shadow: 0 4px 10px rgba(0, 122, 255, 0.3);
            transition: transform 0.1s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .btn-one-click:active { transform: scale(0.98); }
        .btn-one-click:disabled { background: #8e8e93; cursor: not-allowed; box-shadow: none; }

        .btn-cancel {
            background: transparent;
            color: #007aff;
            border: none;
            font-size: 1rem;
            cursor: pointer;
            width: 80px;
        }

        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

      </style>

      <!-- Location Banner -->
      <div id="calgaryBanner" class="banner hidden">
         🇨🇦 Free Express Shipping to Calgary for VIP Members!
      </div>

      <div class="container">
        <h2>Review Order</h2>
        
        <div class="card">
            <h3 id="orderItemName">Loading...</h3>
            <span id="orderItemSku" class="sku"></span>
            
            <div class="price-container">
                <span id="orderItemPrice" class="price">$0.00</span>
                <span id="priceTag" class="tag"></span>
            </div>

            <div style="margin-top: 20px;">
                <label for="orderQty">Quantity</label>
                <select id="orderQty">
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                </select>
            </div>

            <!-- Dynamic Upsell Section -->
            <div id="upsellContainer" class="hidden"></div>
        </div>
      </div>

      <!-- Sticky Bottom Action Bar -->
      <div class="bottom-bar">
         <button class="btn-cancel" id="btnCancel">Cancel</button>
         <button id="btnOneClick" class="btn-one-click">
            One-Click Buy &nbsp;(<span id="btnTotal"></span>)
         </button>
      </div>
    `;

    // Event Bindings
    this.shadowRoot.getElementById('btnOneClick').onclick = () =>
      this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);
