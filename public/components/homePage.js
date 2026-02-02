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
        grid.innerHTML = 'Loading inventory...';

        try {
            const res = await fetch('/api/inventory');
            const inventory = await res.json();
            
            grid.innerHTML = inventory.map(item => `
                <div class="card">
                    <h3>${item.name}</h3>
                    <p class="stock">${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
                    <p class="price">$${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="${item.id}"
                        ${item.stock <= 0 ? 'disabled' : ''}>
                        ${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            `).join('');

            // Add Event Listeners to Buttons
            this.shadowRoot.querySelectorAll('.buy-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const itemId = e.target.dataset.id;
                    const item = inventory.find(i => i.id === itemId);
                    
                    // Dispatch event to parent (app.js)
                    this.dispatchEvent(new CustomEvent('navigate-order', {
                        detail: { item: item },
                        bubbles: true,
                        composed: true
                    }));
                });
            });

        } catch (e) {
            grid.innerHTML = '<p>Error loading inventory.</p>';
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.3s; }
            .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; font-family: 'Segoe UI', sans-serif; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            .stock { color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Featured Skis</h2>
        <div id="productGrid" class="grid"></div>
        `;
    }
}

customElements.define('home-page', HomePage);