const AggregateRoot = require('../framework/aggregateRoot');
const { Events } = require('./constants/eventConstants');

class InventoryItem extends AggregateRoot {
  constructor(id, history) {
    super(id, history, {
      id: id,
      sku: null,
      name: null,
      costOfGoodsSold: 0,
      stockCount: 0,
      isActive: false,
    });
  }

  apply(event) {
    switch (event.type) {
      case Events.InventoryItem.CREATED:
        this.sku = event.sku;
        this.name = event.name;
        this.costOfGoodsSold = event.cost;
        this.isActive = true;
        break;
      case Events.InventoryItem.STOCK_ADDED:
        this.stockCount += event.quantity;
        break;
      case Events.InventoryItem.STOCK_REMOVED:
        this.stockCount -= event.quantity;
        break;
      case Events.InventoryItem.COGS_UPDATED:
        this.costOfGoodsSold = event.newCost;
        break;
    }
  }

  create(sku, name, cost) {
    if (this.isActive) throw new Error('Item already exists');
    return {
      type: Events.InventoryItem.CREATED,
      aggregateId: this.id,
      sku,
      name,
      cost,
      timestamp: Date.now(),
    };
  }

  addStock(quantity) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    return {
      type: Events.InventoryItem.STOCK_ADDED,
      aggregateId: this.id,
      quantity,
      timestamp: Date.now(),
    };
  }

  removeStock(quantity) {
    if (quantity <= 0) throw new Error('Quantity must be positive');
    if (this.stockCount < quantity) throw new Error('Insufficient stock');
    return {
      type: Events.InventoryItem.STOCK_REMOVED,
      aggregateId: this.id,
      quantity,
      timestamp: Date.now(),
    };
  }
}

module.exports = InventoryItem;
