class OrderPage extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.selectedItem = null;
        this.clientId = null;
    }

    connectedCallback() {
        this.render();
        this.clientId = this.getAttribute('client-id');
    }

    static get observedAttributes() {
        return ['client-id'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'client-id') {
            this.clientId = newValue;
        }
    }

    // Public method called by Router
    loadItem(item) {
        this.selectedItem = item;
        const price = item.cost * 1.5;

        // Populate DOM in Shadow Root
        const root = this.shadowRoot;
        root.getElementById('orderItemName').textContent = item.name;
        root.getElementById('orderItemSku').textContent = item.sku;
        root.getElementById('orderItemPrice').textContent = `$${price}`;
        root.getElementById('orderTotal').textContent = price;
        
        const qtySelect = root.getElementById('orderQty');
        qtySelect.value = "1";

        qtySelect.onchange = () => {
            root.getElementById('orderTotal').textContent = (price * qtySelect.value).toFixed(2);
        };
    }

    async submitOrder() {
        const root = this.shadowRoot;
        const qty = parseInt(root.getElementById('orderQty').value);
        const price = this.selectedItem.cost * 1.5;
        const btn = root.getElementById('btnConfirm');

        btn.disabled = true;
        btn.textContent = "Processing...";

        const payload = {
            clientId: this.clientId,
            items: [{ skuId: this.selectedItem.id, quantity: qty, price: price }]
        };

        try {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();

            if (data.success) {
                alert("Order Confirmed! ID: " + data.orderId);
                this.dispatchEvent(new CustomEvent('order-completed', { bubbles: true, composed: true }));
            } else {
                alert("Error: " + data.error);
            }
        } catch (e) {
            alert("Network Error");
        } finally {
            btn.disabled = false;
            btn.textContent = "Confirm Purchase";
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
        <style>
            :host { display: block; animation: fadeIn 0.3s; font-family: 'Segoe UI', sans-serif; }
            .card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); text-align: center; max-width: 500px; margin: 0 auto; text-align: left; }
            .card h3 { margin: 0 0 10px 0; color: #2c3e50; }
            .price { font-size: 1.2rem; color: #e74c3c; font-weight: bold; }
            hr { border: 0; border-top: 1px solid #eee; margin: 15px 0; }
            button { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; width: 100%; font-size: 1rem; margin-top: 10px; }
            button:hover { background: #2980b9; }
            button:disabled { background: #ccc; cursor: not-allowed; }
            .cancel-btn { background: #95a5a6; }
            .cancel-btn:hover { background: #7f8c8d; }
            select { width: 100%; padding: 8px; margin: 10px 0; border: 1px solid #ccc; border-radius: 4px; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>

        <h2>Complete Your Order</h2>
        <div class="card">
            <h3 id="orderItemName">Ski Name</h3>
            <p>SKU: <span id="orderItemSku"></span></p>
            <p>Price: <span id="orderItemPrice" class="price"></span></p>
            <hr>
            <label>Quantity:</label>
            <select id="orderQty">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
            </select>
            <button id="btnConfirm">Confirm Purchase ($<span id="orderTotal"></span>)</button>
            <button class="cancel-btn" id="btnCancel">Cancel</button>
        </div>
        `;

        this.shadowRoot.getElementById('btnConfirm').onclick = () => this.submitOrder();
        this.shadowRoot.getElementById('btnCancel').onclick = () => {
            this.dispatchEvent(new CustomEvent('navigate-home', { bubbles: true, composed: true }));
        };
    }
}

customElements.define('order-page', OrderPage);