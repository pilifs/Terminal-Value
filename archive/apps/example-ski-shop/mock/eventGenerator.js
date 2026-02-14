const { v4: uuidv4 } = require('uuid');
const { Events } = require('../domain/constants/eventConstants');

const CITIES = [
  'Vancouver', 'Whistler', 'Denver', 'Salt Lake City', 'Calgary', 'Burlington', 'Banff', 'Aspen',
];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const DEVICES = [
  'iPhone 13', 'Pixel 6', 'MacBook Pro', 'iPad Air', 'Windows Desktop',
];

const VIEWPORTS = [360, 390, 414, 768, 1024, 1280, 1366, 1440, 1920, 2560];

const SKI_CATEGORIES = [
  { name: 'All Mountain Explorer', cost: 400, sku: 'SKU-AM-001', price: 650 },
  { name: 'World Cup Racer', cost: 850, sku: 'SKU-RC-002', price: 1200 },
  { name: 'Backcountry Tour', cost: 600, sku: 'SKU-TR-003', price: 890 },
  { name: 'Piste Carver', cost: 550, sku: 'SKU-CV-004', price: 799 },
  { name: 'Park Freestyle', cost: 350, sku: 'SKU-FS-005', price: 499 },
  { name: 'Deep Powder', cost: 700, sku: 'SKU-PW-006', price: 950 },
  { name: 'Big Mountain Pro', cost: 750, sku: 'SKU-BM-007', price: 1050 },
  { name: 'Nordic Cross', cost: 250, sku: 'SKU-XC-008', price: 399 },
];

// Explicit CRM Note Personas
// Later on can add scary stuff here manually like: astrology beliefs, favourite colour, political party affiliation, favourite websites -- anything that might impact marketing tone
// The intent of this is to show how powerfully indivuduals can be targeted with LLMs when given rich context using this technique 
const CRM_PERSONAS = [
  [ // Persona 0
    "Client is taking a big trip to Vail next month and needs to gear up.",
    "Previously complained about boots being too tight, needs wide fit.",
    "High income, value-conscious but willing to pay for durability."
  ],
  [ // Persona 1
    "Client is a trust fund baby that must buy the latest gear.",
    "Impulse buyer, usually buys the most expensive item in the category.",
    "Loves flashy colors and branding."
  ],
  [ // Persona 2
    "Client just got into backcountry skiing and is excited to buy new stuff.",
    "Attended an avalanche safety course last month.",
    "Asking about lightweight setups for long tours."
  ],
  [ // Persona 3
    "Client has young family members that are into ski racing.",
    "Buys new gear every November for the kids.",
    "Often asks for bulk discounts or team deals."
  ],
  [ // Persona 4
    "Former pro racer, extremely technical about edge tuning.",
    "Only skis on hardpack groomers.",
    "Prefers stiff boots and high DIN bindings."
  ],
  [ // Persona 5
    "Digital nomad, works from the lodge half the day.",
    "Needs gear that transitions well from slope to apres-ski.",
    "Interested in heated gloves and socks."
  ],
  [ // Persona 6
    "Retiree skiing 100+ days a year.",
    "Prioritizes comfort above all else.",
    "Loyal to the shop for 10 years, expects coffee when they walk in."
  ],
  [ // Persona 7
    "Adventure photographer, carries heavy camera gear.",
    "Needs rugged backpacks and stable skis.",
    "Often destroys gear quickly due to rough usage."
  ],
  [ // Persona 8
    "Weekend warrior from the city.",
    "Needs versatile gear for changing conditions.",
    "Usually rents high-performance demos before buying."
  ],
  [ // Persona 9
    "Cross-country fitness enthusiast.",
    "Tracks every metric on Strava.",
    "Looking for the lightest possible nordic setup."
  ]
];

