// domain.js
const { v4: uuidv4 } = require('uuid');
const { eventBus } = require('./bus');

// ==========================================
// 1. INFRASTRUCTURE & STORAGE
// ==========================================

// The Source of Truth (Append-Only Log)
const eventJournal = [];

// The Read Model (Mock DB) - Updated ONLY by Projectors
const readDb = {
  cities: [],
  venues: [],
  shows: [],
  users: [],
  reservations: [],
  comedians: [],
  customers: [],
};

// ==========================================
// 2. DOMAIN LOGIC & HELPERS
// ==========================================

const generateSeats = (layout, basePrice) => {
  const seats = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  layout.forEach((rowStr, r) => {
    let seatNum = 1;
    rowStr.split('').forEach((char, c) => {
      if (char === '.' || char === '_') return;
      const isVip = char === 'V';
      seats.push({
        id: `${rowLabels[r]}-${seatNum}`,
        r,
        c,
        row: rowLabels[r],
        number: seatNum,
        status: 'AVAILABLE',
        tier: isVip ? 'VIP' : 'STANDARD',
        price: isVip ? Math.floor(basePrice * 1.5) : basePrice,
      });
      seatNum++;
    });
  });
  return seats;
};

// ==========================================
// 3. PROJECTIONS (READ MODEL UPDATERS)
// ==========================================
// These functions listen to events and update the ReadDB.

const projectors = {
  UserRegistered: (e) => readDb.users.push(e.data),
  CustomerCreated: (e) => readDb.customers.push(e.data),
  ComedianCreated: (e) => readDb.comedians.push(e.data),
  VenueCreated: (e) => readDb.venues.push(e.data),

  ShowCreated: (e) => {
    // We regenerate seats here for the read model, or the event could contain them.
    // For a cleaner journal, we generate them in the projection.
    const venue = readDb.venues.find((v) => v.id === e.data.venueId);
    if (venue) {
      e.data.seats = generateSeats(venue.layout, e.data.basePrice);
      readDb.shows.push(e.data);
    }
  },

  TicketsReserved: (e) => {
    const reservation = {
      id: e.reservationId,
      userId: e.userId,
      showId: e.showId,
      seats: e.seatIds,
      totalPrice: e.totalPrice,
      status: 'RESERVED',
      createdAt: e.timestamp,
    };
    readDb.reservations.push(reservation);

    // Update Seat Status on Show
    const show = readDb.shows.find((s) => s.id === e.showId);
    if (show) {
      e.seatIds.forEach((seatId) => {
        const seat = show.seats.find((s) => s.id === seatId);
        if (seat) seat.status = 'HELD';
      });
    }
  },

  TicketsPurchased: (e) => {
    const reservation = readDb.reservations.find(
      (r) => r.id === e.reservationId
    );
    if (reservation) {
      reservation.status = 'CONFIRMED';

      const show = readDb.shows.find((s) => s.id === reservation.showId);
      if (show) {
        reservation.seats.forEach((seatId) => {
          const seat = show.seats.find((s) => s.id === seatId);
          if (seat) seat.status = 'SOLD';
        });
      }
    }
  },
};

// Wire up Projectors
Object.keys(projectors).forEach((key) =>
  eventBus.subscribe(key, projectors[key])
);

// ==========================================
// 4. COMMAND HANDLERS (WRITE SIDE)
// ==========================================
// Logic: Validate -> Create Event -> Persist Event -> Publish

const emit = async (type, data) => {
  const event = { id: uuidv4(), type, data, timestamp: new Date() };
  eventJournal.push(event);

  // Simulate Eventual Consistency (Process on next tick)
  setImmediate(() => eventBus.publish(type, data));
};

