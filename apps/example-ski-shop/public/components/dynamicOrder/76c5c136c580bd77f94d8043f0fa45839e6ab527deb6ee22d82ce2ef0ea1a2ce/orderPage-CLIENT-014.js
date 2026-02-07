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
    this.fetchClientProfile(); // Fetch profile immediately to prep UI
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
      this.clientProfile = await res.json();
      // Re-render if item is already loaded to apply location logic
      if (this.selectedItem) this.loadItem(this.selectedItem);
    } catch (e) {
      console.error('Failed to load profile for order customization');
    }
  }

  // Logic to determine pricing strategy based on item type
  calculatePrice(item) {
    const name = item.name.toLowerCase();
    const isRacing = name.includes('race') || name.includes('world cup');
    
    // Racing gear @ 120% COGS ("Sales Blowout"), others @ 150% (Standard)
    const markup = isRacing ? 1.2 : 1.5;
    return {
      finalPrice: item.cost * markup,
      isSale: isRacing
    };
  }

  // Mock Upsell Logic based on Past Purchases style
  getUpsell(item) {
    // Return a mock object based on the item category
    return {
      name: "Pro Team Carbon Poles",
      price: 129.99,
      image: "🎿"
    };
  }

  loadItem(item) {
    this.selectedItem = item;
    const { finalPrice, isSale } = this.calculatePrice(item);
    
    // UI References
    const root = this.shadowRoot;
    const container = root.querySelector('.container');
    
    // 1. Text Updates
    root.getElementById('orderItemName').textContent = item.name;
    root.getElementById('orderItemSku').textContent = item.sku;
    
    // 2. Pricing & Sale Logic
    const priceEl = root.getElementById('orderItemPrice');
    priceEl.textContent = `$${finalPrice.toFixed(2)}`;
    
    if (isSale) {
        priceEl.classList.add('sale-price');
        root.getElementById('saleBadge').style.display = 'inline-block';
    } else {
        priceEl.classList.remove('sale-price');
        root.getElementById('saleBadge').style.display = 'none';
    }

    root.getElementById('btnOneClick').textContent = `One-Click Buy ($${finalPrice.toFixed(2)})`;

    // 3. Burlington VIP Banner Logic
    const banner = root.getElementById('burlingtonBanner');
    if (this.clientProfile && this.clientProfile.city === 'Burlington') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    // 4. Coffee / Comfort Note
    const comfortNote = root.getElementById('comfortNote');
    // Simple logic: if profile loaded, show personalized message
    if (this.clientProfile) {
        comfortNote.textContent = "☕ Welcome back! We've got a fresh coffee waiting for you at the shop pickup.";
    }

    // 5. Upsell Render
    const upsellItem = this.getUpsell(item);
    root.getElementById('upsellName').textContent = upsellItem.name;
    root.getElementById('upsellPrice').textContent = `$${upsellItem.price}`;
    
    // Show container with animation
    container.classList.add('visible');
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const { finalPrice } = this.calculatePrice(this.selectedItem);
    const btn = root.getElementById('btnOneClick');

    // Windows Style Loading State
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Processing...';
    btn.style.backgroundColor = '#7f8c8d';

    const payload = {
      clientId: this.clientId,
      items: [{ skuId: this.selectedItem.id, quantity: 1, price: finalPrice }],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        // Windows Desktop "Toast" style notification simulation
        alert(`Purchase Successful! \nOrder ID: ${data.orderId}\nEstimated Delivery to Burlington: 2 Days.`);
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
      btn.textContent = originalText;
      btn.style.backgroundColor = '#0078D7'; // Reset to Windows Blue
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
                display: block; 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                color: #333;
            }
            
            /* Layout */
            .container {
                opacity: 0;
                transform: translateY(10px);
                transition: opacity 0.3s ease, transform 0.3s ease;
                max-width: 800px;
                margin: 0 auto;
                background: #f9f9f9;
                padding: 20px;
                border-radius: 4px; /* Windows 10/11 subtle rounding */
                border: 1px solid #e0e0e0;
            }
            .container.visible {
                opacity: 1;
                transform: translateY(0);
            }

            /* Typography */
            h2 { font-weight: 300; font-size: 2rem; margin-bottom: 20px; color: #2c3e50; }
            h3 { font-weight: 600; margin: 0; color: #000; }
            .sku { font-family: 'Consolas', monospace; color: #666; font-size: 0.9rem; }
            
            /* Banner Styles */
            .banner {
                background-color: #d4af37; /* VIP Gold */
                color: white;
                padding: 15px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                border-radius: 2px;
                font-weight: 600;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .banner.hidden { display: none; }
            .banner-icon { font-size: 1.5rem; margin-right: 15px; }
            
            /* Comfort/Coffee Note */
            .comfort-note {
                background-color: #fff;
                border-left: 4px solid #6f4e37; /* Coffee brown */
                padding: 10px 15px;
                margin-bottom: 20px;
                font-style: italic;
                color: #555;
            }

            /* Product Card Layout */
            .product-layout {
                display: flex;
                gap: 30px;
                flex-wrap: wrap;
            }
            .main-product {
                flex: 2;
                background: white;
                padding: 20px;
                border: 1px solid #ddd;
                box-shadow: 0 4px 8px rgba(0,0,0,0.05);
            }
            .upsell-product {
                flex: 1;
                background: #eef2f5;
                padding: 20px;
                border: 1px dashed #bdc3c7;
                display: flex;
                flex-direction: column;
                justify-content: center;
            }

            /* Pricing */
            .price-container { margin: 20px 0; }
            .price { font-size: 2rem; font-weight: bold; color: #333; }
            .sale-price { color: #d63031; }
            .badge { 
                background: #d63031; color: white; 
                padding: 2px 8px; font-size: 0.8rem; 
                text-transform: uppercase; font-weight: bold;
                vertical-align: middle; margin-left: 10px;
                display: none;
            }

            /* Windows Style Buttons */
            .btn-one-click {
                background-color: #0078D7; /* Microsoft Blue */
                color: white;
                border: 2px solid #0078D7;
                padding: 16px 32px; /* Large touch target */
                font-size: 1.1rem;
                font-weight: 600;
                width: 100%;
                cursor: pointer;
                transition: background 0.1s, transform 0.1s;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            .btn-one-click:hover {
                background-color: #0063b1;
                border-color: #0063b1;
            }
            .btn-one-click:active {
                transform: scale(0.98);
            }
            .btn-cancel {
                background: transparent;
                border: none;
                color: #555;
                text-decoration: underline;
                cursor: pointer;
                margin-top: 15px;
                font-size: 0.9rem;
            }

            /* Upsell Styles */
            .upsell-title { font-size: 0.9rem; text-transform: uppercase; color: #7f8c8d; letter-spacing: 1px; }
            .upsell-name { font-weight: bold; margin: 5px 0; }
            .upsell-price { color: #27ae60; font-weight: bold; }

        </style>

        <div class="container">
            
            <!-- Burlington VIP Banner -->
            <div id="burlingtonBanner" class="banner hidden">
                <span class="banner-icon">🚚</span>
                <div>
                    FREE Express Shipping to Burlington included for our VIP members.<br>
                    <small>Skis will be waxed and ready for the Vermont slopes.</small>
                </div>
            </div>

            <!-- Comfort/Coffee Note -->
            <div id="comfortNote" class="comfort-note">
                Welcome to the Alpine Ski Shop.
            </div>

            <h2>Review Order</h2>

            <div class="product-layout">
                <!-- Main Product Area -->
                <div class="main-product">
                    <h3 id="orderItemName">Loading...</h3>
                    <div class="sku">SKU: <span id="orderItemSku">--</span></div>
                    
                    <div class="price-container">
                        <span id="orderItemPrice" class="price">$0.00</span>
                        <span id="saleBadge" class="badge">Sales Blowout</span>
                    </div>

                    <p style="margin-bottom: 25px; color: #666;">
                        Comfort Guarantee included. 30-Day slope trial period applicable for loyal members.
                    </p>

                    <!-- Windows Touch Target Optimized Button -->
                    <button id="btnOneClick" class="btn-one-click">One-Click Buy</button>
                    <div style="text-align: center;">
                        <button id="btnCancel" class="btn-cancel">Cancel Order</button>
                    </div>
                </div>

                <!-- Dynamic Upsell Area -->
                <div class="upsell-product">
                    <div class="upsell-title">Completes your setup</div>
                    <div style="font-size: 3rem; text-align: center; margin: 10px 0;">🎿</div>
                    <div class="upsell-name" id="upsellName">Loading...</div>
                    <div class="upsell-price" id="upsellPrice">...</div>
                    <small style="margin-top: 10px; color: #888;">Matches your "Backcountry" preference.</small>
                </div>
            </div>
        </div>
    `;

    // Event Bindings
    this.shadowRoot.getElementById('btnOneClick').onclick = () => this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);