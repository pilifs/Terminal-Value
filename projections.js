// In-Memory "Read Databases"
// In a real app, these would be separate tables in Postgres, MongoDB collections, or Redis keys.
const db = {
    inventory: new Map(),       // SKU -> { name, price, stock }
    clients: new Map(),         // ClientID -> { name, city, deviceHistory }
    orders: new Map(),          // OrderID -> { status, items, total }
    dashboard: {                // Global Stats
        totalRevenue: 0,
        totalOrdersConfirmed: 0,
        itemsSold: 0
    }
};

const Projector = {
    /**
     * The Main Event Switchboard
     * Listen to events and update the specific Read Models
     */
    handle: (event) => {
        switch (event.type) {
            // --- INVENTORY PROJECTIONS ---
            case 'ITEM_CREATED':
                db.inventory.set(event.aggregateId, {
                    id: event.aggregateId,
                    sku: event.sku,
                    name: event.name,
                    cost: event.cost, // Internal cost (COGS)
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
                // Upsert client data
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
                // We keep a history of devices for this client
                const clientRecord = db.clients.get(event.aggregateId) || { devices: [], isRegistered: false };
                if (!clientRecord.devices.includes(event.deviceId)) {
                    clientRecord.devices.push(event.deviceId);
                }
                db.clients.set(event.aggregateId, clientRecord);
                break;

            // --- ORDER & SALES PROJECTIONS ---
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
                    
                    // Add to local order state
                    order.items.push({ 
                        itemId: event.itemId, 
                        qty: event.quantity, 
                        price: event.price 
                    });
                    order.orderTotal += lineTotal;
                }
                break;

            case 'ORDER_CONFIRMED':
                if (db.orders.has(event.aggregateId)) {
                    const order = db.orders.get(event.aggregateId);
                    order.status = 'CONFIRMED';
                    
                    // Update Global Dashboard Stats
                    if (order.type === 'PURCHASE') {
                        db.dashboard.totalRevenue += order.orderTotal;
                        db.dashboard.totalOrdersConfirmed++;
                        
                        const itemCount = order.items.reduce((acc, i) => acc + i.qty, 0);
                        db.dashboard.itemsSold += itemCount;
                    }
                }
                break;
        }
    },

    // --- PUBLIC QUERIES (The "Read" API) ---

    getInventoryCatalog: () => {
        // Return array of items, maybe filtering out those with 0 stock
        return Array.from(db.inventory.values());
    },

    getClientProfile: (clientId) => {
        return db.clients.get(clientId) || null;
    },

    getClientsByCity: (city) => {
        return Array.from(db.clients.values()).filter(c => c.city === city);
    },

    getDashboardStats: () => {
        return { ...db.dashboard }; // Return copy
    },

    getOrderDetails: (orderId) => {
        return db.orders.get(orderId);
    }
};

module.exports = Projector;