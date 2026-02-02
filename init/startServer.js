// startServer.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const EventStore = require('../framework/eventStore');
const Projector = require('../store/projections');
const InventoryItem = require('../domain/inventoryItem');
const Client = require('../domain/client');
const Order = require('../domain/order');

// --- HELPER: COMMAND CONTROLLER ---
// Handles the "Load -> Execute -> Save -> Publish" cycle
async function processCommand(AggregateClass, aggregateId, actionCallback) {
    let retries = 3;
    while (retries > 0) {
        try {
            // 1. Load History
            const history = await EventStore.loadEvents(aggregateId);
            const aggregate = new AggregateClass(aggregateId, history);
            const expectedVersion = aggregate.version;

            // 2. Execute Domain Logic
            const event = actionCallback(aggregate);

            // 3. Persist Event (Optimistic Locking)
            await EventStore.saveEvents(aggregateId, [event], expectedVersion);

            // 4. Update Read Model
            // In a real distributed system, this happens via Event Bus subscribers
            Projector.handle(event);

            return { success: true, id: aggregateId, event };

        } catch (err) {
            if (err.message.includes('Concurrency Error')) {
                retries--;
            } else {
                throw err; // Business logic error (e.g. Insufficient Funds)
            }
        }
    }
    throw new Error("Transaction failed due to high contention.");
}

// --- SERVER SETUP ---
function startServer() {
    const app = express();
    app.use(cors());
    app.use(bodyParser.json());
    const PORT = 3000;

    // --- READ ROUTES (QUERIES) ---
    
    app.get('/api/inventory', (req, res) => {
        res.json(Projector.getInventoryCatalog());
    });

    app.get('/api/dashboard', (req, res) => {
        res.json(Projector.getDashboardStats());
    });

    app.get('/api/clients', (req, res) => {
        if (req.query.city) {
            return res.json(Projector.getClientsByCity(req.query.city));
        }
        // Access raw map from Projector if needed, or add a getAllClients method to Projector
        // For now, we assume Projector exports db or has a getAll method
        // Using a safe fallback if direct access isn't available:
        res.json({ message: "Use ?city=X or /api/clients/:id" }); 
    });

    app.get('/api/clients/:id', (req, res) => {
        const client = Projector.getClientProfile(req.params.id);
        if (!client) return res.status(404).json({ error: "Client not found" });
        res.json(client);
    });

    app.get('/api/devices/:id', (req, res) => {
        const device = Projector.getDeviceDetails(req.params.id);
        if (!device) return res.status(404).json({ error: "Device not found" });
        res.json(device);
    });

    app.get('/api/orders/:id', (req, res) => {
        const order = Projector.getOrderDetails(req.params.id);
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json(order);
    });

    // --- WRITE ROUTES (COMMANDS) ---

    // Place an Order
    app.post('/api/orders', async (req, res) => {
        const { clientId, items } = req.body; 
        const orderId = `ORDER-${Date.now()}`;

        try {
            // A. Create Order
            await processCommand(Order, orderId, (order) => order.initiatePurchase(clientId));

            // B. Add Items
            for (const item of items) {
                await processCommand(Order, orderId, (order) => order.addItem(item.skuId, item.quantity, item.price));
            }

            // C. Confirm Order
            await processCommand(Order, orderId, (order) => order.confirm());

            // D. Decrement Stock (Side Effect)
            for (const item of items) {
                await processCommand(InventoryItem, item.skuId, (inv) => inv.removeStock(item.quantity));
            }

            res.status(201).json({ success: true, orderId });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    });

    // Register Client
    app.post('/api/clients/:id/register', async (req, res) => {
        const { age, city } = req.body;
        try {
            const result = await processCommand(Client, req.params.id, (client) => 
                client.register(age, city)
            );
            res.json(result);
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    });

    // Persist State
    app.post('/api/admin/persist', (req, res) => {
        Projector.persist();
        res.json({ success: true, message: "State saved to store.js" });
    });

    // Start Listening
    app.listen(PORT, () => {
        console.log(`\n🚀 API Server running at http://localhost:${PORT}`);
        console.log(`   Try GET  http://localhost:${PORT}/api/dashboard`);
        console.log(`   Try POST http://localhost:${PORT}/api/admin/persist`);
    });
}

module.exports = startServer;