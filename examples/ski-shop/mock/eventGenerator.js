const { v4: uuidv4 } = require('uuid'); // If you don't have uuid, a helper is included at bottom
const { Events } = require('../domain/constants/eventConstants');

const CITIES = ['Vancouver', 'Whistler', 'Denver', 'Salt Lake City', 'Calgary', 'Burlington', 'Banff', 'Aspen'];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const DEVICES = ['iPhone 13', 'Pixel 6', 'MacBook Pro', 'iPad Air', 'Windows Desktop'];

const VIEWPORTS = [360, 390, 414, 768, 1024, 1280, 1366, 1440, 1920, 2560];

const SKI_CATEGORIES = [
    { name: 'All Mountain Explorer', cost: 400, sku: 'SKU-AM-001', price: 650 },
    { name: 'World Cup Racer', cost: 850, sku: 'SKU-RC-002', price: 1200 },
    { name: 'Backcountry Tour', cost: 600, sku: 'SKU-TR-003', price: 890 },
    { name: 'Piste Carver', cost: 550, sku: 'SKU-CV-004', price: 799 },
    { name: 'Park Freestyle', cost: 350, sku: 'SKU-FS-005', price: 499 },
    { name: 'Deep Powder', cost: 700, sku: 'SKU-PW-006', price: 950 },
    { name: 'Big Mountain Pro', cost: 750, sku: 'SKU-BM-007', price: 1050 },
    { name: 'Nordic Cross', cost: 250, sku: 'SKU-XC-008', price: 399 }
];

function generateEvents() {
    const events = [];
    let timestamp = Date.now() - 10000000; // Start further back

    // --- 1. INITIALIZE INVENTORY ---
    const inventoryMap = {}; // Helper to look up ID by Index
    
    SKI_CATEGORIES.forEach((ski, index) => {
        const id = `ITEM-${ski.sku}`;
        inventoryMap[index] = id;
        
        events.push({
            type: Events.InventoryItem.CREATED,
            aggregateId: id,
            sku: ski.sku,
            name: ski.name,
            cost: ski.cost,
            timestamp: timestamp++
        });

        // Add hefty stock initially to support the sales
        events.push({
            type: Events.InventoryItem.STOCK_ADDED,
            aggregateId: id,
            quantity: 100, 
            timestamp: timestamp++,
            version: 2
        });
    });

    // --- 2. INITIALIZE CLIENTS ---
    const clients = [];

    for (let i = 1; i <= 50; i++) {
        const clientId = `CLIENT-${i.toString().padStart(3, '0')}`;
        const deviceId = `DEV-${i.toString().padStart(3, '0')}`;
        const isRegistered = i % 2 === 0;

        clients.push({ id: clientId, isRegistered });

        events.push({
            type: Events.Device.DETECTED,
            aggregateId: deviceId,
            browser: BROWSERS[Math.floor(Math.random() * BROWSERS.length)],
            deviceName: DEVICES[Math.floor(Math.random() * DEVICES.length)],
            viewportWidth: VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)],
            timestamp: timestamp++
        });

        events.push({
            type: Events.Client.DEVICE_LINKED,
            aggregateId: clientId,
            deviceId: deviceId,
            timestamp: timestamp++
        });

        if (isRegistered) {
            events.push({
                type: Events.Client.REGISTERED,
                aggregateId: clientId,
                age: Math.floor(Math.random() * 40) + 18,
                city: CITIES[Math.floor(Math.random() * CITIES.length)],
                timestamp: timestamp++
            });
        }
    }

    // --- 3. GENERATE SALES HISTORY ---
    
    // Helper to create a purchase sequence
    const createPurchase = (clientId) => {
        const orderId = `ORDER-${Math.floor(Math.random() * 10000000)}`;
        
        // 1. Pick a random Ski
        const itemIdx = Math.floor(Math.random() * SKI_CATEGORIES.length);
        const item = SKI_CATEGORIES[itemIdx];
        const itemId = inventoryMap[itemIdx];
        const qty = 1;

        // Event A: Start Order
        events.push({
            type: Events.Order.INITIATED,
            aggregateId: orderId,
            orderType: 'PURCHASE',
            clientId: clientId,
            timestamp: timestamp++
        });

        // Event B: Add Item
        events.push({
            type: Events.Order.ITEM_ADDED,
            aggregateId: orderId,
            itemId: itemId,
            quantity: qty,
            price: item.price,
            timestamp: timestamp++
        });

        // Event C: Confirm Order
        events.push({
            type: Events.Order.CONFIRMED,
            aggregateId: orderId,
            timestamp: timestamp++
        });

        // Event D: Side Effect (Reduce Stock)
        // Note: In real event sourcing, this version number needs to be accurate.
        // For this generator, we assume no race conditions.
        events.push({
            type: Events.InventoryItem.STOCK_REMOVED,
            aggregateId: itemId,
            quantity: qty,
            timestamp: timestamp++
        });
    };

    // A. High Value Clients (First 10 Registered Clients)
    const registeredClients = clients.filter(c => c.isRegistered);
    const highValueClients = registeredClients.slice(0, 10);
    
    highValueClients.forEach(client => {
        // Each makes 3 to 7 purchases
        const purchaseCount = Math.floor(Math.random() * 5) + 3;
        for (let k = 0; k < purchaseCount; k++) {
            createPurchase(client.id);
            timestamp += 10000; // Time gap between purchases
        }
    });

    // B. Casual Shoppers (Next 10 Clients, mixed reg/non-reg)
    // We pick clients from index 10 to 20
    const casualShoppers = clients.slice(10, 20);
    casualShoppers.forEach(client => {
        createPurchase(client.id);
    });

    // C. Window Shoppers (Everyone else)
    // No events generated for them.

    return events;
}

module.exports = generateEvents();