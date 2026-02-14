import initialDb from '../store/db.js';

// --- POLYFILLS (Node.js Support) ---
// Allows this client-side code to run in a Node environment without crashing
if (typeof window === 'undefined') {
  global.window = global; // Allow attaching to window.fetch

  // Mock window.location for URL construction
  global.window.location = { origin: 'http://localhost:3000' };

  // Mock LocalStorage (In-Memory)
  if (typeof localStorage === 'undefined') {
    class InMemoryStorage {
      constructor() {
        this.store = new Map();
      }
      getItem(key) {
        return this.store.get(key) || null;
      }
      setItem(key, value) {
        this.store.set(key, String(value));
      }
      removeItem(key) {
        this.store.delete(key);
      }
      clear() {
        this.store.clear();
      }
    }
    global.localStorage = new InMemoryStorage();
  }

  // Mock Response object if missing (Node < 18)
  if (typeof Response === 'undefined') {
    global.Response = class Response {
      constructor(body, init) {
        this.body = body;
        this.status = init?.status || 200;
        this.headers = init?.headers || {};
      }
    };
  }
}

// --- CONFIGURATION ---
const AVAILABLE_VERSIONS = {
  Home: [
    'f2ab68d7d8446ac0e372a886a3dcd79589def7a00c3ca538468e6bd68496ce7f',
    '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
  ],
  Order: [
    '76c5c136c580bd77f94d8043f0fa45839e6ab527deb6ee22d82ce2ef0ea1a2ce',
    '0a4b6faa8e907688e098cad4a511fba633c94e4f6d1a6374bb2ac9cfc968b17a',
  ],
};

// --- STATE MANAGEMENT ---
const STORAGE_KEY = 'ski_shop_sandbox_db';

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return JSON.parse(JSON.stringify(initialDb)); // Deep copy seed data
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Global in-memory state
const db = loadState();

// --- HELPER LOGIC ---

function getComponentVersions(type, clientId) {
  // Optimistic versioning for sandbox demo
  return AVAILABLE_VERSIONS[type] || [];
}

// --- MOCK API HANDLERS ---

const handlers = {
  'GET /api/inventory': () => {
    return { status: 200, body: db.inventory };
  },

  'GET /api/dashboard': () => {
    return { status: 200, body: db.dashboard };
  },

  'GET /api/clients': (params) => {
    let clients = db.clients;

    if (params.city) {
      clients = clients.filter((c) => c.city === params.city);
    }

    const augmented = clients.map((c) => ({
      ...c,
      customHomeVersions: getComponentVersions('Home', c.id),
      customOrderVersions: getComponentVersions('Order', c.id),
    }));

    return { status: 200, body: augmented };
  },

  'GET /api/clients/:id': (params, id) => {
    const client = db.clients.find((c) => c.id === id);
    if (!client) return { status: 404, body: { error: 'Client not found' } };
    return { status: 200, body: client };
  },

  'GET /api/devices/:id': (params, id) => {
    const device = db.devices.find((d) => d.id === id);
    if (!device) return { status: 404, body: { error: 'Device not found' } };
    return { status: 200, body: device };
  },

  'GET /api/orders': (params) => {
    if (!params.clientId)
      return { status: 400, body: { error: 'Please provide ?clientId=' } };
    const orders = db.orders.filter((o) => o.clientId === params.clientId);
    return { status: 200, body: orders };
  },

  'POST /api/orders': (params, id, body) => {
    const { clientId, items } = body;

    const orderId = `ORDER-${Math.floor(Math.random() * 10000000)}`;
    let orderTotal = 0;
    const orderItems = items.map((i) => {
      orderTotal += i.price * i.quantity;
      return {
        itemId: i.skuId,
        qty: i.quantity,
        price: i.price,
      };
    });

    const newOrder = {
      id: orderId,
      type: 'PURCHASE',
      clientId: clientId,
      status: 'CONFIRMED',
      items: orderItems,
      orderTotal: orderTotal,
    };

    db.orders.push(newOrder);

    // Update Inventory
    items.forEach((orderItem) => {
      const invItem = db.inventory.find((i) => i.id === orderItem.skuId);
      if (invItem) {
        invItem.stock = Math.max(0, invItem.stock - orderItem.quantity);
      }
    });

    // Update Stats
    db.dashboard.totalRevenue += orderTotal;
    db.dashboard.totalOrdersConfirmed += 1;
    db.dashboard.itemsSold += items.reduce((sum, i) => sum + i.quantity, 0);

    const client = db.clients.find((c) => c.id === clientId);
    if (client) {
      client.totalSpent = (client.totalSpent || 0) + orderTotal;
    }

    saveState(db);

    return { status: 201, body: { success: true, orderId } };
  },
};

// --- FETCH INTERCEPTOR ---

function startServer() {
  const originalFetch = window.fetch;

  window.fetch = async (input, init) => {
    // Handle both relative path and full URL in Node env
    const url = new URL(input, window.location.origin);
    const method = init?.method || 'GET';
    const path = url.pathname;

    let handlerKey = `${method} ${path}`;
    let handler = handlers[handlerKey];
    let idParam = null;

    if (!handler) {
      const segments = path.split('/');
      const lastSegment = segments.pop();
      const baseRoute = segments.join('/');

      const genericKey = `${method} ${baseRoute}/:id`;
      if (handlers[genericKey]) {
        handler = handlers[genericKey];
        idParam = lastSegment;
      }
    }

    if (!path.startsWith('/api/') || !handler) {
      if (originalFetch) return originalFetch(input, init);
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
      });
    }

    console.log(`[MockServer] Intercepted: ${method} ${path}`);

    // Simulate network delay
    await new Promise((r) => setTimeout(r, 150));

    try {
      const queryParams = Object.fromEntries(url.searchParams.entries());
      const body = init?.body ? JSON.parse(init.body) : {};

      const response = handler(queryParams, idParam, body);

      return new Response(JSON.stringify(response.body), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[MockServer] Error processing request', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
      });
    }
  };

  console.log('🚀 Sandbox Mock Server Initialized (LocalStorage Active)');
}

export default startServer;
