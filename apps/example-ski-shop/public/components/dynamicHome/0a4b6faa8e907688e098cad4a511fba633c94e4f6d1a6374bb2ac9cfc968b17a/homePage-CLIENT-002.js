class HomePage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.loadInventory();
  }

  /**
   * Main logic to fetch data and apply the specific business rules
   * for this user persona.
   */
  async loadInventory() {
    const contentContainer = this.shadowRoot.getElementById('personalizedContent');
    contentContainer.innerHTML = '<div class="loading">Loading your personalized gear...</div>';

    try {
      // 1. Fetch Inventory and User Order History
      const [invRes, ordersRes] = await Promise.all([
        fetch('/api/inventory'),
        fetch(`/api/orders?clientId=${state.clientId || ''}`)
      ]);

      const inventory = await invRes.json();
      const orders = await ordersRes.json();

      // 2. Analyze User History & CRM Data
      // Check for specific keywords in past orders to determine 'Racing' history
      const hasRacingHistory = orders.some(order => 
        order.items && order.items.some(item => 
          (item.name && (item.name.includes('Racer') || item.name.includes('World Cup') || item.name.includes('Piste')))
        )
      );

      // Check CRM notes for specific destination keywords (Vail)
      const crmNotes = state.clientProfile?.crmNotes || [];
      const destination = crmNotes.find(n => n.includes('Vail')) ? 'Vail' : 'the slopes';
      
      // Check CRM for specific fit needs
      const needsWideFit = crmNotes.some(n => n.includes('wide fit') || n.includes('too tight'));

      // 3. Update Header Greeting
      const city = state.clientProfile?.city || 'Vancouver';
      const headerTitle = this.shadowRoot.getElementById('headerTitle');
      const headerSub = this.shadowRoot.getElementById('headerSub');
      
      headerTitle.textContent = `Getting Ready for ${destination}?`;
      headerSub.textContent = `Hello from ${city}. We've curated a durable, high-performance selection for your trip.`;

      // 4. Categorize and Price Inventory
      const recommendations = {
        boots: [],
        skis: [],
        other: []
      };

      inventory.forEach(item => {
        let displayPrice = item.cost * 1.5; // Default Markup
        let note = '';
        let isPromo = false;

        // LOGIC: Racing Gear Pricing Strategy
        if (item.name.includes('World Cup') || item.name.includes('Racer')) {
          if (hasRacingHistory) {
            // Dynamic blowout price: Random between 0.4 and 1.0 * COGS
            const multiplier = 0.4 + (Math.random() * 0.6);
            displayPrice = item.cost * multiplier;
            note = '🔥 LOYALTY BLOWOUT';
            isPromo = true;
          } else {
            // Standard racing overstock pricing (120% COGS)
            displayPrice = item.cost * 1.2;
            note = 'Overstock Value';
          }
        }

        const productObj = { ...item, displayPrice, note, isPromo };

        // LOGIC: Filter for "Wide Fit" needs based on CRM
        if (item.name.includes('Boot')) {
            // If user needs wide fit, prioritize wide/comfort boots, penalize others visually
            if (needsWideFit) {
                if (item.name.includes('Wide') || item.name.includes('Comfort')) {
                    productObj.note = '✅ Recommended for Width';
                    recommendations.boots.unshift(productObj);
                } else {
                    recommendations.boots.push(productObj);
                }
            } else {
                recommendations.boots.push(productObj);
            }
        } 
        else if (item.name.includes('Ski') || item.name.includes('Board')) {
            recommendations.skis.push(productObj);
        } else {
            recommendations.other.push(productObj);
        }
      });

      // 5. Render Sections
      contentContainer.innerHTML = '';
      
      // Render Section: Priority Boots (Addressing CRM Complaint)
      if (recommendations.boots.length) {
        contentContainer.innerHTML += `
          <div class="section-title">Found for you: Comfort & Wide Fit Options</div>
          <div class="grid">
            ${recommendations.boots.map(item => this.createCard(item)).join('')}
          </div>
        `;
      }

      // Render Section: Skis (With potential Racing Logic applied)
      if (recommendations.skis.length) {
        contentContainer.innerHTML += `
          <div class="section-title">High Performance & Durability</div>
          <div class="grid">
            ${recommendations.skis.map(item => this.createCard(item)).join('')}
          </div>
        `;
      }

      this.attachEventListeners(inventory);

    } catch (e) {
      console.error(e);
      contentContainer.innerHTML = '<p>Unable to load your personalized selection at this time.</p>';
    }
  }

  createCard(item) {
    return `
      <div class="card ${item.isPromo ? 'promo-card' : ''}">
          ${item.note ? `<div class="badge">${item.note}</div>` : ''}
          <h3>${item.name}</h3>
          <p class="stock">${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
          <div class="price-container">
            ${item.isPromo 
                ? `<span class="old-price">$${(item.cost * 1.5).toFixed(2)}</span>` 
                : ''}
            <span class="price">$${item.displayPrice.toFixed(2)}</span>
          </div>
          <button 
              class="buy-btn" 
              data-id="${item.id}"
              ${item.stock <= 0 ? 'disabled' : ''}>
              ${item.stock > 0 ? 'Add to Order' : 'Sold Out'}
          </button>
      </div>
    `;
  }

  attachEventListeners(inventory) {
    this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
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
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.4s; font-family: 'Segoe UI', sans-serif; }
            
            /* Hero Section */
            .hero {
                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                color: white;
                padding: 30px;
                border-radius: 8px;
                margin-bottom: 30px;
                text-align: center;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }
            .hero h1 { margin: 0 0 10px 0; font-size: 2rem; }
            .hero p { margin: 0; font-size: 1.1rem; opacity: 0.9; }

            /* Grid Layout */
            .section-title {
                font-size: 1.4rem;
                color: #2c3e50;
                margin-bottom: 15px;
                border-left: 5px solid #e67e22;
                padding-left: 10px;
            }
            .grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); 
                gap: 25px; 
                margin-bottom: 40px;
            }

            /* Card Styling */
            .card { 
                background: white; 
                padding: 20px; 
                border-radius: 8px; 
                box-shadow: 0 2px 5px rgba(0,0,0,0.05); 
                text-align: center; 
                position: relative;
                transition: transform 0.2s;
                border: 1px solid #eee;
            }
            .card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
            
            /* Specific Promo Styles */
            .promo-card { border: 2px solid #e74c3c; background: #fff9f9; }
            
            .card h3 { margin: 15px 0 10px 0; color: #2c3e50; font-size: 1.2rem; }
            
            .badge {
                background: #27ae60;
                color: white;
                font-size: 0.8rem;
                padding: 4px 8px;
                border-radius: 4px;
                display: inline-block;
                margin-bottom: 5px;
                text-transform: uppercase;
                font-weight: bold;
            }
            .promo-card .badge { background: #e74c3c; }

            .price-container { margin: 15px 0; }
            .price { font-size: 1.4rem; color: #2c3e50; font-weight: bold; }
            .old-price { text-decoration: line-through; color: #95a5a6; font-size: 0.9rem; margin-right: 10px; }
            
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 5px; }
            
            button { 
                background: #3498db; 
                color: white; 
                border: none; 
                padding: 12px 20px; 
                border-radius: 5px; 
                cursor: pointer; 
                width: 100%; 
                font-size: 1rem; 
                font-weight: bold;
                transition: background 0.2s;
            }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }

            .loading { text-align: center; padding: 40px; color: #7f8c8d; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>

        <div class="hero">
            <h1 id="headerTitle">Welcome Back</h1>
            <p id="headerSub">Loading your personalized experience...</p>
        </div>

        <div id="personalizedContent"></div>
    `;
  }
}

customElements.define('home-page', HomePage);