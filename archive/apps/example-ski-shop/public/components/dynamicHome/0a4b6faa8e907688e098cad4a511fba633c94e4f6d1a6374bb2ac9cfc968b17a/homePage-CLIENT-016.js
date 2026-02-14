class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  async loadInventory() {
    const grid = this.shadowRoot.getElementById('productGrid');
    const greetingEl = this.shadowRoot.getElementById('personalGreeting');

    grid.innerHTML =
      '<div style="grid-column: 1/-1; text-align: center;">Loading personalized gear...</div>';

    try {
      // 1. Access Global State (client profile)
      const client = window.state?.clientProfile || {};
      const crmNotes = (client.crmNotes || []).join(' ').toLowerCase();
      const city = client.city || 'Unknown';

      // 2. Fetch Data (Inventory and History to determine preferences)
      const [invRes, orderRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(`/api/orders?clientId=${window.state?.clientId}`),
      ]);

      const inventory = await invRes.json();
      const orders = await orderRes.json();

      // 3. Analyze History for "Racing" Logic
      // Check if user has bought racing gear previously
      const hasRacingHistory = orders.some((order) =>
        order.items.some(
          (i) =>
            i.skuId.toLowerCase().includes('race') ||
            i.skuId.toLowerCase().includes('world cup')
        )
      );

      // 4. Personalize Greeting
      let greeting = `Welcome to the shop, ${client.id}!`;
      if (city === 'Whistler') {
        if (crmNotes.includes('photographer')) {
          greeting = `Ready for your next photo shoot in Whistler?`;
        } else {
          greeting = `Fresh powder in Whistler awaits!`;
        }
      }
      greetingEl.textContent = greeting;

      // 5. Process Inventory (Sort & Price)
      const processedInventory = inventory.map((item) => {
        const isRacing =
          item.name.toLowerCase().includes('world cup') ||
          item.name.toLowerCase().includes('racer');
        const isRugged =
          item.name.toLowerCase().includes('backcountry') ||
          item.name.toLowerCase().includes('mountain') ||
          item.name.toLowerCase().includes('explorer');

        let price = item.cost * 1.5; // Standard markup
        let isBlowout = false;
        let note = '';

        // PRICING LOGIC: Racing Blowout
        if (isRacing && hasRacingHistory) {
          // Dynamic price between 0.4 and 1.0 * COGS
          const factor = 0.4 + Math.random() * 0.6;
          price = item.cost * factor;
          isBlowout = true;
          note = '🏆 WORLD CUP BLOWOUT';
        }

        // RECOMMENDATION LOGIC: Adventure/Rugged
        if (
          crmNotes.includes('rugged') ||
          crmNotes.includes('heavy') ||
          crmNotes.includes('photographer')
        ) {
          if (isRugged) {
            note = '💪 RUGGED & STABLE CHOICE';
          }
        }

        return {
          ...item,
          displayPrice: price.toFixed(2),
          isBlowout,
          isRugged,
          displayNote: note,
        };
      });

      // Sort: Rugged/Recommended first, then Racing Blowouts, then rest
      processedInventory.sort((a, b) => {
        // Prioritize rugged gear for this specific persona
        if (
          a.displayNote.includes('RUGGED') &&
          !b.displayNote.includes('RUGGED')
        )
          return -1;
        if (
          !a.displayNote.includes('RUGGED') &&
          b.displayNote.includes('RUGGED')
        )
          return 1;
        return 0;
      });

      // 6. Render Grid
      grid.innerHTML = processedInventory
        .map(
          (item) => `
            <div class="card ${item.isBlowout ? 'blowout-card' : ''} ${
            item.isRugged ? 'recommended-card' : ''
          }">
                ${
                  item.displayNote
                    ? `<div class="badge">${item.displayNote}</div>`
                    : ''
                }
                <h3>${item.name}</h3>
                <p class="sku">SKU: ${item.sku}</p>
                <p class="stock">${
                  item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'
                }</p>
                
                <p class="price ${item.isBlowout ? 'blowout-price' : ''}">
                  $${item.displayPrice}
                </p>
                
                ${
                  item.isBlowout
                    ? '<p class="urgency">⚠️ Limited Time Offer</p>'
                    : ''
                }

                <button 
                    class="buy-btn" 
                    data-id="${item.id}"
                    ${item.stock <= 0 ? 'disabled' : ''}>
                    ${item.stock > 0 ? 'Add to Kit' : 'Sold Out'}
                </button>
            </div>
        `
        )
        .join('');

      // Add Event Listeners
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const originalItem = inventory.find((i) => i.id === itemId);

          // Determine price used (re-calculate or pull from logic above)
          // For simplicity in this mock, we pass the object.
          // Note: In a real app, price should be validated server-side.

          this.dispatchEvent(
            new CustomEvent('navigate-order', {
              detail: { item: originalItem }, // Passing original item, OrderPage handles base logic
              bubbles: true,
              composed: true,
            })
          );
        });
      });
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<p>Unable to load equipment inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            
            /* Layout */
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
                gap: 20px; 
                margin-top: 20px;
            }
            
            /* Card Base */
            .card { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.1); 
                text-align: center; 
                font-family: 'Segoe UI', sans-serif; 
                position: relative;
                border: 1px solid #eee;
                transition: transform 0.2s;
            }
            .card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }

            /* Typography */
            h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; display: inline-block; }
            .card h3 { margin: 10px 0 5px 0; color: #2c3e50; font-size: 1.1rem; }
            .sku { font-size: 0.8rem; color: #aaa; margin: 0; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            
            /* Pricing */
            .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; margin: 10px 0; }
            .blowout-price { color: #e74c3c; font-size: 1.6rem; text-decoration: underline; }
            .urgency { color: #e74c3c; font-weight: bold; font-size: 0.8rem; animation: pulse 1.5s infinite; }

            /* Badges */
            .badge {
                background: #2c3e50;
                color: white;
                font-size: 0.7rem;
                padding: 4px 8px;
                border-radius: 4px;
                display: inline-block;
                margin-bottom: 5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* Personalized Styles */
            .recommended-card { border: 2px solid #27ae60; background: #f9fff9; }
            .recommended-card .badge { background: #27ae60; }
            
            .blowout-card { border: 2px solid #e74c3c; background: #fff5f5; }
            .blowout-card .badge { background: #e74c3c; }

            /* Button */
            button { 
                background: #3498db; 
                color: white; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: 600;
            }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            
            .recommended-card button { background: #27ae60; }
            .recommended-card button:hover { background: #219150; }

            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
        </style>

        <h2 id="personalGreeting">Welcome</h2>
        <div id="productGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);
