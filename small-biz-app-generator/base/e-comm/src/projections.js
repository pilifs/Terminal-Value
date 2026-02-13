const eventStore = require('./eventStore');

// Mock "Read Database"
const db = {
  products: [
    { id: 'p1', name: 'Laptop', price: 1200 },
    { id: 'p2', name: 'Headphones', price: 200 },
    { id: 'p3', name: 'Coffee Mug', price: 15 },
  ],
  users: {
    u1: { id: 'u1', name: 'Alice', email: 'alice@example.com' },
  },
  orders: {}, // Map: orderId -> Order Object
  userHistory: {}, // Map: userId -> List of Orders
};

// Projection Logic: Listen to events and update DB
eventStore.subscribe((event) => {
  const { streamId, type, payload } = event;

  if (type === 'ORDER_CREATED') {
    db.orders[streamId] = {
      id: streamId,
      customerId: payload.customerId,
      items: [],
      status: 'Pending',
      total: 0,
    };

    // Initialize history for user if needed
    if (!db.userHistory[payload.customerId])
      db.userHistory[payload.customerId] = [];
  }

  if (type === 'ITEM_ADDED') {
    const order = db.orders[streamId];
    if (order) {
      order.items.push(payload.item);
      order.total += payload.item.price;
    }
  }

  if (type === 'ORDER_COMPLETED') {
    const order = db.orders[streamId];
    if (order) {
      order.status = 'Completed';
      // Add to user history only when completed
      db.userHistory[order.customerId].push({ ...order });
    }
  }
});

module.exports = db;
