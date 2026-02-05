module.exports = {
  Events: {
    Order: {
      INITIATED: 'ORDER_INITIATED',
      ITEM_ADDED: 'ITEM_ADDED_TO_ORDER',
      CONFIRMED: 'ORDER_CONFIRMED',
    },
    Client: {
      REGISTERED: 'CLIENT_REGISTERED',
      MOVED: 'CLIENT_MOVED',
      DEVICE_LINKED: 'DEVICE_LINKED',
    },
    Device: {
      DETECTED: 'DEVICE_DETECTED',
    },
    InventoryItem: {
      CREATED: 'ITEM_CREATED',
      STOCK_ADDED: 'STOCK_ADDED',
      STOCK_REMOVED: 'STOCK_REMOVED',
      COGS_UPDATED: 'COGS_UPDATED',
    },
  },
};
