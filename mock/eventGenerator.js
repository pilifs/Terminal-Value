// data/mockEventGenerator.js
const { v4: uuidv4 } = require('uuid');

const CITIES = ['Vancouver', 'Whistler', 'Denver', 'Salt Lake City', 'Calgary', 'Burlington', 'Banff', 'Aspen'];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const DEVICES = ['iPhone 13', 'Pixel 6', 'MacBook Pro', 'iPad Air', 'Windows Desktop'];
const SKI_CATEGORIES = [
    { name: 'All Mountain Explorer', cost: 400, sku: 'SKU-AM-001' },
    { name: 'World Cup Racer', cost: 850, sku: 'SKU-RC-002' },
    { name: 'Backcountry Tour', cost: 600, sku: 'SKU-TR-003' },
    { name: 'Piste Carver', cost: 550, sku: 'SKU-CV-004' },
    { name: 'Park Freestyle', cost: 350, sku: 'SKU-FS-005' },
    { name: 'Deep Powder', cost: 700, sku: 'SKU-PW-006' },
    { name: 'Big Mountain Pro', cost: 750, sku: 'SKU-BM-007' },
    { name: 'Nordic Cross', cost: 250, sku: 'SKU-XC-008' }
];

function generateEvents() {
    const events = [];
    let timestamp = Date.now() - 1000000; // Start in the past

    // --- 1. INITIALIZE INVENTORY (8 Skis) ---
    const inventoryIds = {}; // Map Name -> UUID
    
    SKI_CATEGORIES.forEach(ski => {
        const id = `ITEM-${ski.sku}`;
        inventoryIds[ski.name] = id;

        // Create Item
        events.push({
            type: 'ITEM_CREATED',
            aggregateId: id,
            sku: ski.sku,
            name: ski.name,
            cost: ski.cost,
            timestamp: timestamp++
        });

        // Add Initial Stock (Random amount between 10 and 50)
        events.push({
            type: 'STOCK_ADDED',
            aggregateId: id,
            quantity: Math.floor(Math.random() * 40) + 10,
            timestamp: timestamp++,
            version: 2 // Manually setting version since we are bypassing the store logic here
        });
    });

    // --- 2. INITIALIZE CLIENTS (50 Clients) ---
    const clientIds = [];

    for (let i = 1; i <= 50; i++) {
        const clientId = `CLIENT-${i.toString().padStart(3, '0')}`;
        clientIds.push(clientId);
        const deviceId = `DEV-${i.toString().padStart(3, '0')}`;
        
        // Random Demographics
        const age = Math.floor(Math.random() * 40) + 18; // 18 to 58
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const isRegistered = i % 2 === 0; // Half registered

        // A. Device Detected (ClientDevice Aggregate)
        events.push({
            type: 'DEVICE_DETECTED',
            aggregateId: deviceId,
            browser: BROWSERS[Math.floor(Math.random() * BROWSERS.length)],
            deviceName: DEVICES[Math.floor(Math.random() * DEVICES.length)],
            viewportWidth: Math.random() > 0.5 ? 1920 : 390,
            timestamp: timestamp++
        });

        // B. Link Device to Client (Client Aggregate)
        events.push({
            type: 'DEVICE_LINKED',
            aggregateId: clientId,
            deviceId: deviceId,
            timestamp: timestamp++
        });

        // C. Register Client (if applicable)
        if (isRegistered) {
            events.push({
                type: 'CLIENT_REGISTERED',
                aggregateId: clientId,
                age: age,
                city: city,
                timestamp: timestamp++
            });
        }
    }

    return events;
}

module.exports = generateEvents();