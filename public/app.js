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
    // 1. Parse URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // A. Handle Client ID
    state.clientId = urlParams.get('clientId');
    if (!state.clientId) {
        state.clientId = 'CLIENT-' + Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    }

    // B. Handle Initial Route (Deep Linking support)
    const initialPage = urlParams.get('page') || 'home';
    const itemId = urlParams.get('itemId');

    // 2. Fetch Profile
    try {
        const res = await fetch(`/api/clients/${state.clientId}`);
        if (res.ok) {
            state.clientProfile = await res.json();
            state.deviceId = state.clientProfile.devices && state.clientProfile.devices.length > 0 
                ? state.clientProfile.devices[0] 
                : generateDeviceId();
        } else {
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

    // 4. Load Data & Render
    await loadInventory();

    // 5. Update URL to ensure ClientID is visible, then render initial page
    updateUrl(initialPage, itemId, true); // true = replaceState (don't create history entry for init)
    
    // If deep-linked to order page, we need to set up the selected item
    if (initialPage === 'order' && itemId) {
        selectItemForOrder(itemId);
    }
    
    render(initialPage);
}

function generateDeviceId() {
    return 'DEV-' + Math.floor(Math.random() * 100000);
}

// --- NAVIGATION & HISTORY ---

/**
 * The user-triggered navigation function.
 * Updates History -> Updates URL -> Renders View
 */
function router(pageId, itemId = null) {
    // 1. Update Browser History
    updateUrl(pageId, itemId, false); // false = pushState (create new history entry)
    
    // 2. Render the view
    render(pageId);
}

/**
 * Updates the URL bar and History stack
 */
function updateUrl(pageId, itemId = null, replace = false) {
    const params = new URLSearchParams();
    if (state.clientId) params.set('clientId', state.clientId);
    if (pageId) params.set('page', pageId);
    if (itemId) params.set('itemId', itemId);

    const newUrl = `${window.location.pathname}?${params.toString()}`;

    if (replace) {
        window.history.replaceState({ pageId, itemId }, '', newUrl);
    } else {
        window.history.pushState({ pageId, itemId }, '', newUrl);
    }
}

/**
 * Renders the page based on the ID.
 * Does NOT manipulate history (safe to call from Back Button)
 */
function render(pageId) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
    
    // Show selected
    const activePage = document.getElementById(pageId) || document.getElementById('home');
    activePage.classList.add('active');

    // Trigger specific page logic
    if (pageId === 'history') loadHistory();
}

/**
 * Handle Browser Back/Forward Buttons
 */
window.onpopstate = function(event) {
    if (event.state) {
        // Restore state from history
        if (event.state.pageId === 'order' && event.state.itemId) {
            selectItemForOrder(event.state.itemId);
        }
        render(event.state.pageId);
    } else {
        // Fallback if no state exists
        render('home');
    }
};

// --- DOM LOGIC ---

async function loadInventory() {
    const res = await fetch('/api/inventory');
    state.inventory = await res.json();
    
    const grid = document.getElementById('productGrid');
    grid.innerHTML = state.inventory.map(item => `
        <div class="card">
            <h3>${item.name}</h3>
            <p class="stock">${item.stock > 0 ? 'In Stock: ' + item.stock : 'Out of Stock'}</p>
            <p class="price">$${item.cost * 1.5}</p>
            <button onclick="goToOrderPage('${item.id}')" ${item.stock <= 0 ? 'disabled' : ''}>
                ${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
            </button>
        </div>
    `).join('');
}

// Wrapper to handle navigation to Order page
function goToOrderPage(itemId) {
    selectItemForOrder(itemId);
    router('order', itemId);
}

function selectItemForOrder(itemId) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    state.selectedItem = item;
    const price = item.cost * 1.5; 

    document.getElementById('orderItemName').textContent = item.name;
    document.getElementById('orderItemSku').textContent = item.sku;
    document.getElementById('orderItemPrice').textContent = `$${price}`;
    
    const qtySelect = document.getElementById('orderQty');
    qtySelect.value = "1";
    document.getElementById('orderTotal').textContent = price;

    qtySelect.onchange = () => {
        document.getElementById('orderTotal').textContent = (price * qtySelect.value).toFixed(2);
    };
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
            // Navigate to history after purchase
            router('history');
            loadInventory(); 
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

    orders.reverse(); 

    tbody.innerHTML = orders.map(order => {
        const itemsList = order.items.map(i => `${i.qty}x (Item ${i.itemId.split('-').pop()})`).join(', ');
        
        return `
            <tr>
                <td>${order.id}</td>
                <td>${new Date().toLocaleDateString()}</td>
                <td>${itemsList}</td>
                <td>$${order.orderTotal.toFixed(2)}</td>
                <td class="status-${order.status.toLowerCase()}">${order.status}</td>
            </tr>
        `;
    }).join('');
}

// Run
init();