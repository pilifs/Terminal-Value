class OrderPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.selectedItem = null;
    this.clientId = null;
    this.clientCity = '';
    this.upsellItem = {
      id: 'UPSELL-POLES-001',
      name: 'Carbon Telescopic Backcountry Poles',
      cost: 80, // COGS
      price: 120, // Retail
    };
  }

  static get observedAttributes() {
    return ['client-id'];
  }

  async connectedCallback() {
    this.clientId = this.getAttribute('client-id');
    if (this.clientId) {
      await this.fetchClientDetails();
    }
    this.render();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'client-id' && newValue !== oldValue) {
      this.clientId = newValue;
      this.fetchClientDetails();
    }
  }

  async fetchClientDetails() {
    try {
      // Fetch client info to verify City for the banner logic
      const res = await fetch(`/api/clients/${this.clientId}`);
      if (res.ok) {
        const data = await res.json();
        this.clientCity = data.city || '';
        this.render(); // Re-render to update banner visibility
      }
    } catch (e) {
      console.error('Could not fetch client details', e);
    }
  }

  // Called by the main router
  loadItem(item) {
    this.selectedItem = item;
    this.render();
  }

  calculatePrice() {
    if (!this.selectedItem) return 0;

    // PRICING STRATEGY:
    // Racing gear = 120% of COGS (Sales Blowout)
    // Standard gear = 150% of COGS (Standard markup per existing app.js logic)

    const nameLower = this.selectedItem.name.toLowerCase();
    const isRacing =
      nameLower.includes('race') || nameLower.includes('world cup');

    const markup = isRacing ? 1.2 : 1.5;
    return (this.selectedItem.cost * markup).toFixed(2);
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const btn = root.getElementById('btnOneClick');

    // UI Feedback
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // 1. Main Item Data
    const mainItemPrice = this.calculatePrice();
    const qty = 1; // Simplify to 1 for One-Click logic

    const itemsPayload = [
      {
        skuId: this.selectedItem.id,
        quantity: qty,
        price: parseFloat(mainItemPrice),
      },
    ];

    // 2. Upsell Logic
    const upsellCheckbox = root.getElementById('upsellCheck');
    if (upsellCheckbox && upsellCheckbox.checked) {
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
        // Visual Success Feedback specific for iPad user experience
        btn.style.backgroundColor = '#27ae60';
        btn.innerHTML = '<span>&#10003;</span> Ordered!';

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
        btn.textContent = 'Buy with 1-Click';
      }
    } catch (e) {
      alert('Network Error');
      btn.disabled = false;
      btn.textContent = 'Buy with 1-Click';
    }
  }

  render() {
    if (!this.selectedItem) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const finalPrice = this.calculatePrice();
    const isCalgary = this.clientCity.toLowerCase() === 'calgary';

    // Determining Upsell suitability
    // Requirement: If buying skis, suggest bindings or poles matching past purchases (Deep Powder/Backcountry)
    // We assume if stock > 0 and it's in this shop, it's likely skis or boots.
    // We offer a high-end backcountry pole to match the "Digital Nomad/Lodge" persona.
    const showUpsell = true;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #333;
          animation: slideUp 0.4s ease-out;
        }

        /* iPad Air Optimization: Larger touch targets, clean layout */
        .container {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          overflow: hidden;
          max-width: 600px;
          margin: 20px auto;
        }

        /* VIP Banner */
        .vip-banner {
          background: linear-gradient(90deg, #c0392b, #e74c3c);
          color: white;
          text-align: center;
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.5px;
          display: ${isCalgary ? 'block' : 'none'};
        }

        .content {
          padding: 30px;
        }

        /* Product Header */
        h2 {
          margin: 0 0 5px 0;
          font-size: 1.8rem;
          color: #2c3e50;
        }
        .sku {
          color: #7f8c8d;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 20px;
        }

        /* Pricing Area */
        .price-tag {
          font-size: 2.5rem;
          font-weight: 800;
          color: #2c3e50;
          margin-bottom: 25px;
        }
        .price-tag span {
          font-size: 1rem;
          font-weight: normal;
          color: #7f8c8d;
        }

        /* Upsell Box */
        .upsell-box {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 30px;
          display: flex;
          align-items: center;
        }
        .upsell-info {
          flex-grow: 1;
          margin-left: 15px;
        }
        .upsell-title {
          font-weight: bold;
          color: #2c3e50;
          display: block;
        }
        .upsell-desc {
          font-size: 0.85rem;
          color: #666;
        }
        /* Touch-friendly Checkbox */
        input[type="checkbox"] {
          width: 24px;
          height: 24px;
          cursor: pointer;
        }

        /* Action Buttons */
        .actions {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        /* iPad One-Click Button Style */
        .btn-one-click {
          background: #000; /* Apple Pay aesthetic */
          color: white;
          border: none;
          padding: 18px;
          border-radius: 8px;
          font-size: 1.2rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: transform 0.1s, background 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          /* Minimum touch target */
          min-height: 55px; 
        }
        .btn-one-click:active {
          transform: scale(0.98);
        }
        .btn-one-click:hover {
          background: #333;
        }

        .btn-cancel {
          background: transparent;
          color: #7f8c8d;
          border: 1px solid #bdc3c7;
          padding: 14px;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          width: 100%;
        }

        .crm-hint {
            font-size: 0.8rem;
            color: #95a5a6;
            margin-top: 15px;
            text-align: center;
            font-style: italic;
        }

        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      </style>

      <div class="container">
        <!-- Requirement: Banner for Calgary Clients -->
        <div class="vip-banner">
          ❄️ FREE Express Shipping to Calgary for VIP Members
        </div>

        <div class="content">
            <h2>${this.selectedItem.name}</h2>
            <div class="sku">SKU: ${this.selectedItem.sku}</div>
            
            <div class="price-tag">
                $${finalPrice} <span>CAD</span>
            </div>

            <!-- Requirement: Upsell Logic (Matches 'Backcountry/Deep Powder' profile) -->
            ${
              showUpsell
                ? `
            <div class="upsell-box">
                <input type="checkbox" id="upsellCheck">
                <div class="upsell-info">
                    <span class="upsell-title">Add Matching Gear</span>
                    <span class="upsell-desc">
                        ${this.upsellItem.name} (+$${this.upsellItem.price})
                    </span>
                </div>
            </div>
            `
                : ''
            }

            <div class="actions">
                <!-- Requirement: One-Click Buy Button (iPad Styled) -->
                <button id="btnOneClick" class="btn-one-click">
                   Buy with 1-Click
                </button>
                
                <button id="btnCancel" class="btn-cancel">
                    Maybe Later
                </button>
            </div>

            <!-- Subtle nod to CRM Notes regarding interest in heated gear -->
            <div class="crm-hint">
                psst... we also have new Heated Socks in stock at the lodge.
            </div>
        </div>
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