const commandHandlers = {
  RegisterUser: async ({ name, email }) => {
    const existing = readDb.users.find((u) => u.email === email);
    if (existing) return { success: true, userId: existing.id };

    const newUser = { id: uuidv4(), name, email };
    await emit('UserRegistered', newUser);
    return { success: true, userId: newUser.id };
  },

  CreateCustomer: async ({ name, email }) => {
    if (!name || !email) throw new Error('Name and Email required');
    const newCustomer = { id: uuidv4(), name, email };
    await emit('CustomerCreated', newCustomer);
    return { success: true, customerId: newCustomer.id };
  },

  CreateComedian: async ({ name, bio, image }) => {
    const newComedian = {
      id: uuidv4(),
      name,
      bio,
      image: image || `https://placehold.co/100?text=${name.charAt(0)}`,
    };
    await emit('ComedianCreated', newComedian);
    return { success: true, id: newComedian.id };
  },

  CreateVenue: async ({ name, cityId, layoutStr, customerId }) => {
    const layout = layoutStr
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const newVenue = {
      id: uuidv4(),
      cityId: cityId || 'city-1',
      customerId: customerId || 'cust-1',
      name,
      layout,
    };
    await emit('VenueCreated', newVenue);
    return { success: true, venueId: newVenue.id };
  },

  CreateShow: async ({
    venueId,
    artist,
    comedianId,
    date,
    basePrice,
    description,
  }) => {
    const venue = readDb.venues.find((v) => v.id === venueId);
    if (!venue) throw new Error('Invalid Venue');

    const newShow = {
      id: uuidv4(),
      venueId,
      comedianId: comedianId || null,
      artist,
      description,
      date,
      basePrice: parseInt(basePrice),
      drinkMinimum: true,
      // Note: Seats are generated in projection to keep event payload small
    };
    await emit('ShowCreated', newShow);
    return { success: true, showId: newShow.id };
  },

  ReserveTickets: async ({ userId, showId, seatIds }) => {
    const show = readDb.shows.find((s) => s.id === showId);
    if (!show) throw new Error('Show not found');

    // Validation (Optimistic check against ReadDB)
    const selectedSeats = [];
    seatIds.forEach((seatId) => {
      const seat = show.seats.find((s) => s.id === seatId);
      if (!seat) throw new Error(`Seat ${seatId} invalid`);
      if (seat.status !== 'AVAILABLE')
        throw new Error(`Seat ${seatId} is no longer available`);
      selectedSeats.push(seat);
    });

    const totalPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);
    const reservationId = uuidv4();

    await emit('TicketsReserved', {
      reservationId,
      userId,
      showId,
      seatIds,
      totalPrice,
      timestamp: new Date(),
    });

    return { success: true, reservationId, seatIds, totalPrice };
  },

  PurchaseTickets: async ({ reservationId }) => {
    const reservation = readDb.reservations.find((r) => r.id === reservationId);
    if (!reservation) throw new Error('Reservation not found');
    if (reservation.status === 'CONFIRMED') return { success: true };

    await emit('TicketsPurchased', { reservationId });
    return { success: true, status: 'CONFIRMED' };
  },
};

// ==========================================
// 5. QUERY HANDLERS (READ SIDE)
// ==========================================
// Strictly read from readDb (No Logic, just retrieval)

