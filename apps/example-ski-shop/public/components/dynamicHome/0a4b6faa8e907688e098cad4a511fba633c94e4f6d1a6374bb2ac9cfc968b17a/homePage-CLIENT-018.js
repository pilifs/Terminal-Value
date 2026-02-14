class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.clientId = new URLSearchParams(window.location.search).get('clientId');
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const container = this.shadowRoot.getElementById('content-area');
    const greetingEl = this.shadowRoot.getElementById('greeting');

    container.innerHTML =
      '<div class="loading">Personalizing your shop experience...</div>';

    try {
      // 1. Fetch Client Profile & History parallel to Inventory
      const [inventoryRes, clientRes, ordersRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(`/api/clients/${this.clientId}`),
        fetch(`/api/orders?clientId=${this.clientId}`),
      ]);

      const inventory = await inventoryRes.json();
      const client = await clientRes.json();
      const orders = await ordersRes.json();

      // 2. Analyze User Persona
      const city = client.city || 'Skier';

      // Flatten order items into a single array of item names for history checking
      const pastGear = orders.flatMap((o) => o.items.map((i) => i.name || ''));

      // Check for specific personas based on history
      const hasRacingHistory = pastGear.some(
        (name) =>
          name.toLowerCase().includes('race') ||
          name.toLowerCase().includes('world cup') ||
          name.toLowerCase().includes('carver') // Including 'Carver' based on profile context
      );

      // Check CRM notes for keywords
      const crmNotes = client.crmNotes || [];
      const needsVersatile = crmNotes.some((note) =>
        note.toLowerCase().includes('versatile')
      );
      const isWeekendWarrior = crmNotes.some((note) =>
        note.toLowerCase().includes('weekend')
      );

      // 3. Set Personalized Greeting
      // If "Weekend warrior" is in notes, reference the weekend. Otherwise default to City/Trip logic.
      if (isWeekendWarrior) {
        greetingEl.textContent = `Hello, ${city}! Ready for the weekend?`;
      } else {
        greetingEl.textContent = `Welcome back to the slopes, ${city}!`;
      }

      // 4. Filter & Sort Inventory
      // Split inventory into "Featured/Personalized" and "Sales/Other"
      let primaryList = [];
      let secondaryList = [];

      inventory.forEach((item) => {
        const isRacingSki =
          item.name.toLowerCase().includes('world cup') ||
          item.name.toLowerCase().includes('racer');
        const isVersatile =
          item.name.toLowerCase().includes('all mountain') ||
          item.name.toLowerCase().includes('explorer');

        // --- PRICING LOGIC ---
        let finalPrice;
        let priceLabel = '';
        let isSale = false;

        if (isRacingSki) {
          if (hasRacingHistory) {
            // REQUIREMENT: Dynamic price 0.4 - 1.0 * COGS for Racing History
            const dynamicFactor = Math.random() * (1.0 - 0.4) + 0.4;
            finalPrice = item.cost * dynamicFactor;
            priceLabel = 'VIP BLOWOUT';
            isSale = true;
          } else {
            // CONSTRAINT: Racing gear at ~120% COGS for others
            finalPrice = item.cost * 1.2;
            priceLabel = 'Sales Blowout';
            isSale = true;
          }
        } else {
          // Standard Markup
          finalPrice = item.cost * 1.5;
        }

        const itemData = { ...item, finalPrice, priceLabel, isSale };

        // --- SORTING LOGIC ---
        // If user needs versatile gear, prioritize All Mountain
        if (needsVersatile && isVersatile) {
          primaryList.push(itemData);
        } else if (isRacingSki) {
          // Always highlight sales/racing gear
          secondaryList.unshift(itemData);
        } else {
          secondaryList.push(itemData);
        }
      });

      // Combine lists, putting personalized picks first
      const sortedInventory = [...primaryList, ...secondaryList];

      // 5. Render Grid
      container.innerHTML = sortedInventory
        .map(
          (item) => `
          <div class="card ${item.isSale ? 'sale-card' : ''}">
            ${item.isSale ? `<div class="badge">${item.priceLabel}</div>` : ''}
            <h3>${item.name}</h3>
            <p class="sku">SKU: ${item.id}</p>
            
            <div class="price-block">
              ${
                item.isSale
                  ? `<span class="old-price">$${(item.cost * 1.5).toFixed(
                      0
                    )}</span>`
                  : ''
              }
              <span class="price">$${item.finalPrice.toFixed(2)}</span>
            </div>

            <p class="stock">${
              item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'
            }</p>
            
            <button 
              class="buy-btn ${item.isSale ? 'btn-sale' : ''}" 
              data-id="${item.id}"
              ${item.stock <= 0 ? 'disabled' : ''}>
              ${
                item.stock > 0
                  ? item.isSale
                    ? 'Grab Deal'
                    : 'Buy Now'
                  : 'Sold Out'
              }
            </button>
          </div>
        `
        )
        .join('');

      // Add Event Listeners
      container.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: item },
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      console.error(e);
      container.innerHTML =
        '<p class="error">Unable to load your personalized shop. Please try again.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
        
        /* Layout Structure */
        h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block; }
        .greeting-box { background: #dff9fb; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 5px solid #3498db; color: #2c3e50; font-size: 1.1rem; font-weight: 600; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 25px; }
        
        /* Card Styles */
        .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; transition: transform 0.2s; display: flex; flex-direction: column; justify-content: space-between; }
        .card:hover { transform: translateY(-3px); box-shadow: 0 6px 12px rgba(0,0,0,0.15); }
        
        /* Sale Specifics */
        .sale-card { border: 2px solid #e74c3c; background: #fff5f5; }
        .badge { position: absolute; top: -10px; right: -10px; background: #e74c3c; color: white; padding: 5px 10px; border-radius: 20px; font-weight: bold; font-size: 0.8rem; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        
        /* Typography */
        h3 { margin: 10px 0 5px 0; color: #2c3e50; font-size: 1.2rem; }
        .sku { font-size: 0.75rem; color: #95a5a6; margin: 0; }
        .stock { color: #7f8c8d; font-size: 0.9rem; margin: 10px 0 15px 0; }
        
        /* Pricing */
        .price-block { margin: 10px 0; }
        .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; }
        .old-price { text-decoration: line-through; color: #95a5a6; font-size: 0.9rem; margin-right: 8px; }
        .sale-card .price { color: #c0392b; }
        
        /* Buttons */
        button { background: #3498db; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; width: 100%; font-size: 1rem; font-weight: 600; transition: background 0.2s; }
        button:hover { background: #2980b9; }
        button:disabled { background: #bdc3c7; cursor: not-allowed; }
        
        .btn-sale { background: #e74c3c; }
        .btn-sale:hover { background: #c0392b; }

        .loading { padding: 40px; text-align: center; color: #7f8c8d; font-style: italic; }
        .error { color: #c0392b; text-align: center; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      </style>

      <div class="greeting-box" id="greeting">Welcome!</div>
      <div id="content-area" class="grid"></div>
    `;
  }
}

customElements.define('home-page', HomePage);
