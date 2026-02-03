// STATE
const state = {
  clientId: null,
  deviceId: null,
  clientProfile: null,
  deviceProfile: null,
  inventory: [],
};

// --- INITIALIZATION ---
async function init() {
  const urlParams = new URLSearchParams(window.location.search);

  // 1. Setup Client
  state.clientId = urlParams.get('clientId');
  if (!state.clientId) {
    state.clientId =
      'CLIENT-' +
      Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
  }

  // 2. Fetch Client Profile Info
  try {
    const res = await fetch(`/api/clients/${state.clientId}`);
    if (res.ok) {
      state.clientProfile = await res.json();
      state.deviceId = state.clientProfile.devices?.[0] || generateDeviceId();
    } else {
      state.deviceId = generateDeviceId();
    }
  } catch (e) {
    state.deviceId = generateDeviceId();
  }

  // 3. Fetch Device Profile Info
  try {
    const devRes = await fetch(`/api/devices/${state.deviceId}`);
    if (devRes.ok) {
      state.deviceProfile = await devRes.json();
    } else {
      // Mock if not found in DB yet
      state.deviceProfile = {
        id: state.deviceId,
        browser: navigator.userAgent,
        deviceName: 'Current Session',
      };
    }
  } catch (e) {
    console.log(e);
  }

  // 4. Update UI Header
  document.getElementById(
    'displayClient'
  ).textContent = `Client: ${state.clientId}`;
  document.getElementById(
    'displayDevice'
  ).textContent = `Device: ${state.deviceId}`;
  document.getElementById('displayLocation').textContent = `Location: ${
    state.clientProfile ? state.clientProfile.city : 'Unknown (Guest)'
  }`;

  // 5. Pass Client ID to Order Component
  document
    .getElementById('orderPage')
    .setAttribute('client-id', state.clientId);

  // 6. Initial Route
  const initialPage = urlParams.get('page') || 'home';
  const itemId = urlParams.get('itemId');

  // 7. Initialize Tooltips
  setupTooltips();

  updateUrl(initialPage, itemId, true);
  render(initialPage, itemId);
}

function generateDeviceId() {
  return 'DEV-' + Math.floor(Math.random() * 100000);
}

// --- Initialize Client & Device Info Tooltips ---
function setupTooltips() {
  const tooltip = document.getElementById('detailTooltip');

  const attach = (id, getDataFn) => {
    const el = document.getElementById(id);
    el.addEventListener('mouseenter', () => {
      const data = getDataFn();
      // Pretty print JSON
      tooltip.textContent = JSON.stringify(data, null, 2);
      tooltip.classList.add('visible');
    });
    el.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  };

  // Define what data shows for each span
  attach('displayClient', () => state.clientProfile);
  attach(
    'displayDevice',
    () => state.deviceProfile || { id: state.deviceId, note: 'Not tracked yet' }
  );
  attach('displayLocation', () => ({
    city: state.clientProfile?.city || 'Unknown',
    registered: state.clientProfile?.isRegistered || false,
  }));
}

// --- NAVIGATION HANDLERS ---

// Listen for custom events from Web Components
document.addEventListener('navigate-order', (e) => {
  // The Home Page requests to navigate to Order Page with a specific item
  router('order', e.detail.item.id, e.detail.item);
});

document.addEventListener('navigate-home', () => {
  router('home');
});

document.addEventListener('order-completed', () => {
  // Refresh inventory on home page silently
  const home = document.getElementById('homePage');
  if (home.loadInventory) home.loadInventory();

  router('history');
});

// Standard Router Logic
window.router = function (pageId, itemId = null, itemObj = null) {
  updateUrl(pageId, itemId);
  render(pageId, itemId, itemObj);
};

function updateUrl(pageId, itemId = null, replace = false) {
  const params = new URLSearchParams();
  if (state.clientId) params.set('clientId', state.clientId);
  if (pageId) params.set('page', pageId);
  if (itemId) params.set('itemId', itemId);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  replace
    ? window.history.replaceState({ pageId, itemId }, '', newUrl)
    : window.history.pushState({ pageId, itemId }, '', newUrl);
}

window.onpopstate = function (event) {
  if (event.state) render(event.state.pageId, event.state.itemId);
  else render('home');
};

async function render(pageId, itemId, itemObj = null) {
  const homeEl = document.getElementById('homePage');
  const orderEl = document.getElementById('orderPage');
  const historyEl = document.getElementById('historyPage');

  // Reset visibility
  homeEl.classList.add('hidden');
  orderEl.classList.add('hidden');
  historyEl.classList.add('hidden');

  if (pageId === 'home') {
    homeEl.classList.remove('hidden');
  } else if (pageId === 'order') {
    orderEl.classList.remove('hidden');

    // Ensure data is loaded into component
    if (itemObj) {
      orderEl.loadItem(itemObj);
    } else if (itemId) {
      // If deep linked, fetch item data first
      const res = await fetch('/api/inventory');
      const inventory = await res.json();
      const item = inventory.find((i) => i.id === itemId);
      if (item) orderEl.loadItem(item);
    }
  } else if (pageId === 'history') {
    historyEl.classList.remove('hidden');
    loadHistory();
  }
}

// History Page Logic (kept in main app as requested implicitly)
async function loadHistory() {
  const tbody = document.getElementById('historyBody');
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  const res = await fetch(`/api/orders?clientId=${state.clientId}`);
  const orders = await res.json();
  if (orders.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center">No orders found.</td></tr>';
    return;
  }
  orders.reverse();
  tbody.innerHTML = orders
    .map(
      (order) => `
        <tr>
            <td>${order.id}</td>
            <td>${new Date().toLocaleDateString()}</td>
            <td>${order.items.map((i) => `${i.qty}x`).join(', ')}</td>
            <td>$${order.orderTotal.toFixed(2)}</td>
            <td class="status-${order.status.toLowerCase()}">${
        order.status
      }</td>
        </tr>
    `
    )
    .join('');
}

init();
