// STATE
const state = {
    clientId: null,
    deviceId: null,
    clientProfile: null,
    inventory: [],
    selectedItem: null
};

// --- INITIALIZATION ---
async function init() {
    // 1. Get or Create Client ID
    const urlParams = new URLSearchParams(window.location.search);
    state.clientId = urlParams.get('clientId');

    if (!state.clientId) {
        // Generate random ID if none provided
        state.clientId = 'CLIENT-' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        // Update URL without refresh so user sees their new ID
        const newUrl = window.location.pathname + '?clientId=' + state.clientId;
        window.history.pushState({path: newUrl}, '', newUrl);
    }

    // 2. Fetch Profile to get Device/Location info
    try {
        const res = await fetch(`/api/clients/${state.clientId}`);
        if (res.ok) {
            state.clientProfile = await res.json();
            // Use first device if available
            state.deviceId = state.clientProfile.devices && state.clientProfile.devices.length > 0 
                ? state.clientProfile.devices[0] 
                : generateDeviceId();
        } else {
            // New Client (Not in DB yet)
            state.deviceId = generateDeviceId();
        }
    } catch (e) {
        console.error("API Error", e);
        state.deviceId = generateDeviceId();
    }

    // 3. Update UI Header
    document.getElementById('displayClient').textContent = `Client: ${state.clientId}`;
    document.getElementById('displayDevice').textContent = `Device: ${state.deviceId}`;
    document.getElementById('displayLocation').textContent = `Location: ${state.clientProfile ? state.clientProfile.city : 'Unknown (Guest)'}`;

    // 4. Load Inventory
    loadInventory();
}

function generateDeviceId() {
    return 'DEV-' + Math.floor(Math.random() * 100000);
}

// --- ROUTER ---
function router(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    // Show selected
    document.getElementById(pageId).classList.add('active');

    if (pageId === 'history') loadHistory();
}

// --- VIEWS ---

async function loadInventory() {
    const res = await fetch('/api/inventory');
    state.inventory = await res.json();
    
    const grid = document.getElementById('productGrid');
    grid.innerHTML = state.inventory.map(item => `
        <div class="card">
            <h3>${item.name}</h3>
            <p class="stock">${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
            <p class="price">$${item.cost * 1.5}</p> <button onclick="openOrderPage('${item.id}')" ${item.stock <= 0 ? 'disabled' : ''}>
                ${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
            </button>
        </div>
    `).join('');
}

function openOrderPage(itemId) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    state.selectedItem = item;
    const price = item.cost * 1.5; // Markup logic

    document.getElementById('orderItemName').textContent = item.name;
    document.getElementById('orderItemSku').textContent = item.sku;
    document.getElementById('orderItemPrice').textContent = `$${price}`;
    
    // Reset inputs
    const qtySelect = document.getElementById('orderQty');
    qtySelect.value = "1";
    document.getElementById('orderTotal').textContent = price;

    // Calc total on change
    qtySelect.onchange = () => {
        document.getElementById('orderTotal').textContent = (price * qtySelect.value).toFixed(2);
    };

    router('order');
}

async function submitOrder() {
    const qty = parseInt(document.getElementById('orderQty').value);
    const price = state.selectedItem.cost * 1.5;

    const btn = document.getElementById('btnConfirm');
    btn.disabled = true;
    btn.textContent = "Processing...";

    const payload = {
        clientId: state.clientId,
        items: [
            {
                skuId: state.selectedItem.id,
                quantity: qty,
                price: price
            }
        ]
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
            router('history');
            loadInventory(); // Refresh stock counts
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

async function loadHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    const res = await fetch(`/api/orders?clientId=${state.clientId}`);
    const orders = await res.json();

    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No orders found.</td></tr>';
        return;
    }

    // Sort newest first
    orders.reverse(); 

    tbody.innerHTML = orders.map(order => {
        // Helper to format items list
        const itemsList = order.items.map(i => `${i.qty}x (Item ${i.itemId.split('-').pop()})`).join(', ');
        
        return `
            <tr>
                <td>${order.id}</td>
                <td>${new Date().toLocaleDateString()}</td> <td>${itemsList}</td>
                <td>$${order.orderTotal.toFixed(2)}</td>
                <td class="status-${order.status.toLowerCase()}">${order.status}</td>
            </tr>
        `;
    }).join('');
}

// Run
init();