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
    const heroContainer = this.shadowRoot.getElementById('heroProduct');
    const secondaryContainer = this.shadowRoot.getElementById('secondaryGrid');
    
    heroContainer.innerHTML = '<div class="loading">Scouting terrain...</div>';

    try {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();

      // STRATEGY: Find the Nordic setup for our specific client persona
      const nordicItem = inventory.find(i => i.name.includes('Nordic') || i.name.includes('Cross'));
      const otherItems = inventory.filter(i => i !== nordicItem);

      // Render the "Hero" Item (The Nordic Setup)
      if (nordicItem) {
        heroContainer.innerHTML = `
          <div class="hero-product-content">
            <span class="badge">Your Perfect Match</span>
            <h2>${nordicItem.name}</h2>
            <p class="narrative">
              Lightweight precision for the long haul. 
              Designed for the metrics that matter: 
              heart rate, elevation gain, and the silence of the backcountry.
            </p>
            <div class="meta-row">
              <span>${nordicItem.stock > 0 ? 'Map: Uncharted' : 'Status: Unavailable'}</span>
              <span class="subtle-price">$${(nordicItem.cost * 1.5).toFixed(0)}</span>
            </div>
            <button class="cta-btn primary" data-id="${nordicItem.id}">
              ${nordicItem.stock > 0 ? 'Start Your Journey' : 'Currently Unavailable'}
            </button>
          </div>
        `;
      }

      // Render Secondary Items (The Rest of the Quiver)
      secondaryContainer.innerHTML = otherItems
        .map(
          (item) => `
            <div class="card">
                <div class="card-header">
                  <h3>${item.name}</h3>
                </div>
                <div class="card-body">
                  <p class="feeling">For the ${this.getVibe(item.name)}</p>
                  <div class="bottom-row">
                    <span class="minimal-price">$${(item.cost * 1.5).toFixed(0)}</span>
                    <button 
                        class="text-link" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'Equip' : 'Gone'} &rarr;
                    </button>
                  </div>
                </div>
            </div>
        `
        )
        .join('');

      // Attach Event Listeners
      this.shadowRoot.querySelectorAll('button').forEach((btn) => {
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
      heroContainer.innerHTML = '<p>The path is blocked. (Error loading inventory)</p>';
    }
  }

  // Helper to add flavor text based on item name
  getVibe(name) {
    if (name.includes('Racer')) return 'chase for gold.';
    if (name.includes('Backcountry')) return 'path less traveled.';
    if (name.includes('Powder')) return 'deepest silence.';
    if (name.includes('Park')) return 'gravity defiers.';
    return 'next peak.';
  }

  render() {
    this.shadowRoot.innerHTML = `
        <style>
            :host { 
              display: block; 
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #2c3e50;
              background-color: #fff;
            }

            /* --- HERO SECTION --- */
            .hero-section {
              position: relative;
              height: 60vh;
              min-height: 400px;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding: 0 4rem;
              background: linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.5)), 
                          url('https://images.unsplash.com/photo-1498429089284-41f8cf3ffd39?auto=format&fit=crop&q=80&w=1600');
              background-size: cover;
              background-position: center;
              border-radius: 12px;
              color: white;
              overflow: hidden;
              margin-bottom: 3rem;
              box-shadow: 0 10px 30px rgba(0,0,0,0.15);
            }

            .hero-content {
              max-width: 600px;
              z-index: 2;
              animation: slideUp 0.8s ease-out;
            }

            h1 {
              font-size: 3.5rem;
              font-weight: 700;
              margin: 0;
              letter-spacing: -1px;
              line-height: 1.1;
              text-shadow: 0 2px 10px rgba(0,0,0,0.3);
            }

            .subtitle {
              font-size: 1.2rem;
              font-weight: 300;
              margin: 1rem 0 0 0;
              opacity: 0.9;
            }

            /* --- FEATURED PRODUCT (Overlay) --- */
            #heroProduct {
              margin-top: 2rem;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              padding: 2rem;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .badge {
              text-transform: uppercase;
              font-size: 0.7rem;
              letter-spacing: 2px;
              background: #e74c3c;
              padding: 4px 8px;
              border-radius: 2px;
              font-weight: bold;
            }

            .hero-product-content h2 {
              margin: 10px 0;
              font-size: 1.8rem;
            }

            .narrative {
              font-size: 0.95rem;
              line-height: 1.5;
              margin-bottom: 1.5rem;
              opacity: 0.9;
            }

            .meta-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1rem;
              font-size: 0.9rem;
              border-top: 1px solid rgba(255,255,255,0.3);
              padding-top: 10px;
            }

            .cta-btn {
              background: white;
              color: #2c3e50;
              border: none;
              padding: 12px 30px;
              font-size: 1rem;
              font-weight: bold;
              cursor: pointer;
              transition: all 0.2s;
              text-transform: uppercase;
              letter-spacing: 1px;
              width: 100%;
            }

            .cta-btn:hover {
              background: #f1f1f1;
              transform: translateY(-2px);
            }

            /* --- SECONDARY GRID --- */
            .section-title {
              text-align: center;
              font-weight: 300;
              text-transform: uppercase;
              letter-spacing: 3px;
              margin-bottom: 2rem;
              color: #7f8c8d;
              font-size: 0.9rem;
            }

            .grid { 
              display: grid; 
              grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
              gap: 30px; 
              padding-bottom: 4rem;
            }

            .card { 
              background: white; 
              padding: 0;
              border-radius: 0; 
              transition: transform 0.3s ease;
              border-bottom: 1px solid #eee;
            }

            .card:hover {
              transform: translateY(-5px);
            }

            .card-header h3 { 
              margin: 0 0 5px 0; 
              color: #2c3e50; 
              font-size: 1.2rem;
            }

            .card-body {
              padding: 15px 0;
            }

            .feeling {
              font-style: italic;
              color: #7f8c8d;
              font-size: 0.9rem;
              margin: 0 0 15px 0;
            }

            .bottom-row {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .minimal-price {
              font-weight: bold;
              color: #bdc3c7;
              font-size: 0.9rem;
            }

            .text-link {
              background: none;
              border: none;
              color: #2c3e50;
              font-weight: bold;
              cursor: pointer;
              font-size: 0.9rem;
              padding: 0;
              border-bottom: 1px solid transparent;
              transition: border 0.2s;
            }
            
            .text-link:hover {
              border-bottom: 1px solid #2c3e50;
            }

            .text-link:disabled {
              color: #ccc;
              cursor: not-allowed;
              text-decoration: line-through;
            }

            @keyframes slideUp { 
              from { opacity: 0; transform: translateY(20px); } 
              to { opacity: 1; transform: translateY(0); } 
            }

            /* Responsive */
            @media (max-width: 768px) {
              .hero-section { padding: 0 1.5rem; align-items: flex-end; padding-bottom: 2rem; }
              h1 { font-size: 2.5rem; }
            }
        </style>

        <div class="hero-section">
          <div class="hero-content">
            <h1>The Adventure</h1>
            <p class="subtitle">It's not about the destination. It's about the climb.</p>
            <div id="heroProduct"></div>
          </div>
        </div>

        <div class="section-title">Other Routes</div>
        <div id="secondaryGrid" class="grid"></div>
        `;
  }
}

customElements.define('home-page', HomePage);