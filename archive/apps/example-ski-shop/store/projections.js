import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Events } from '../domain/constants/eventConstants.js';

// Setup paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-Memory "Read Databases"
const db = {
  inventory: new Map(),
  clients: new Map(),
  orders: new Map(),
  devices: new Map(),
  dashboard: {
    totalRevenue: 0,
    totalOrdersConfirmed: 0,
    itemsSold: 0,
  },
};

// Listen to idempotent events that are triggered upon state change and update the read database as appropriate (./db.js)
const Projector = {
  handle: (event) => {
    switch (event.type) {
      // --- DEVICE PROJECTIONS ---
      case Events.Device.DETECTED:
        db.devices.set(event.aggregateId, {
          id: event.aggregateId,
          browser: event.browser,
          deviceName: event.deviceName,
          viewportWidth: event.viewportWidth,
          firstSeen: event.timestamp,
        });
        break;

      case 'VIEWPORT_UPDATED':
        if (db.devices.has(event.aggregateId)) {
          const device = db.devices.get(event.aggregateId);
          device.viewportWidth = event.width;
        }
        break;

      // --- INVENTORY PROJECTIONS ---
      case Events.InventoryItem.CREATED:
        db.inventory.set(event.aggregateId, {
          id: event.aggregateId,
          sku: event.sku,
          name: event.name,
          cost: event.cost,
          stock: 0,
        });
        break;
      case Events.InventoryItem.STOCK_ADDED:
        if (db.inventory.has(event.aggregateId)) {
          const item = db.inventory.get(event.aggregateId);
          item.stock += event.quantity;
        }
        break;
      case Events.InventoryItem.STOCK_REMOVED:
        if (db.inventory.has(event.aggregateId)) {
          const item = db.inventory.get(event.aggregateId);
          item.stock -= event.quantity;
        }
        break;

      // --- CLIENT PROJECTIONS ---
      case Events.Client.REGISTERED:
        const existingClient = db.clients.get(event.aggregateId) || {
          devices: [],
          crmNotes: [],
        };
        db.clients.set(event.aggregateId, {
          ...existingClient,
          id: event.aggregateId,
          age: event.age,
          city: event.city,
          isRegistered: true,
          registeredAt: event.timestamp,
        });
        break;
      case Events.Client.NOTE_ADDED:
        if (db.clients.has(event.aggregateId)) {
          const client = db.clients.get(event.aggregateId);
          if (!client.crmNotes) client.crmNotes = [];
          client.crmNotes.push(event.note);
        }
        break;
      case Events.Client.MOVED:
        if (db.clients.has(event.aggregateId)) {
          const client = db.clients.get(event.aggregateId);
          client.city = event.newCity;
        }
        break;
      case Events.Client.DEVICE_LINKED:
        const clientRecord = db.clients.get(event.aggregateId) || {
          devices: [],
          isRegistered: false,
        };
        if (!clientRecord.devices.includes(event.deviceId)) {
          clientRecord.devices.push(event.deviceId);
        }
        db.clients.set(event.aggregateId, clientRecord);
        break;

      // --- ORDER PROJECTIONS ---
      case Events.Order.INITIATED:
        db.orders.set(event.aggregateId, {
          id: event.aggregateId,
          type: event.orderType,
          clientId: event.clientId,
          status: 'DRAFT',
          items: [],
          orderTotal: 0,
        });
        break;
      case Events.Order.ITEM_ADDED:
        if (db.orders.has(event.aggregateId)) {
          const order = db.orders.get(event.aggregateId);
          const lineTotal = event.price * event.quantity;
          order.items.push({
            itemId: event.itemId,
            qty: event.quantity,
            price: event.price,
          });
          order.orderTotal += lineTotal;
        }
        break;
      case Events.Order.CONFIRMED:
        if (db.orders.has(event.aggregateId)) {
          const order = db.orders.get(event.aggregateId);
          order.status = 'CONFIRMED';

          if (order.type === 'PURCHASE') {
            // 1. Update Global Dashboard
            db.dashboard.totalRevenue += order.orderTotal;
            db.dashboard.totalOrdersConfirmed++;
            const itemCount = order.items.reduce((acc, i) => acc + i.qty, 0);
            db.dashboard.itemsSold += itemCount;

            // 2. Update Client Lifetime Value (Total Spent)
            if (order.clientId && db.clients.has(order.clientId)) {
              const client = db.clients.get(order.clientId);
              // Initialize if undefined, then add total
              client.totalSpent = (client.totalSpent || 0) + order.orderTotal;
            }
          }
        }
        break;
    }
  },

  getInventoryCatalog: () => Array.from(db.inventory.values()),
  getClientProfile: (clientId) => db.clients.get(clientId) || null,
  getClients: () => Array.from(db.clients.values()),
  getClientsByCity: (city) =>
    Array.from(db.clients.values()).filter((c) => c.city === city),
  getDeviceDetails: (deviceId) => {
    return db.devices.get(deviceId) || null;
  },
  getDashboardStats: () => ({ ...db.dashboard }),
  getOrdersByClient: (clientId) => {
    return Array.from(db.orders.values()).filter(
      (o) => o.clientId === clientId
    );
  },

  // --- PERSISTENCE METHOD ---
  persist: () => {
    // Convert Maps to Arrays for JSON serialization
    const snapshot = {
      // Quick and dirty prevent changes to db.js when running app with same state
      _generatedAt: '2026-02-07T21:31:34.746Z', //new Date().toISOString(),
      dashboard: db.dashboard,
      inventory: Array.from(db.inventory.values()),
      clients: Array.from(db.clients.values()),
      orders: Array.from(db.orders.values()),
      devices: Array.from(db.devices.values()),
    };

    // Updated to output export default
    const fileContent = `// This file is auto-generated by the projection system
const db = ${JSON.stringify(snapshot, null, 4)};
export default db;`;

    fs.writeFileSync(path.join(__dirname, 'db.js'), fileContent);
    console.log('✅ Projections persisted to db.js');
  },
};

export default Projector;
