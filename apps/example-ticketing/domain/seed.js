// domain/seed.js
const { emit } = require('./events');
const { readDb } = require('./db');

const seedData = async () => {
  console.log('🌱 Seeding Event Log...');

  readDb.cities = [
    { id: 'city-1', name: 'New York, NY' },
    { id: 'city-2', name: 'Los Angeles, CA' },
  ];

  await emit('CustomerCreated', {
    id: 'cust-1',
    name: 'East Coast Comedy',
    email: 'billing@ecc.com',
  });
  await emit('CustomerCreated', {
    id: 'cust-2',
    name: 'Sunset Strip Ventures',
    email: 'billing@ssv.com',
  });

  await emit('ComedianCreated', {
    id: 'com-1',
    name: 'Dave Chappelle',
    bio: 'Legend.',
    image: 'https://placehold.co/100?text=DC',
  });

  await emit('VenueCreated', {
    id: 'venue-1',
    cityId: 'city-1',
    customerId: 'cust-1',
    name: 'Comedy Cellar',
    layout: ['VV..VV', 'SSSSSS', 'SSSSSS'],
  });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await emit('ShowCreated', {
    id: 'show-1',
    venueId: 'venue-1',
    comedianId: 'com-1',
    artist: 'Dave Chappelle & Friends',
    description: 'No phones.',
    date: tomorrow.toISOString(),
    basePrice: 80,
  });

  console.log('✅ Seeding Complete. System Consistent.');
};

module.exports = { seedData };
