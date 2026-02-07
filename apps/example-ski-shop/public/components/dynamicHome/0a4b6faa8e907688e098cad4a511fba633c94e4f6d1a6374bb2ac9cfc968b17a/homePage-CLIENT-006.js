class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.client = null;
  }

  async connectedCallback() {
    // 1. Get Client ID from URL (consistent with app.js logic)
    const params = new URLSearchParams(window.location.search);
    const clientId = params.get('clientId');

    if (clientId) {
      await this.fetchClientData(clientId);
    }

    // 2. Load Inventory after we know who the client is
    this.loadInventory();
  }

  async fetchClientData(id) {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (res.ok) {
        this.client = await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch client profile', e);
    }
  }

  async loadInventory() {
    // Initial loading state
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding: 20px; font-family: 'Segoe UI', sans-serif; }
        .loading { color: #7f8c8d; text-align: center; font-style: italic; }
      </style>
      <div class="loading">Loading personalized experience...</div>
    `;

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();
      this.renderPersonalized(inventory);
    } catch (e) {
      this.shadowRoot.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  renderPersonalized(inventory) {
    // --- PERSONALIZATION LOGIC ---

    // 1. CRM & Persona Analysis
    const city = this.client?.city || 'Salt Lake City';
    const crmNotes = this.client?.crmNotes || [];
    const pastPurchases = this.client?.pastPurchases || [];

    // Check if user is interested in Backcountry (based on CRM or Past Purchases)
    const isBackcountryFan =
      crmNotes.some(
        (n) =>
          n.toLowerCase().includes('backcountry') ||
          n.toLowerCase().includes('lightweight')
      ) || pastPurchases.some((p) => p.includes('Backcountry'));

    // Check for Racing History (Target for Blowout)
    const hasRacingHistory = pastPurchases.some(
      (p) => p.includes('Racer') || p.includes('World Cup')
    );

    // 2. Filter & Sort Inventory
    let blowoutItem = null;
    let recommendedItems = [];
    let otherItems = [];

    inventory.forEach((item) => {
      // Logic: World Cup Racer Blowout
      if (hasRacingHistory && item.name.includes('World Cup Racer')) {
        // Dynamic Pricing: 0.4 to 1.0 * COGS
        const discountFactor = 0.4 + Math.random() * 0.6;
        item.displayPrice = (item.cost * discountFactor).toFixed(2);
        item.isBlowout = true;
        item.discountMsg = 'ALUMNI DEAL';
        blowoutItem = item;
      } else {
        // Standard Pricing
        item.displayPrice = (item.cost * 1.5).toFixed(2);
        item.isBlowout = false;

        // Categorize Backcountry vs Others
        if (
          isBackcountryFan &&
          (item.name.includes('Backcountry') ||
            item.name.includes('Nordic') ||
            item.name.includes('Powder'))
        ) {
          recommendedItems.push(item);
        } else {
          otherItems.push(item);
        }
      }
    });

    // --- HTML GENERATION ---

    const greeting = `Welcome back to ${city}!`;
    const subGreeting = isBackcountryFan
      ? 'We found some lightweight setups for your next avalanche safety tour.'
      : 'Check out the latest gear.';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Layout Containers */
        .header-section { margin-bottom: 25px; border-bottom: 2px solid #ecf0f1; padding-bottom: 15px; }
        .header-section h1 { color: #2c3e50; margin: 0; font-size: 1.8rem; }
        .header-section p { color: #7f8c8d; margin: 5px 0 0; }

        .blowout-banner { 
          background: linear-gradient(135deg, #c0392b, #e74c3c); 
          color: white; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          box-shadow: 0 4px 10px rgba(192, 57, 43, 0.3);
        }
        .blowout-info h2 { margin: 0; font-size: 1.5rem; }
        .blowout-info span { background: #f1c40f; color: #c0392b; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; text-transform: uppercase; }
        .blowout-price { font-size: 2rem; font-weight: bold; }
        
        h3.section-title { color: #2c3e50; border-left: 5px solid #3498db; padding-left: 10px; margin-top: 30px; }

        /* Grid Styles */
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        
        /* Card Styles */
        .card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: flex; flex-direction: column; justify-content: space-between; border: 1px solid #eee; }
        .card h4 { margin: 0 0 10px 0; color: #2c3e50; font-size: 1.1rem; }
        .stock { color: #95a5a6; font-size: 0.85rem; margin-bottom: 10px; }
        .price { font-size: 1.2rem; color: #2c3e50; font-weight: bold; margin-bottom: 15px; }
        .highlight-card { border: 2px solid #3498db; background: #fbfdff; }

        button { background: #3498db; color: white; border: none; padding: 10px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 0.95rem; transition: background 0.2s; }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .blowout-btn { background: white; color: #c0392b; font-weight: bold; border: 2px solid white; }
        .blowout-btn:hover { background: #c0392b; color: white; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="header-section">
        <h1>${greeting}</h1>
        <p>${subGreeting}</p>
      </div>

      ${
        blowoutItem
          ? `
        <div class="blowout-banner">
          <div class="blowout-info">
            <span>${blowoutItem.discountMsg}</span>
            <h2>${blowoutItem.name}</h2>
            <div>Since you raced with us before, take this deal!</div>
          </div>
          <div style="text-align:right;">
             <div class="blowout-price">$${blowoutItem.displayPrice}</div>
             <button class="buy-btn blowout-btn" data-id="${blowoutItem.id}">Grab Deal</button>
          </div>
        </div>
      `
          : ''
      }

      ${
        recommendedItems.length > 0
          ? `
        <h3 class="section-title">Recommended for Your Tour</h3>
        <div class="grid">
          ${recommendedItems
            .map((item) => this.createCard(item, true))
            .join('')}
        </div>
      `
          : ''
      }

      <h3 class="section-title">Full Inventory</h3>
      <div class="grid">
        ${otherItems.map((item) => this.createCard(item, false)).join('')}
      </div>
    `;

    // Attach Event Listeners
    this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const itemId = e.target.dataset.id;
        const allItems = [
          blowoutItem,
          ...recommendedItems,
          ...otherItems,
        ].filter(Boolean);
        const item = allItems.find((i) => i.id === itemId);

        this.dispatchEvent(
          new CustomEvent('navigate-order', {
            detail: { item: item },
            bubbles: true,
            composed: true,
          })
        );
      });
    });
  }

  createCard(item, highlight) {
    return `
      <div class="card ${highlight ? 'highlight-card' : ''}">
        <div>
          <h4>${item.name}</h4>
          <p class="stock">${
            item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'
          }</p>
        </div>
        <div>
          <p class="price">$${item.displayPrice}</p>
          <button class="buy-btn" data-id="${item.id}" ${
      item.stock <= 0 ? 'disabled' : ''
    }>
            ${item.stock > 0 ? 'Add to Setup' : 'Sold Out'}
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('home-page', HomePage);