const queryHandlers = {
  GetComedians: () => readDb.comedians,
  GetCustomers: () => readDb.customers,
  GetCustomer: ({ customerId }) =>
    readDb.customers.find((c) => c.id === customerId),

  GetVenues: () =>
    readDb.venues.map((v) => ({
      id: v.id,
      name: v.name,
      ownerName:
        (readDb.customers.find((c) => c.id === v.customerId) || {}).name ||
        'Unknown',
      capacity: v.layout.join('').replace(/\./g, '').length,
      dims: `${v.layout.length}x${v.layout[0].length}`,
    })),

  GetEvents: ({ customerId } = {}) => {
    let shows = readDb.shows;
    if (customerId) {
      const customerVenueIds = readDb.venues
        .filter((v) => v.customerId === customerId)
        .map((v) => v.id);
      shows = shows.filter((s) => customerVenueIds.includes(s.venueId));
    }

    return shows.map((show) => {
      const venue = readDb.venues.find((v) => v.id === show.venueId);
      const availableCount = show.seats.filter(
        (s) => s.status === 'AVAILABLE'
      ).length;

      const tags = [];
      if (availableCount / show.seats.length < 0.2)
        tags.push('SELLING FAST 🔥');
      if (show.drinkMinimum) tags.push('2-Drink Min 🍺');

      return {
        id: show.id,
        comedianId: show.comedianId,
        artist: show.artist,
        description: show.description,
        date: show.date,
        venue: venue ? venue.name : 'Unknown',
        basePrice: show.basePrice,
        available: availableCount,
        tags: tags,
      };
    });
  },

  GetShowDetails: ({ showId }) => {
    const show = readDb.shows.find((s) => s.id === showId);
    if (!show) throw new Error('Show not found');
    const venue = readDb.venues.find((v) => v.id === show.venueId);

    // Map Seats for Grid Render
    const rows = venue.layout.length;
    const cols = venue.layout[0].length;
    const gridCells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seat = show.seats.find((s) => s.r === r && s.c === c);
        gridCells.push(seat ? { type: 'SEAT', data: seat } : { type: 'GAP' });
      }
    }

    return {
      id: show.id,
      artist: show.artist,
      venueName: venue.name,
      rows,
      cols,
      basePrice: show.basePrice,
      drinkMinimum: show.drinkMinimum,
      grid: gridCells,
    };
  },

  GetUserTickets: ({ userId }) => {
    return readDb.reservations
      .filter((r) => r.userId === userId)
      .map((r) => {
        const show = readDb.shows.find((s) => s.id === r.showId);
        const venue = readDb.venues.find((v) => v.id === show.venueId);
        return {
          id: r.id,
          artist: show.artist,
          venue: venue.name,
          seats: r.seats.join(', '),
          status: r.status,
          total: r.totalPrice,
          date: show.date,
        };
      });
  },

  // Admin & Analytics Handlers
  GetShowAnalytics: () =>
    readDb.shows.map((show) => {
      const venue = readDb.venues.find((v) => v.id === show.venueId);
      const sold = show.seats.filter((s) => s.status === 'SOLD').length;
      const reservations = readDb.reservations.filter(
        (r) => r.showId === show.id && r.status === 'CONFIRMED'
      );
      const revenue = reservations.reduce((sum, r) => sum + r.totalPrice, 0);

      return {
        id: show.id,
        artist: show.artist,
        venue: venue.name,
        date: show.date,
        totalSeats: show.seats.length,
        soldSeats: sold,
        revenue,
      };
    }),

  GetShowAttendees: ({ showId }) => {
    return readDb.reservations
      .filter((r) => r.showId === showId && r.status === 'CONFIRMED')
      .map((r) => {
        const user = readDb.users.find((u) => u.id === r.userId);
        return {
          reservationId: r.id,
          userName: user ? user.name : 'Unknown',
          userEmail: user ? user.email : 'Unknown',
          seats: r.seats.join(', '),
          total: r.totalPrice,
        };
      });
  },

  GetCustomerAnalytics: () => {
    return readDb.customers.map((c) => {
      const cVenues = readDb.venues.filter((v) => v.customerId === c.id);
      const cShows = readDb.shows.filter((s) =>
        cVenues.find((v) => v.id === s.venueId)
      );

      // Calculate total revenue for this customer's shows
      const showIds = cShows.map((s) => s.id);
      const cReservations = readDb.reservations.filter(
        (r) => showIds.includes(r.showId) && r.status === 'CONFIRMED'
      );

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        venueCount: cVenues.length,
        showCount: cShows.length,
        ticketsSold: cReservations.reduce((sum, r) => sum + r.seats.length, 0),
        totalRevenue: cReservations.reduce((sum, r) => sum + r.totalPrice, 0),
      };
    });
  },
};

// ==========================================
// 6. DATA SEEDING (Simulating History)
// ==========================================
const seedData = async () => {
  console.log('🌱 Seeding Event Log...');

  // We simulate commands by emitting events directly
  // In a real system, we might replay an event log.

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

module.exports = { commandHandlers, queryHandlers, seedData };
