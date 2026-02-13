const eventStore = require('./eventStore');

class OrderAggregate {
  constructor(id) {
    this.id = id;
    this.state = { status: 'NEW', items: [] };
  }

  // Hydrate state from event history (Event Sourcing core)
  hydrate() {
    const events = eventStore.getEventsForStream(this.id);
    events.forEach((e) => this.apply(e));
  }

  apply(event) {
    switch (event.type) {
      case 'ORDER_CREATED':
        this.state.customerId = event.payload.customerId;
        this.state.status = 'CREATED';
        break;
      case 'ITEM_ADDED':
        this.state.items.push(event.payload.item);
        break;
      case 'ORDER_COMPLETED':
        this.state.status = 'COMPLETED';
        break;
    }
  }

  // Command: Create Order
  createOrder(customerId) {
    if (this.state.status !== 'NEW') throw new Error('Order already exists');
    eventStore.publish(this.id, 'ORDER_CREATED', { customerId });
  }

  // Command: Add Item
  addItem(item) {
    this.hydrate(); // Ensure we have latest state
    if (this.state.status === 'COMPLETED')
      throw new Error('Cannot add items to completed order');
    eventStore.publish(this.id, 'ITEM_ADDED', { item });
  }

  // Command: Checkout
  checkout() {
    this.hydrate();
    if (this.state.items.length === 0)
      throw new Error('Cannot checkout empty order');
    eventStore.publish(this.id, 'ORDER_COMPLETED', {});
  }
}

module.exports = { OrderAggregate };