function generateEvents() {
  const events = [];
  let timestamp = Date.now() - 10000000;

  // --- 1. INITIALIZE INVENTORY ---
  const inventoryMap = {}; 

  SKI_CATEGORIES.forEach((ski, index) => {
    const id = `ITEM-${ski.sku}`;
    inventoryMap[index] = id;

    events.push({
      type: Events.InventoryItem.CREATED,
      aggregateId: id,
      sku: ski.sku,
      name: ski.name,
      cost: ski.cost,
      timestamp: timestamp++,
    });

    events.push({
      type: Events.InventoryItem.STOCK_ADDED,
      aggregateId: id,
      quantity: 100,
      timestamp: timestamp++,
      version: 2,
    });
  });

  // --- 2. INITIALIZE CLIENTS ---
  const clients = [];

  for (let i = 1; i <= 50; i++) {
    const clientId = `CLIENT-${i.toString().padStart(3, '0')}`;
    const deviceId = `DEV-${i.toString().padStart(3, '0')}`;
    const isRegistered = i % 2 === 0;

    clients.push({ id: clientId, isRegistered });

    events.push({
      type: Events.Device.DETECTED,
      aggregateId: deviceId,
      browser: BROWSERS[Math.floor(Math.random() * BROWSERS.length)],
      deviceName: DEVICES[Math.floor(Math.random() * DEVICES.length)],
      viewportWidth: VIEWPORTS[Math.floor(Math.random() * VIEWPORTS.length)],
      timestamp: timestamp++,
    });

    events.push({
      type: Events.Client.DEVICE_LINKED,
      aggregateId: clientId,
      deviceId: deviceId,
      timestamp: timestamp++,
    });

    if (isRegistered) {
      events.push({
        type: Events.Client.REGISTERED,
        aggregateId: clientId,
        age: Math.floor(Math.random() * 40) + 18,
        city: CITIES[Math.floor(Math.random() * CITIES.length)],
        timestamp: timestamp++,
      });
    }
  }

  // --- 3. GENERATE SALES HISTORY ---

  const createPurchase = (clientId) => {
    const orderId = `ORDER-${Math.floor(Math.random() * 10000000)}`;

    const itemIdx = Math.floor(Math.random() * SKI_CATEGORIES.length);
    const item = SKI_CATEGORIES[itemIdx];
    const itemId = inventoryMap[itemIdx];
    const qty = 1;

    events.push({
      type: Events.Order.INITIATED,
      aggregateId: orderId,
      orderType: 'PURCHASE',
      clientId: clientId,
      timestamp: timestamp++,
    });

    events.push({
      type: Events.Order.ITEM_ADDED,
      aggregateId: orderId,
      itemId: itemId,
      quantity: qty,
      price: item.price,
      timestamp: timestamp++,
    });

    events.push({
      type: Events.Order.CONFIRMED,
      aggregateId: orderId,
      timestamp: timestamp++,
    });

    events.push({
      type: Events.InventoryItem.STOCK_REMOVED,
      aggregateId: itemId,
      quantity: qty,
      timestamp: timestamp++,
    });
  };

  // A. High Value Clients (First 10 Registered Clients)
  const registeredClients = clients.filter((c) => c.isRegistered);
  const highValueClients = registeredClients.slice(0, 10);

  highValueClients.forEach((client, index) => {
    // [New Logic] Inject CRM Notes based on index
    const personaNotes = CRM_PERSONAS[index % CRM_PERSONAS.length];
    personaNotes.forEach(note => {
        events.push({
            type: Events.Client.NOTE_ADDED,
            aggregateId: client.id,
            note: note,
            timestamp: timestamp++
        });
    });

    // Each makes 3 to 7 purchases
    const purchaseCount = Math.floor(Math.random() * 5) + 3;
    for (let k = 0; k < purchaseCount; k++) {
      createPurchase(client.id);
      timestamp += 10000;
    }
  });

  // B. Casual Shoppers (Next 10 Clients)
  const casualShoppers = clients.slice(10, 20);
  casualShoppers.forEach((client) => {
    createPurchase(client.id);
  });

  return events;
}

module.exports = generateEvents();