import db from './store/db.js';

/**
 * Extracts rich context for the top 10 high-value clients.
 * @param {Object} db - The export from store/db.js
 * @returns {Array} List of top 10 clients with notes, device, order, and product history.
 */
function parseValue(db) { // Renamed to match your request
  // 1. Filter for Registered Clients only
  // 2. Sort by Total Spent (Descending)
  // 3. Take Top 10
  const topClients = db.clients
    .filter(client => client.isRegistered)
    .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
    .slice(0, 10);

  // 4. Enrich each client with linked data
  return topClients.map(client => {
    
    // JOIN: Devices
    const linkedDevices = (client.devices || []).map(deviceId => 
      db.devices.find(d => d.id === deviceId)
    ).filter(Boolean);

    // JOIN: Orders
    const clientOrders = db.orders
      .filter(order => order.clientId === client.id)
      .map(order => {
        // JOIN: Inventory (Nested) to get product names
        const enrichedItems = order.items.map(lineItem => {
          const product = db.inventory.find(p => p.id === lineItem.itemId);
          return {
            productName: product ? product.name : 'Unknown Product',
            sku: product ? product.sku : 'Unknown SKU',
            ...lineItem
          };
        });

        return {
          id: order.id,
          date: order.timestamp,
          status: order.status,
          total: order.orderTotal,
          items: enrichedItems
        };
      });

    // Return the consolidated Context Object
    return {
      profile: {
        id: client.id,
        age: client.age,
        city: client.city,
        totalLifetimeValue: client.totalSpent,
        memberSince: client.registeredAt ? new Date(client.registeredAt).toISOString() : null,
        crmNotes: client.crmNotes || [] 
      },
      techContext: linkedDevices.map(d => ({
        device: d.deviceName,
        browser: d.browser,
        screenSize: d.viewportWidth
      })),
      shoppingHistory: clientOrders
    };
  });
}

const promptData = parseValue(db);

export default promptData;