// Framework
import EventStore from '../framework/eventStore.js';
import Projector from '../store/projections.js';

// Domain Aggregates
import InventoryItem from '../domain/inventoryItem.js';
import Client from '../domain/client.js';
import Order from '../domain/order.js';

// Import Generated Data
// Use fixed events for now to link custom templates to users without re-generating
// Note: We need to import the default export from the memoized file
import generateEventsResults from '../generateEventsResults.js';

const initialHistory = generateEventsResults;

async function runSimulation() {
  console.log('--- 🎿 SKI SHOP SYSTEM STARTUP 🎿 ---');

  // 1. SEED THE EVENT STORE
  console.log(`Loading ${initialHistory.length} historical events...`);

  for (const event of initialHistory) {
    const currentEvents = await EventStore.loadEvents(event.aggregateId);

    // Fix versioning for the seed data
    event.version = currentEvents.length + 1;

    // Save to store
    await EventStore.saveEvents(
      event.aggregateId,
      [event],
      currentEvents.length
    );

    // Update Read Models (Projections)
    Projector.handle(event);
  }
  console.log('History Replay Complete.\n');

  // ... (rest of the logic remains the same, assuming standard JS execution) ...
  // [Truncated for brevity, logic inside async function is identical, just imports changed]

  // 2. INSPECT A RANDOM SKI
  const racerSkuId = 'ITEM-SKU-RC-002'; // World Cup Racer
  const racerEvents = await EventStore.loadEvents(racerSkuId);
  const racerAgg = new InventoryItem(racerSkuId, racerEvents);

  console.log(`[Inventory Check] ${racerAgg.name}`);
  console.log(`   Cost: $${racerAgg.costOfGoodsSold}`);
  console.log(`   Version: ${racerAgg.version}\n`);

  // 3. INSPECT A REGISTERED CLIENT (Client 50 is registered because 50 % 2 === 0)
  const clientId = 'CLIENT-050';
  const clientEvents = await EventStore.loadEvents(clientId);
  const clientAgg = new Client(clientId, clientEvents);

  console.log(`[Client Profile] ID: ${clientId}`);
  console.log(`   Registered: ${clientAgg.isRegistered}`);
  console.log(`   City: ${clientAgg.city}`);
  console.log(`   Device Linked: ${clientAgg.deviceId}\n`);

  // 4. PERFORM A NEW TRANSACTION
  console.log('--- Processing New Order ---');

  try {
    const orderId = `ORDER-${Date.now()}`;

    // A. Create Order
    const newOrder = new Order(orderId, []);
    const startOrderEvt = newOrder.initiatePurchase(clientId);

    // B. Add Item to Order
    const addItemEvt = newOrder.addItem(racerSkuId, 1, 1200);

    // C. Confirm Order
    const confirmEvt = newOrder.confirm();

    // D. Persist Order Events
    await EventStore.saveEvents(
      orderId,
      [startOrderEvt, addItemEvt, confirmEvt],
      0
    );

    console.log(`Order ${orderId} Confirmed!`);

    // E. Side Effect: Reduce Inventory
    const stockRemoveEvt = racerAgg.removeStock(1);
    await EventStore.saveEvents(racerSkuId, [stockRemoveEvt], racerAgg.version);

    console.log(`Stock for ${racerAgg.name} reduced by 1.`);
    console.log(`New Stock Level: ${racerAgg.stockCount - 1}`);
  } catch (e) {
    console.error('Transaction Failed:', e.message);
  }

  // 5. CHECK READ MODELS
  console.log('\n--- 📊 STORE DASHBOARD ---');

  const stats = Projector.getDashboardStats();
  console.log(`Total Revenue: $${stats.totalRevenue}`);
  console.log(`Orders Processed: ${stats.totalOrdersConfirmed}`);
  console.log(`Total Items Sold: ${stats.itemsSold}`);

  console.log('\n--- ⛷️ VANCOUVER CLIENTS ---');
  const vancouverClients = Projector.getClientsByCity('Vancouver');
  console.log(`Found ${vancouverClients.length} clients in Vancouver.`);

  const inventoryItem = Projector.getInventoryCatalog().find(
    (i) => i.name === 'World Cup Racer'
  );
  console.log(`\n--- 📦 INVENTORY CHECK ---`);
  console.log(`Item: ${inventoryItem.name}`);
  console.log(`Remaining Stock (Read Model): ${inventoryItem.stock}`);

  // 6. PERSIST STATE FOR DEMO PURPOSES
  console.log('\n--- 💾 SAVING STATE ---');
  Projector.persist();
}

export default runSimulation;
