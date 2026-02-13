const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { OrderAggregate } = require('./aggregates');
const db = require('./projections');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// --- QUERY APIS (Read from Projections) ---

app.get('/api/products', (req, res) => res.json(db.products));

app.get('/api/users/:id', (req, res) => {
  const user = db.users[req.params.id];
  user ? res.json(user) : res.status(404).send('User not found');
});

app.get('/api/history/:userId', (req, res) => {
  res.json(db.userHistory[req.params.userId] || []);
});

// --- COMMAND APIS (Write to Aggregates) ---

// 1. Start a new order
app.post('/api/orders/create', (req, res) => {
  const orderId = `ord_${Date.now()}`;
  const { userId } = req.body;

  try {
    const orderAgg = new OrderAggregate(orderId);
    orderAgg.createOrder(userId);
    res.json({ orderId });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 2. Add item to order
app.post('/api/orders/:id/add', (req, res) => {
  const { productId } = req.body;
  const product = db.products.find((p) => p.id === productId);

  if (!product) return res.status(404).send('Product not found');

  try {
    const orderAgg = new OrderAggregate(req.params.id);
    orderAgg.addItem(product);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 3. Checkout
app.post('/api/orders/:id/checkout', (req, res) => {
  try {
    const orderAgg = new OrderAggregate(req.params.id);
    orderAgg.checkout();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(4001, () =>
  console.log('CQRS Shop running on http://localhost:3000')
);
