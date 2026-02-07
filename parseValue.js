import path from 'path';
import { fileURLToPath } from 'url';
import db from './examples/ski-shop/store/db.js';
import { getMemoizedResult } from './examples/ski-shop/utils/memoizer.js';

// Setup paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMO_FILE_PATH = path.join(
  __dirname,
  'memoizedResults/parseValueResults.js'
);

/**
 * Extracts rich context for the top 10 high-value clients.
 * Uses memoization utility to cache results.
 * @param {Object} db - The export from store/db.js
 * @returns {Array} List of top 10 clients with notes, device, order, and product history.
 */
function parseValue(db) {
  return getMemoizedResult({
    filePath: MEMO_FILE_PATH,
    inputData: db,
    variableName: 'parseValueResults',
    useDefaultExport: true, // Output requires 'export default'
    computeFn: () => {
      const topClients = db.clients
        .filter((client) => client.isRegistered)
        .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
        .slice(0, 10);

      return topClients.map((client) => {
        // JOIN: Devices
        const linkedDevices = (client.devices || [])
          .map((deviceId) => db.devices.find((d) => d.id === deviceId))
          .filter(Boolean);

        // JOIN: Orders
        const clientOrders = db.orders
          .filter((order) => order.clientId === client.id)
          .map((order) => {
            // JOIN: Inventory (Nested)
            const enrichedItems = order.items.map((lineItem) => {
              const product = db.inventory.find(
                (p) => p.id === lineItem.itemId
              );
              return {
                productName: product ? product.name : 'Unknown Product',
                sku: product ? product.sku : 'Unknown SKU',
                ...lineItem,
              };
            });

            return {
              id: order.id,
              date: order.timestamp,
              status: order.status,
              total: order.orderTotal,
              items: enrichedItems,
            };
          });

        return {
          profile: {
            id: client.id,
            age: client.age,
            city: client.city,
            totalLifetimeValue: client.totalSpent,
            memberSince: client.registeredAt
              ? new Date(client.registeredAt).toISOString()
              : null,
            crmNotes: client.crmNotes || [],
          },
          techContext: linkedDevices.map((d) => ({
            device: d.deviceName,
            browser: d.browser,
            screenSize: d.viewportWidth,
          })),
          shoppingHistory: clientOrders,
        };
      });
    },
  });
}

const promptData = parseValue(db);

export default promptData;
