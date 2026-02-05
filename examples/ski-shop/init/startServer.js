const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const Projector = require('../store/projections');
const CommandDispatcher = require('../framework/commandDispatcher');

const InventoryItem = require('../domain/inventoryItem');
const Client = require('../domain/client');
const Order = require('../domain/order');

// --- HELPER: Scan for Component Versions ---
function getComponentVersions(type, clientId) {
  // type is 'Home' or 'Order'
  // dir structure: public/components/dynamic{Type}/{hash}/{type}Page-{clientId}.js
  const baseDir = path.join(__dirname, `../public/components/dynamic${type}`);

  if (!fs.existsSync(baseDir)) return [];

  try {
    // Get all subdirectories (hashes)
    const hashDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // Filter hashes that contain the specific client file
    const versions = hashDirs.filter((hash) => {
      const filePath = path.join(
        baseDir,
        hash,
        `${type.toLowerCase()}Page-${clientId}.js`
      );
      return fs.existsSync(filePath);
    });

    return versions;
  } catch (err) {
    console.error(`Error scanning versions for ${type}:`, err);
    return [];
  }
}

// --- SERVER SETUP ---
function startServer() {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json());
  const PORT = 3000;

  app.use(express.static(path.join(__dirname, '../public')));

  // --- READ ROUTES ---
  app.get('/api/inventory', (req, res) =>
    res.json(Projector.getInventoryCatalog())
  );
  app.get('/api/dashboard', (req, res) =>
    res.json(Projector.getDashboardStats())
  );

  app.get('/api/clients', (req, res) => {
    if (req.query.city)
      return res.json(Projector.getClientsByCity(req.query.city));

    let clients = Projector.getClients().slice(0, 100);

    // AUGMENTATION: Scan for all versions of custom files
    const augmentedClients = clients.map((client) => {
      const c = { ...client };

      // Get array of available hashes (e.g., ['legacy', 'a7b3...', 'x9z1...'])
      c.customHomeVersions = getComponentVersions('Home', c.id);
      c.customOrderVersions = getComponentVersions('Order', c.id);

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
    if (req.query.clientId)
      return res.json(Projector.getOrdersByClient(req.query.clientId));
    res.json({ error: 'Please provide ?clientId=' });
  });

  app.get('/api/orders/:id', (req, res) => {
    const order = Projector.getOrderDetails(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  });

  // --- WRITE ROUTES ---
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

  app.listen(PORT, () => {
    console.log(`\n🚀 Ski Shop running at http://localhost:${PORT}`);

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
  });
}

module.exports = startServer;
