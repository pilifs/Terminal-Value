import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: '',
});

const generation_config = {
  temperature: 1.0,
};

const text = `
You are a partner at a big 4 consulting firm hired by the world's leading ski shop (Fil's Alpine Ski Shop) to increase sales among their highest-value customers. Your task is to create personalized web components, marketing images, and ad copy that will resonate with each client's unique profile and shopping behavior. It is critical that this campaign do whatever it takes to boost sales. 
    You have a full team at your disposal (analyst, graphic designer, copywriter, web developer, marketing specialist, domain subject matter expert, etc.) to help with this.
    Supply is limited on high-demand racing ski gear, so focus on driving urgency and exclusivity where possible. The price should be as high as possible to drive revenue. Focus on capturing the user's emotions and generating perceived value via a hyper-personalized digital experience.
    
    The high value client we are targeting is 32 years old and based in Aspen. Our executive sales team has made the following notes in the internal ski shop CRM database: "Former pro racer, extremely technical about edge tuning. Only skis on hardpack groomers. Prefers stiff boots and high DIN bindings.". These are the backbone of our sales strategy that should be reflected in the end result digital experience.
    
    It is critical that you do not break the base experience. The client must be able to purchase products as normal, but make whatever presentation changes it takes to drive more revenue.
          Deliver an output of a custom LitElement/HTMLElement JavaScript class named 'Home' for this particular high value client that we will serve instead of the regular home page when they visit the site.

================================================================================
BELOW IS THE EXISTING CODEBASE FOR THE SKI SHOP SITE (excluding dynamic folders)
================================================================================

// --- FILE: admin.html ---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Ski Shop Admin</title>
    <style>
      body {
        font-family: 'Segoe UI', sans-serif;
        background: #2c3e50;
        color: #ecf0f1;
        padding: 20px;
      }
      .container {
        max-width: 1100px;
        margin: 0 auto;
        background: #34495e;
        padding: 20px;
        border-radius: 8px;
      }
      h1 {
        border-bottom: 1px solid #7f8c8d;
        padding-bottom: 10px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 20px;
        background: #ecf0f1;
        color: #2c3e50;
        border-radius: 4px;
        overflow: hidden;
      }
      th,
      td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #bdc3c7;
      }
      th {
        background: #e67e22;
        color: white;
        cursor: pointer;
      }
      tr:hover {
        background: #dcdde1;
      }
      .registered {
        color: #27ae60;
        font-weight: bold;
      }
      .guest {
        color: #7f8c8d;
        font-style: italic;
      }
      .money {
        font-family: 'Consolas', monospace;
        font-weight: bold;
        color: #2c3e50;
      }
      .stats-bar {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
      }
      .stat-box {
        background: #2980b9;
        padding: 15px;
        border-radius: 4px;
        flex: 1;
        text-align: center;
      }
      .stat-val {
        font-size: 2rem;
        font-weight: bold;
      }
      a.impersonate-btn {
        text-decoration: none;
        background: #2980b9;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
      }
      a.impersonate-btn:hover {
        background: #3498db;
      }
      .notes-btn {
        background: #8e44ad;
        color: white;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
      }
      .notes-btn:hover {
        background: #9b59b6;
      }

      /* UX Badge Styles */
      .ux-btn {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 0.75rem;
        padding: 2px 6px;
        border-radius: 4px;
        margin-right: 4px;
        color: white;
      }
      .ux-home {
        background: #d35400;
      }
      .ux-order {
        background: #16a085;
      }
      .ux-none {
        color: #ccc;
        font-style: italic;
      }
      .ux-btn:hover {
        opacity: 0.8;
      }

      /* Modal Styles */
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        overflow: auto;
        background-color: rgba(0, 0, 0, 0.6);
        align-items: center;
        justify-content: center;
      }
      .modal.visible {
        display: flex;
        animation: fadeIn 0.2s;
      }
      .modal-content {
        background-color: #fefefe;
        color: #2c3e50;
        padding: 20px;
        border-radius: 8px;
        width: 80%;
        max-width: 500px;
        position: relative;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
      }
      .close-btn {
        color: #aaa;
        float: right;
        font-size: 28px;
        font-weight: bold;
        cursor: pointer;
        line-height: 20px;
      }
      .close-btn:hover {
        color: black;
      }
      #modalTitle {
        margin-top: 0;
        border-bottom: 1px solid #eee;
        padding-bottom: 10px;
        margin-bottom: 15px;
      }
      ul.version-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      ul.version-list li {
        margin-bottom: 10px;
      }
      /* Updated styles for labels to act like the previous links */
      ul.version-list label {
        display: block;
        padding: 8px 12px;
        background: #ecf0f1;
        color: #2c3e50;
        cursor: pointer;
        border-radius: 4px;
        border-left: 5px solid #bdc3c7;
        transition: 0.2s;
      }
      ul.version-list label:hover {
        background: #dfe6e9;
        border-left-color: #2980b9;
      }
      /* Ensure radio buttons have spacing */
      ul.version-list input[type='radio'] {
        margin-right: 10px;
        cursor: pointer;
      }

      .version-tag {
        font-family: monospace;
        font-weight: bold;
        color: #e67e22;
      }

      /* Navigation Button Style */
      .nav-custom-btn {
        background: #27ae60;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
      }
      .nav-custom-btn:hover {
        background: #2ecc71;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>⛷️ Ski Shop Admin Panel</h1>
      <div class="stats-bar">
        <div class="stat-box">
          <div>Total Clients</div>
          <div id="totalClients" class="stat-val">-</div>
        </div>
        <div class="stat-box">
          <div>Registered Members</div>
          <div id="totalRegistered" class="stat-val">-</div>
        </div>
        <div class="stat-box" style="background: #27ae60">
          <div>Total Revenue</div>
          <div id="totalRevenue" class="stat-val">-</div>
        </div>
      </div>

      <h3>Client Database (Top Spenders)</h3>
      <table>
        <thead>
          <tr>
            <th width="150">ID</th>
            <th>Status</th>
            <th>City</th>
            <th>Age</th>
            <th>Purchases</th>
            <th>CRM Notes</th>
            <th>Custom UX</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="clientTable">
          <tr>
            <td colspan="8">Loading data...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div id="noteModal" class="modal">
      <div class="modal-content">
        <span class="close-btn" onclick="closeModal('noteModal')">&times;</span>
        <h3 id="noteModalTitle">Notes</h3>
        <ul id="noteList" style="padding-left: 20px"></ul>
      </div>
    </div>

    <div id="uxModal" class="modal">
      <div class="modal-content">
        <span class="close-btn" onclick="closeModal('uxModal')">&times;</span>
        <h3 id="uxModalTitle">Custom Interface Versions</h3>
        <p style="color: #7f8c8d; font-size: 0.9rem; margin-bottom: 15px">
          Select a version configuration to launch.
        </p>

        <h4 style="margin: 10px 0 5px 0; border-bottom: 1px solid #eee">
          Home Page Variants
        </h4>
        <ul id="homeVersionList" class="version-list"></ul>

        <h4 style="margin: 20px 0 5px 0; border-bottom: 1px solid #eee">
          Order Page Variants
        </h4>
        <ul id="orderVersionList" class="version-list"></ul>

        <div
          style="
            margin-top: 25px;
            text-align: right;
            border-top: 1px solid #eee;
            padding-top: 15px;
          "
        >
          <button onclick="navigateCustom()" class="nav-custom-btn">
            Navigate to custom page ↗
          </button>
        </div>
      </div>
    </div>

    <script>
      window.clientsMap = new Map();
      let currentUxClientId = null;

      async function init() {
        const statsRes = await fetch('/api/dashboard');
        const stats = await statsRes.json();
        document.getElementById('totalRevenue').textContent = formatMoney(
          stats.totalRevenue
        );

        const res = await fetch('/api/clients');
        let clients = await res.json();

        document.getElementById('totalClients').textContent = clients.length;
        document.getElementById('totalRegistered').textContent = clients.filter(
          (c) => c.isRegistered
        ).length;

        clients.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
        clients.forEach((c) => window.clientsMap.set(c.id, c));

        const tbody = document.getElementById('clientTable');
        tbody.innerHTML = clients
          .map((c) => {
            const actionButton =
              c.id && c.id !== 'undefined'
                ? \`<a href="/?clientId=\${c.id}" target="_blank" class="impersonate-btn">Impersonate ↗</a>\`
                : \`<span style="color:#ccc">N/A</span>\`;

            let notesButton = \`<span style="color:#ccc">-</span>\`;
            if (c.crmNotes && c.crmNotes.length > 0) {
              notesButton = \`<button class="notes-btn" onclick="openNoteModal('\${c.id}')">View (\${c.crmNotes.length})</button>\`;
            }

            let uxBadges = '';
            const hasHome =
              c.customHomeVersions && c.customHomeVersions.length > 0;
            const hasOrder =
              c.customOrderVersions && c.customOrderVersions.length > 0;

            if (hasHome) {
              uxBadges += \`<button class="ux-btn ux-home" onclick="openUxModal('\${c.id}')">Home (\${c.customHomeVersions.length})</button>\`;
            }
            if (hasOrder) {
              uxBadges += \`<button class="ux-btn ux-order" onclick="openUxModal('\${c.id}')">Order (\${c.customOrderVersions.length})</button>\`;
            }
            if (!hasHome && !hasOrder)
              uxBadges = \`<span class="ux-none">-</span>\`;

            return \`
                <tr>
                    <td>\${c.id || 'Unknown'}</td>
                    <td class="\${c.isRegistered ? 'registered' : 'guest'}">\${
              c.isRegistered ? 'MEMBER' : 'GUEST'
            }</td>
                    <td>\${c.city || '-'}</td>
                    <td>\${c.age || '-'}</td>
                    <td class="money">\${formatMoney(c.totalSpent)}</td>
                    <td>\${notesButton}</td>
                    <td>\${uxBadges}</td>
                    <td>\${actionButton}</td>
                </tr>
            \`;
          })
          .join('');
      }

      function formatMoney(amount) {
        return (
          '$' +
          (amount || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }

      function openNoteModal(clientId) {
        const client = window.clientsMap.get(clientId);
        if (!client) return;
        document.getElementById(
          'noteModalTitle'
        ).textContent = \`Notes for \${client.id}\`;
        document.getElementById('noteList').innerHTML = client.crmNotes
          .map((n) => \`<li>\${n}</li>\`)
          .join('');
        document.getElementById('noteModal').classList.add('visible');
      }

      function openUxModal(clientId) {
        currentUxClientId = clientId;
        const client = window.clientsMap.get(clientId);
        if (!client) return;

        document.getElementById(
          'uxModalTitle'
        ).textContent = \`UX Versions: \${client.id}\`;

        // Function to create radio button HTML
        const createRadio = (hash, group, isDefault = false) => {
          const val = isDefault ? '' : hash;
          const display = isDefault
            ? 'Standard / Default'
            : \`Version: <span class="version-tag">\${hash.substring(
                0,
                8
              )}...</span>\`;
          const checked = isDefault ? 'checked' : '';

          return \`
             <li>
               <label>
                 <input type="radio" name="\${group}" value="\${val}" \${checked}>
                 \${display}
               </label>
             </li>\`;
        };

        // Render Home Options
        const homeList = document.getElementById('homeVersionList');
        let homeHtml = createRadio(null, 'homeHash', true); // Default option
        if (client.customHomeVersions && client.customHomeVersions.length) {
          homeHtml += client.customHomeVersions
            .map((h) => createRadio(h, 'homeHash'))
            .join('');
        }
        homeList.innerHTML = homeHtml;

        // Render Order Options
        const orderList = document.getElementById('orderVersionList');
        let orderHtml = createRadio(null, 'orderHash', true); // Default option
        if (client.customOrderVersions && client.customOrderVersions.length) {
          orderHtml += client.customOrderVersions
            .map((h) => createRadio(h, 'orderHash'))
            .join('');
        }
        orderList.innerHTML = orderHtml;

        document.getElementById('uxModal').classList.add('visible');
      }

      function navigateCustom() {
        if (!currentUxClientId) return;

        // Helper to get checked value
        const getSelected = (name) => {
          const el = document.querySelector(\`input[name="\${name}"]:checked\`);
          return el ? el.value : '';
        };

        const homeHash = getSelected('homeHash');
        const orderHash = getSelected('orderHash');

        let url = \`/?clientId=\${currentUxClientId}\`;

        if (homeHash) {
          url += \`&homeHash=\${homeHash}\`;
        }

        if (orderHash) {
          url += \`&orderHash=\${orderHash}\`;
        }

        window.open(url, '_blank');
      }

      function closeModal(id) {
        document.getElementById(id).classList.remove('visible');
      }

      window.onclick = function (event) {
        if (event.target.classList.contains('modal')) {
          event.target.classList.remove('visible');
        }
      };

      init();
    </script>
  </body>
</html>


// --- FILE: app.js ---
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
    const res = await fetch(\`/api/clients/\${state.clientId}\`);
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
    const devRes = await fetch(\`/api/devices/\${state.deviceId}\`);
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
  ).textContent = \`Client: \${state.clientId}\`;
  document.getElementById(
    'displayDevice'
  ).textContent = \`Device: \${state.deviceId}\`;
  document.getElementById('displayLocation').textContent = \`Location: \${
    state.clientProfile ? state.clientProfile.city : 'Unknown (Guest)'
  }\`;

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
  // Preserve existing params (like homeHash, orderHash) by initializing with window.location.search
  const params = new URLSearchParams(window.location.search);
  
  if (state.clientId) params.set('clientId', state.clientId);
  if (pageId) params.set('page', pageId);
  
  if (itemId) {
    params.set('itemId', itemId);
  } else {
    params.delete('itemId');
  }

  const newUrl = \`\${window.location.pathname}?\${params.toString()}\`;
  
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
  const res = await fetch(\`/api/orders?clientId=\${state.clientId}\`);
  const orders = await res.json();
  if (orders.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center">No orders found.</td></tr>';
    return;
  }
  orders.reverse();
  tbody.innerHTML = orders
    .map(
      (order) => \`
        <tr>
            <td>\${order.id}</td>
            <td>\${new Date().toLocaleDateString()}</td>
            <td>\${order.items.map((i) => \`\${i.qty}x\`).join(', ')}</td>
            <td>$\${order.orderTotal.toFixed(2)}</td>
            <td class="status-\${order.status.toLowerCase()}">\${
        order.status
      }</td>
        </tr>
    \`
    )
    .join('');
}

init();

// --- FILE: components\\homePage.js ---
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

      grid.innerHTML = inventory
        .map(
          (item) => \`
                <div class="card">
                    <h3>\${item.name}</h3>
                    <p class="stock">\${
                      item.stock > 0
                        ? 'In Stock: ' + item.stock
                        : 'Out of Stock'
                    }</p>
                    <p class="price">$\${item.cost * 1.5}</p>
                    <button 
                        class="buy-btn" 
                        data-id="\${item.id}"
                        \${item.stock <= 0 ? 'disabled' : ''}>
                        \${item.stock > 0 ? 'Buy Now' : 'Sold Out'}
                    </button>
                </div>
            \`
        )
        .join('');

      // Add Event Listeners to Buttons
      this.shadowRoot.querySelectorAll('.buy-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const itemId = e.target.dataset.id;
          const item = inventory.find((i) => i.id === itemId);

          // Dispatch event to parent (app.js)
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
      grid.innerHTML = '<p>Error loading inventory.</p>';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
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
        \`;
  }
}

customElements.define('home-page', HomePage);


// --- FILE: components\\orderPage.js ---
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
    root.getElementById('orderItemPrice').textContent = \`$\${price}\`;
    root.getElementById('orderTotal').textContent = price;

    const qtySelect = root.getElementById('orderQty');
    qtySelect.value = '1';

    qtySelect.onchange = () => {
      root.getElementById('orderTotal').textContent = (
        price * qtySelect.value
      ).toFixed(2);
    };
  }

  async submitOrder() {
    const root = this.shadowRoot;
    const qty = parseInt(root.getElementById('orderQty').value);
    const price = this.selectedItem.cost * 1.5;
    const btn = root.getElementById('btnConfirm');

    btn.disabled = true;
    btn.textContent = 'Processing...';

    const payload = {
      clientId: this.clientId,
      items: [{ skuId: this.selectedItem.id, quantity: qty, price: price }],
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        alert('Order Confirmed! ID: ' + data.orderId);
        this.dispatchEvent(
          new CustomEvent('order-completed', { bubbles: true, composed: true })
        );
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Network Error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Confirm Purchase';
    }
  }

  render() {
    this.shadowRoot.innerHTML = \`
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
        \`;

    this.shadowRoot.getElementById('btnConfirm').onclick = () =>
      this.submitOrder();
    this.shadowRoot.getElementById('btnCancel').onclick = () => {
      this.dispatchEvent(
        new CustomEvent('navigate-home', { bubbles: true, composed: true })
      );
    };
  }
}

customElements.define('order-page', OrderPage);


// --- FILE: index.html ---
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Alpine Ski Shop</title>
    <style>
      /* ... Existing Styles ... */
      body {
        font-family: 'Segoe UI', sans-serif;
        margin: 0;
        padding: 0;
        background: #f4f7f6;
        color: #333;
      }
      header {
        background: #2c3e50;
        color: white;
        padding: 1rem 2rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      header nav a {
        color: #ecf0f1;
        text-decoration: none;
        margin-left: 20px;
        font-weight: bold;
        cursor: pointer;
      }
      header nav a:hover {
        text-decoration: underline;
      }
      .container {
        max-width: 1000px;
        margin: 2rem auto;
        padding: 0 1rem;
      }
      .client-info {
        background: #fff;
        padding: 10px 2rem;
        border-bottom: 1px solid #ddd;
        font-size: 0.9rem;
        display: flex;
        gap: 20px;
        color: #555;
        position: relative;
      }
      .hidden {
        display: none !important;
      }
      .info-hover {
        cursor: help;
        border-bottom: 1px dotted #aaa;
        position: relative;
      }
      .info-hover:hover {
        color: #2c3e50;
        font-weight: bold;
      }
      #detailTooltip {
        position: absolute;
        top: 45px;
        left: 20px;
        background: #2c3e50;
        color: #ecf0f1;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        min-width: 250px;
        white-space: pre-wrap;
        font-family: 'Consolas', monospace;
        font-size: 0.8rem;
        display: none;
      }
      #detailTooltip.visible {
        display: block;
        animation: fadeIn 0.2s;
      }

      /* Table styles for history */
      table {
        width: 100%;
        border-collapse: collapse;
        background: white;
        border-radius: 8px;
        overflow: hidden;
      }
      th,
      td {
        padding: 12px 15px;
        text-align: left;
        border-bottom: 1px solid #ddd;
      }
      th {
        background: #ecf0f1;
      }
      .status-confirmed {
        color: green;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <header>
      <div>🎿 <strong>Alpine Ski Shop</strong></div>
      <nav>
        <a onclick="router('home')">Shop</a>
        <a onclick="router('history')">My Orders</a>
      </nav>
    </header>

    <div class="client-info">
      <span id="displayClient" class="info-hover">Client: ...</span>
      <span id="displayDevice" class="info-hover">Device: ...</span>
      <span id="displayLocation" class="info-hover">Location: ...</span>
      <div id="detailTooltip"></div>
    </div>

    <div class="container">
      <home-page id="homePage"></home-page>
      <order-page id="orderPage" class="hidden"></order-page>
      <div id="historyPage" class="hidden">
        <h2>Purchase History</h2>
        <table id="historyTable">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="historyBody"></tbody>
        </table>
      </div>
    </div>

    <script type="module">
      (async function () {
        const params = new URLSearchParams(window.location.search);
        const clientId = params.get('clientId');

        // --- VERSION CONTROL ---
        // 1. Check URL for specific version override
        // 2. Fallback to 'legacy' (or hardcoded default)
        const HOME_COMPONENT_HASH = params.get('homeHash') || 'legacy';
        const ORDER_COMPONENT_HASH = params.get('orderHash') || 'legacy';

        const getComponentSrc = async (
          defaultSrc,
          dynamicFolder,
          fileName,
          targetHash
        ) => {
          if (clientId && targetHash) {
            // Construct path: ./components/dynamicHome/{hash}/homePage-{id}.js
            const dynamicSrc = \`\${dynamicFolder}/\${targetHash}/\${fileName}\`;
            try {
              const response = await fetch(dynamicSrc, { method: 'HEAD' });
              if (response.ok) {
                console.log(
                  \`%c Loaded Dynamic Component (\${targetHash})\`,
                  'color: green; font-weight: bold;'
                );
                return dynamicSrc;
              }
            } catch (e) {
              console.warn(
                \`Dynamic component not found in \${targetHash}, using default.\`
              );
            }
          }
          return defaultSrc;
        };

        const [homeSrc, orderSrc] = await Promise.all([
          getComponentSrc(
            './components/homePage.js',
            './components/dynamicHome',
            \`homePage-\${clientId}.js\`,
            HOME_COMPONENT_HASH
          ),
          getComponentSrc(
            './components/orderPage.js',
            './components/dynamicOrder',
            \`orderPage-\${clientId}.js\`,
            ORDER_COMPONENT_HASH
          ),
        ]);

        await import(homeSrc);
        await import(orderSrc);
      })();
    </script>

    <script src="app.js"></script>
  </body>
</html>

`;

async function main() {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: text,
    config: {
      temperature: 1.0,
    },
  });
  console.log(response.text);
}

await main();
