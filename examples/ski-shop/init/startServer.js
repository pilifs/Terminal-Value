const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs'); // Added fs module

const Projector = require('../store/projections');
const CommandDispatcher = require('../framework/commandDispatcher');

const InventoryItem = require('../domain/inventoryItem');
const Client = require('../domain/client');
const Order = require('../domain/order');

// --- SERVER SETUP ---
function startServer() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const PORT = 3000;

  // --- SERVE STATIC FRONTEND FILES ---
  app.use(express.static(path.join(__dirname, '../public')));

  // --- READ ROUTES (QUERIES) ---
  app.get('/api/inventory', (req, res) =>
    res.json(Projector.getInventoryCatalog())
  );
  app.get('/api/dashboard', (req, res) =>
    res.json(Projector.getDashboardStats())
  );

  app.get('/api/clients', (req, res) => {
    if (req.query.city)
      return res.json(Projector.getClientsByCity(req.query.city));

    // Return ALL clients (Admin View)
    // Get basic client data
    let clients = Projector.getClients().slice(0, 100);

    // AUGMENTATION: Check file system for custom views
    // We map over the clients to add flags if their custom files exist
    const dynamicHomeDir = path.join(
      __dirname,
      '../public/components/dynamicHome'
    );
    const dynamicOrderDir = path.join(
      __dirname,
      '../public/components/dynamicOrder'
    );

    const augmentedClients = clients.map((client) => {
      // Clone client to avoid mutating store state if it's a direct reference
      const c = { ...client };

      const homePath = path.join(dynamicHomeDir, `homePage-${c.id}.js`);
      const orderPath = path.join(dynamicOrderDir, `orderPage-${c.id}.js`);

      c.hasCustomHome = fs.existsSync(homePath);
      c.hasCustomOrder = fs.existsSync(orderPath);

      return c;
    });

    res.json(augmentedClients);
  });

  app.get('/api/clients/:id', (req, res) => {
    const client = Projector.getClientProfile(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  });

  app.get('/api/devices/:id', (req, res) => {
    const device = Projector.getDeviceDetails(req.params.id);
    if (!device) return res.status(404).json({ error: 'Device not found' });
    res.json(device);
  });

  app.get('/api/orders', (req, res) => {
    if (req.query.clientId) {
      return res.json(Projector.getOrdersByClient(req.query.clientId));
    }
    res.json({ error: 'Please provide ?clientId=' });
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = Projector.getOrderDetails(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  });

  // --- WRITE ROUTES (COMMANDS) ---
  app.post('/api/orders', async (req, res) => {
    const { clientId, items } = req.body;
    const orderId = `ORDER-${Date.now()}`;
    try {
      await CommandDispatcher.dispatch(Order, orderId, (order) =>
        order.initiatePurchase(clientId)
      );
      for (const item of items) {
        await CommandDispatcher.dispatch(Order, orderId, (order) =>
          order.addItem(item.skuId, item.quantity, item.price)
        );
      }
      await CommandDispatcher.dispatch(Order, orderId, (order) =>
        order.confirm()
      );
      for (const item of items) {
        await CommandDispatcher.dispatch(InventoryItem, item.skuId, (inv) =>
          inv.removeStock(item.quantity)
        );
      }
      res.status(201).json({ success: true, orderId });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/clients/:id/register', async (req, res) => {
    const { age, city } = req.body;
    try {
      const result = await CommandDispatcher.dispatch(
        Client,
        req.params.id,
        (client) => client.register(age, city)
      );
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.post('/api/admin/persist', (req, res) => {
    Projector.persist();
    res.json({ success: true, message: 'State saved to store.js' });
  });

  // --- START & LOG ROUTES ---
  app.listen(PORT, () => {
    console.log(
      `\n🚀 Single Page Application running at http://localhost:${PORT}/index.html`
    );
    console.log(
      `\n🚀 Admin Page running at http://localhost:${PORT}/admin.html`
    );
    console.log(`\n🚀 API Server running at http://localhost:${PORT}`);
    console.log(`\n--- 🔗 AVAILABLE ENDPOINTS ---`);

    // Dynamic Route Discovery
    app.router.stack.forEach(function (r) {
      if (r.route && r.route.path) {
        const method = Object.keys(r.route.methods)[0].toUpperCase();
        // Add some padding for alignment
        const methodPad = method.padEnd(6, ' ');
        console.log(`${methodPad} http://localhost:${PORT}${r.route.path}`);
      }
    });
    console.log('-------------------------------\n');
  });
}

module.exports = startServer;
