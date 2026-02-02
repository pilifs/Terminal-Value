const fs = require('fs');
const path = require('path');

// In-Memory "Read Databases"
const db = {
    inventory: new Map(),       
    clients: new Map(),         
    orders: new Map(), 
    devices: new Map(),        
    dashboard: {                
        totalRevenue: 0,
        totalOrdersConfirmed: 0,
        itemsSold: 0
    }
};

const Projector = {
    handle: (event) => {
        switch (event.type) {
            // --- DEVICE PROJECTIONS ---
            case 'DEVICE_DETECTED':
                db.devices.set(event.aggregateId, {
                    id: event.aggregateId,
                    browser: event.browser,
                    deviceName: event.deviceName,
                    viewportWidth: event.viewportWidth,
                    firstSeen: event.timestamp
                });
                break;
            
            case 'VIEWPORT_UPDATED':
                if (db.devices.has(event.aggregateId)) {
                    const device = db.devices.get(event.aggregateId);
                    device.viewportWidth = event.width;
                }
                break;

            // --- INVENTORY PROJECTIONS ---
            case 'ITEM_CREATED':
                db.inventory.set(event.aggregateId, {
                    id: event.aggregateId,
                    sku: event.sku,
                    name: event.name,
                    cost: event.cost, 
                    stock: 0
                });
                break;
            case 'STOCK_ADDED':
                if (db.inventory.has(event.aggregateId)) {
                    const item = db.inventory.get(event.aggregateId);
                    item.stock += event.quantity;
                }
                break;
            case 'STOCK_REMOVED':
                if (db.inventory.has(event.aggregateId)) {
                    const item = db.inventory.get(event.aggregateId);
                    item.stock -= event.quantity;
                }
                break;
            
            // --- CLIENT PROJECTIONS ---
            case 'CLIENT_REGISTERED':
                const existingClient = db.clients.get(event.aggregateId) || { devices: [] };
                db.clients.set(event.aggregateId, {
                    ...existingClient,
                    id: event.aggregateId,
                    age: event.age,
                    city: event.city,
                    isRegistered: true,
                    registeredAt: event.timestamp
                });
                break;
            case 'CLIENT_MOVED':
                if (db.clients.has(event.aggregateId)) {
                    const client = db.clients.get(event.aggregateId);
                    client.city = event.newCity;
                }
                break;
            case 'DEVICE_LINKED':
                const clientRecord = db.clients.get(event.aggregateId) || { devices: [], isRegistered: false };
                if (!clientRecord.devices.includes(event.deviceId)) {
                    clientRecord.devices.push(event.deviceId);
                }
                db.clients.set(event.aggregateId, clientRecord);
                break;
            
            // --- ORDER PROJECTIONS ---
            case 'ORDER_INITIATED':
                db.orders.set(event.aggregateId, {
                    id: event.aggregateId,
                    type: event.orderType,
                    clientId: event.clientId,
                    status: 'DRAFT',
                    items: [],
                    orderTotal: 0
                });
                break;
            case 'ITEM_ADDED_TO_ORDER':
                if (db.orders.has(event.aggregateId)) {
                    const order = db.orders.get(event.aggregateId);
                    const lineTotal = event.price * event.quantity;
                    order.items.push({ itemId: event.itemId, qty: event.quantity, price: event.price });
                    order.orderTotal += lineTotal;
                }
                break;
            case 'ORDER_CONFIRMED':
                if (db.orders.has(event.aggregateId)) {
                    const order = db.orders.get(event.aggregateId);
                    order.status = 'CONFIRMED';
                    
                    if (order.type === 'PURCHASE') {
                        // 1. Update Global Dashboard
                        db.dashboard.totalRevenue += order.orderTotal;
                        db.dashboard.totalOrdersConfirmed++;
                        const itemCount = order.items.reduce((acc, i) => acc + i.qty, 0);
                        db.dashboard.itemsSold += itemCount;

                        // 2. NEW: Update Client Lifetime Value (Total Spent)
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
    getClientsByCity: (city) => Array.from(db.clients.values()).filter(c => c.city === city),
    getDashboardStats: () => ({ ...db.dashboard }),
    getOrdersByClient: (clientId) => {
        return Array.from(db.orders.values()).filter(o => o.clientId === clientId);
    },

    // --- PERSISTENCE METHOD ---
    persist: () => {
        // Convert Maps to Arrays for JSON serialization
        const snapshot = {
            _generatedAt: new Date().toISOString(),
            dashboard: db.dashboard,
            inventory: Array.from(db.inventory.values()),
            clients: Array.from(db.clients.values()),
            orders: Array.from(db.orders.values()),
            devices: Array.from(db.devices.values())
        };

        const fileContent = `// This file is auto-generated by the projection system
module.exports = ${JSON.stringify(snapshot, null, 4)};`;

        fs.writeFileSync(path.join(__dirname, 'db.js'), fileContent);
        console.log("✅ Projections persisted to db.js");
    }
};

module.exports = Projector;