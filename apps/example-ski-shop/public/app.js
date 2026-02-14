// STATE
const state = {
  clientId: null,
  deviceId: null,
  clientProfile: null,
  deviceProfile: null,
  inventory: [],
};

// EXPOSE STATE GLOBALLY (Required for Dynamic Components)
window.state = state;

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
  const orderPage = document.getElementById('orderPage');
  if (orderPage) {
    orderPage.setAttribute('client-id', state.clientId);
  }

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
    if (!el) return;
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

document.addEventListener('navigate-order', (e) => {
  router('order', e.detail.item.id, e.detail.item);
});

document.addEventListener('navigate-home', () => {
  router('home');
});

document.addEventListener('order-completed', () => {
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
  const params = new URLSearchParams(window.location.search);
  
  if (state.clientId) params.set('clientId', state.clientId);
  if (pageId) params.set('page', pageId);
  
  if (itemId) {
    params.set('itemId', itemId);
  } else {
    params.delete('itemId');
  }

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
  if(homeEl) homeEl.classList.add('hidden');
  if(orderEl) orderEl.classList.add('hidden');
  if(historyEl) historyEl.classList.add('hidden');

  if (pageId === 'home') {
    if(homeEl) homeEl.classList.remove('hidden');
  } else if (pageId === 'order') {
    if(orderEl) orderEl.classList.remove('hidden');

    if (itemObj) {
      if(orderEl.loadItem) orderEl.loadItem(itemObj);
    } else if (itemId) {
      const res = await fetch('/api/inventory');
      const inventory = await res.json();
      const item = inventory.find((i) => i.id === itemId);
      if (item && orderEl.loadItem) orderEl.loadItem(item);
    }
  } else if (pageId === 'history') {
    if(historyEl) historyEl.classList.remove('hidden');
    loadHistory();
  }
}

async function loadHistory() {
  const tbody = document.getElementById('historyBody');
  if(!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';
  try {
    const res = await fetch(`/api/orders?clientId=${state.clientId}`);
    const orders = await res.json();
    if (!orders || orders.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center">No orders found.</td></tr>';
      return;
    }
    // Reverse logic without mutating if possible, but standard array reverse is fine here
    orders.reverse();
    tbody.innerHTML = orders
      .map(
        (order) => `
          <tr>
              <td>${order.id}</td>
              <td>${new Date().toLocaleDateString()}</td>
              <td>${order.items.map((i) => `${i.qty}x`).join(', ')}</td>
              <td>$${(order.orderTotal || 0).toFixed(2)}</td>
              <td class="status-${(order.status || '').toLowerCase()}">${
          order.status
        }</td>
          </tr>
      `
      )
      .join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5">Error loading history.</td></tr>';
  }
}

init();