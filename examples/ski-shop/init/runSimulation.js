// Framework
const EventStore = require('../framework/eventStore');
const Projector = require('../store/projections');

// Domain Aggregates
const InventoryItem = require('../domain/inventoryItem');
const Client = require('../domain/client');
const Order = require('../domain/order');

// Import Generated Data
const initialHistory = require('../mock/eventGenerator');

async function runSimulation() {
    console.log("--- 🎿 SKI SHOP SYSTEM STARTUP 🎿 ---");

    // 1. SEED THE EVENT STORE
    // In a real system, this is already in the DB. Here we inject it.
    console.log(`Loading ${initialHistory.length} historical events...`);
    
    // We group events by AggregateID to simulate them being saved correctly
    for (const event of initialHistory) {
        // We use a "backdoor" here to seed the store directly without validation
        // for the sake of setting up the simulation state.
        const currentEvents = await EventStore.loadEvents(event.aggregateId);
        
        // Fix versioning for the seed data
        event.version = currentEvents.length + 1;
        
        // Save to store
        await EventStore.saveEvents(event.aggregateId, [event], currentEvents.length);
        
        // Update Read Models (Projections)
        Projector.handle(event);
    }
    console.log("History Replay Complete.\n");

    // --- SIMULATION START ---
    // Execute various operations to demonstrate and test functionality

    // 2. INSPECT A RANDOM SKI
    const racerSkuId = "ITEM-SKU-RC-002"; // World Cup Racer
    const racerEvents = await EventStore.loadEvents(racerSkuId);
    const racerAgg = new InventoryItem(racerSkuId, racerEvents);
    
    console.log(`[Inventory Check] ${racerAgg.name}`);
    console.log(`   Cost: $${racerAgg.costOfGoodsSold}`);
    console.log(`   Version: ${racerAgg.version}\n`);

    // 3. INSPECT A REGISTERED CLIENT (Client 50 is registered because 50 % 2 === 0)
    const clientId = "CLIENT-050";
    const clientEvents = await EventStore.loadEvents(clientId);
    const clientAgg = new Client(clientId, clientEvents);

    console.log(`[Client Profile] ID: ${clientId}`);
    console.log(`   Registered: ${clientAgg.isRegistered}`);
    console.log(`   City: ${clientAgg.city}`);
    console.log(`   Device Linked: ${clientAgg.deviceId}\n`);

    // 4. PERFORM A NEW TRANSACTION
    // Client 50 wants to buy the 'World Cup Racer' skis.
    // This will fail due to ID collision since adding mock sales generation
    console.log("--- Processing New Order ---");

    try {
        const orderId = `ORDER-${Date.now()}`;
        
        // A. Create Order
        const newOrder = new Order(orderId, []); // New, so empty history
        const startOrderEvt = newOrder.initiatePurchase(clientId);
        
        // B. Add Item to Order
        // Note: Real world would check InventoryItem stock here first!
        const addItemEvt = newOrder.addItem(racerSkuId, 1, 1200); // Selling for $1200 (profit!)
        
        // C. Confirm Order
        const confirmEvt = newOrder.confirm();

        // D. Persist Order Events
        await EventStore.saveEvents(orderId, [startOrderEvt, addItemEvt, confirmEvt], 0);
        
        console.log(`Order ${orderId} Confirmed!`);
        
        // E. Side Effect: Reduce Inventory
        // In a distributed system, a Process Manager hears 'ORDER_CONFIRMED' and sends this command.
        // We simulate that manually here:
        const stockRemoveEvt = racerAgg.removeStock(1);
        await EventStore.saveEvents(racerSkuId, [stockRemoveEvt], racerAgg.version);
        
        console.log(`Stock for ${racerAgg.name} reduced by 1.`);
        console.log(`New Stock Level: ${racerAgg.stockCount - 1}`); // Prediction

    } catch (e) {
        console.error("Transaction Failed:", e.message);
    }

    // 5. CHECK READ MODELS (The "Eventually Consistent" View)
    console.log("\n--- 📊 STORE DASHBOARD ---");
    
    const stats = Projector.getDashboardStats();
    console.log(`Total Revenue: $${stats.totalRevenue}`);
    console.log(`Orders Processed: ${stats.totalOrdersConfirmed}`);
    console.log(`Total Items Sold: ${stats.itemsSold}`);

    console.log("\n--- ⛷️ VANCOUVER CLIENTS ---");
    const vancouverClients = Projector.getClientsByCity('Vancouver');
    console.log(`Found ${vancouverClients.length} clients in Vancouver.`);
    
    // Check Inventory of the item we sold
    const inventoryItem = Projector.getInventoryCatalog().find(i => i.name === 'World Cup Racer');
    console.log(`\n--- 📦 INVENTORY CHECK ---`);
    console.log(`Item: ${inventoryItem.name}`);
    console.log(`Remaining Stock (Read Model): ${inventoryItem.stock}`); 
    // This should match the write model if consistency has caught up

    // 6. PERSIST STATE FOR DEMO PURPOSES
    console.log("\n--- 💾 SAVING STATE ---");
    Projector.persist();
}

module.exports = runSimulation;