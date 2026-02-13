// Global State simulating a logged-in user session
const state = {
    userId: 'u1',
    currentOrderId: null
};

// Simple Router
function router(page) {
    const app = document.getElementById('app');
    app.innerHTML = ''; // Clear page

    switch (page) {
        case 'home': renderHome(); break;
        case 'profile': renderProfile(); break;
        case 'history': renderHistory(); break;
        case 'checkout': renderCheckout(); break;
        default: renderHome();
    }
}

// --- Views ---

async function renderHome() {
    const app = document.getElementById('app');
    const res = await fetch('/api/products');
    const products = await res.json();

    let html = `<h2>Products</h2><div class="product-list">`;
    products.forEach(p => {
        html += `
            <div class="card">
                <h3>${p.name}</h3>
                <p>$${p.price}</p>
                <button onclick="addToCart('${p.id}')">Add to Order</button>
            </div>`;
    });
    html += `</div>`;
    
    // Check if we need to start an order button
    if (state.currentOrderId) {
        html += `<br><button class="btn-checkout" onclick="router('checkout')">Proceed to Checkout</button>`;
    } else {
        html += `<p><em>Start adding items to create an order.</em></p>`;
    }
    app.innerHTML = html;
}

async function renderProfile() {
    const res = await fetch(`/api/users/${state.userId}`);
    const user = await res.json();
    document.getElementById('app').innerHTML = `
        <h2>User Profile</h2>
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>ID:</strong> ${user.id}</p>
    `;
}

async function renderHistory() {
    const res = await fetch(`/api/history/${state.userId}`);
    const orders = await res.json();
    
    let html = `<h2>Past Orders (Read Model)</h2><ul>`;
    orders.forEach(o => {
        html += `<li>Order #${o.id} - Status: ${o.status} - Total: $${o.total}</li>`;
    });
    html += `</ul>`;
    document.getElementById('app').innerHTML = html;
}

async function renderCheckout() {
    if (!state.currentOrderId) {
        return router('home');
    }
    document.getElementById('app').innerHTML = `
        <h2>Checkout</h2>
        <p>Completing order: ${state.currentOrderId}</p>
        <button onclick="completeCheckout()">Confirm Purchase</button>
    `;
}

// --- Actions ---

async function addToCart(productId) {
    // 1. Create order if it doesn't exist
    if (!state.currentOrderId) {
        const res = await fetch('/api/orders/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: state.userId })
        });
        const data = await res.json();
        state.currentOrderId = data.orderId;
        document.getElementById('current-order-id').innerText = state.currentOrderId;
    }

    // 2. Add item
    await fetch(`/api/orders/${state.currentOrderId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId })
    });
    
    alert('Item added!');
    router('home'); // Refresh to show checkout button
}

async function completeCheckout() {
    await fetch(`/api/orders/${state.currentOrderId}/checkout`, {
        method: 'POST'
    });
    alert('Order Completed!');
    state.currentOrderId = null;
    document.getElementById('current-order-id').innerText = "None";
    router('history');
}

// Init
router('home');