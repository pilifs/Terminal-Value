// domain.js
const { v4: uuidv4 } = require('uuid');

// --- In-Memory Database ---
const db = {
  cities: [],
  venues: [],
  shows: [],
  users: [],
  reservations: [],
  comedians: [],
  customers: [], // NEW: Aggregate for SaaS Clients
};

// --- Logic Helpers ---

// Parses a visual layout to generate the Seat Inventory
// Layout Example: ["VV..VV", "SS..SS"] (V=VIP, S=Std, .=Gap)
const generateSeats = (layout, basePrice) => {
  const seats = [];
  const rowLabels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  layout.forEach((rowStr, r) => {
    let seatNum = 1;
    const chars = rowStr.split('');

    chars.forEach((char, c) => {
      // Ignore gaps for inventory, but we need coordinates for later
      if (char === '.' || char === '_') return;

      const isVip = char === 'V';
      const seatPrice = isVip ? Math.floor(basePrice * 1.5) : basePrice;

      seats.push({
        id: `${rowLabels[r]}-${seatNum}`, // Logical ID (A-1)
        r: r, // Grid Row Index
        c: c, // Grid Col Index
        row: rowLabels[r],
        number: seatNum,
        status: 'AVAILABLE',
        tier: isVip ? 'VIP' : 'STANDARD',
        price: seatPrice,
      });

      seatNum++;
    });
  });

  return seats;
};

// --- Helper to Seed Data ---
const seedData = () => {
  console.log('🎤 Seeding Comedy Club Data with Visual Layouts...');

  db.cities = [
    { id: 'city-1', name: 'New York, NY' },
    { id: 'city-2', name: 'Los Angeles, CA' },
  ];

  // Seed Customers (SaaS Clients)
  db.customers = [
    {
      id: 'cust-1',
      name: 'East Coast Comedy Group',
      email: 'billing@eastcoast.com',
    },
    {
      id: 'cust-2',
      name: 'Sunset Strip Ventures',
      email: 'accounting@sunsetstrip.com',
    },
  ];

  // Seed Comedians
  db.comedians = [
    {
      id: 'com-1',
      name: 'Dave Chappelle',
      bio: "An American stand-up comedian and actor. Known for his satirical comedy sketch series Chappelle's Show.",
      image: 'https://placehold.co/100?text=DC',
    },
    {
      id: 'com-2',
      name: 'John Mulaney',
      bio: 'Known for his work as a writer on Saturday Night Live and his stand-up specials.',
      image: 'https://placehold.co/100?text=JM',
    },
  ];

  // Venues now have a 'layout' property and 'customerId'
  db.venues = [
    {
      id: 'venue-1',
      cityId: 'city-1',
      customerId: 'cust-1', // Owned by East Coast
      name: 'The Comedy Cellar',
      layout: [
        'VV..VV', // Front Row VIP with wide center aisle
        'SSSSSS',
        'SSSSSS',
        'SSSSSS',
      ],
    },
    {
      id: 'venue-2',
      cityId: 'city-2',
      customerId: 'cust-2', // Owned by Sunset Strip
      name: 'The Comedy Store (Main Room)',
      layout: [
        'VVVV.VVVV.VVVV', // 3 Sections
        'SSSS.SSSS.SSSS',
        'SSSS.SSSS.SSSS',
        'SSSS.SSSS.SSSS',
        'SSSS.SSSS.SSSS',
      ],
    },
  ];

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(20, 0, 0, 0);

  db.shows = [
    {
      id: 'show-1',
      venueId: 'venue-1',
      comedianId: 'com-1', // Linked
      artist: 'Dave Chappelle & Friends',
      description: 'Surprise drop-in show! No phones allowed.',
      date: tomorrow.toISOString(),
      basePrice: 80,
      drinkMinimum: true,
      seats: generateSeats(db.venues[0].layout, 80),
    },
  ];

  // Pre-sell some seats
  db.shows[0].seats[0].status = 'SOLD';

  db.users = [{ id: 'user-1', name: 'Comedy Fan', email: 'fan@example.com' }];
  console.log('✅ Data Seeded');
};

// --- Command Handlers ---
const commandHandlers = {
  RegisterUser: ({ name, email }) => {
    let user = db.users.find((u) => u.email === email);
    if (!user) {
      user = { id: uuidv4(), name, email };
      db.users.push(user);
    }
    return { success: true, userId: user.id };
  },

  // NEW: Create Customer
  CreateCustomer: ({ name, email }) => {
    if (!name || !email) throw new Error('Name and Email required');
    const newCustomer = { id: uuidv4(), name, email };
    db.customers.push(newCustomer);
    return { success: true, customerId: newCustomer.id };
  },

  // NEW: Manage Comedians
  CreateComedian: ({ name, bio, image }) => {
    const newComedian = {
      id: uuidv4(),
      name,
      bio,
      image: image || `https://placehold.co/100?text=${name.charAt(0)}`,
    };
    db.comedians.push(newComedian);
    return { success: true, id: newComedian.id };
  },

  // Manage Venues (Updated with customerId)
  CreateVenue: ({ name, cityId, layoutStr, customerId }) => {
    // layoutStr comes in as multiline string from textarea
    const layout = layoutStr
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newVenue = {
      id: uuidv4(),
      cityId: cityId || 'city-1',
      customerId: customerId || 'cust-1', // Default to first customer if not provided
      name,
      layout,
    };
    db.venues.push(newVenue);
    return { success: true, venueId: newVenue.id };
  },

  CreateShow: ({
    venueId,
    artist,
    comedianId,
    date,
    basePrice,
    description,
  }) => {
    const venue = db.venues.find((v) => v.id === venueId);
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
      seats: generateSeats(venue.layout, parseInt(basePrice)),
    };

    db.shows.push(newShow);
    return { success: true, showId: newShow.id };
  },

  ReserveTickets: ({ userId, showId, seatIds, quantity }) => {
    const show = db.shows.find((s) => s.id === showId);
    if (!show) throw new Error('Show not found');

    let selectedSeats = [];

    if (seatIds && seatIds.length > 0) {
      seatIds.forEach((seatId) => {
        const seat = show.seats.find((s) => s.id === seatId);
        if (!seat) throw new Error(`Seat ${seatId} invalid`);
        if (seat.status !== 'AVAILABLE')
          throw new Error(`Seat ${seatId} is not available`);
        selectedSeats.push(seat);
      });
    } else if (quantity > 0) {
      const available = show.seats.filter((s) => s.status === 'AVAILABLE');
      if (available.length < quantity)
        throw new Error(`Only ${available.length} seats remaining.`);
      selectedSeats = available.slice(0, quantity);
    }

    const total = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

    const reservation = {
      id: uuidv4(),
      userId,
      showId,
      seats: selectedSeats.map((s) => s.id),
      totalPrice: total,
      status: 'RESERVED',
      createdAt: new Date(),
    };

    selectedSeats.forEach((s) => (s.status = 'HELD'));
    db.reservations.push(reservation);

    return {
      success: true,
      reservationId: reservation.id,
      seatIds: reservation.seats,
      totalPrice: reservation.totalPrice,
    };
  },

  PurchaseTickets: ({ reservationId }) => {
    const reservation = db.reservations.find((r) => r.id === reservationId);
    if (!reservation) throw new Error('Reservation not found');
    if (reservation.status === 'CONFIRMED') return { success: true };

    const show = db.shows.find((s) => s.id === reservation.showId);
    reservation.seats.forEach((seatId) => {
      const seat = show.seats.find((s) => s.id === seatId);
      if (seat) seat.status = 'SOLD';
    });

    reservation.status = 'CONFIRMED';
    return { success: true, status: 'CONFIRMED' };
  },
};

// --- Query Handlers ---
const queryHandlers = {
  GetComedians: () => {
    return db.comedians;
  },

  // NEW: Get Single Customer (for branding)
  GetCustomer: ({ customerId }) => {
    return db.customers.find((c) => c.id === customerId);
  },

  // NEW: Get Customers
  GetCustomers: () => {
    return db.customers;
  },

  // NEW: Get Customer Analytics
  GetCustomerAnalytics: () => {
    return db.customers.map((c) => {
      const venues = db.venues.filter((v) => v.customerId === c.id);
      const venueIds = venues.map((v) => v.id);

      const shows = db.shows.filter((s) => venueIds.includes(s.venueId));
      const showIds = shows.map((s) => s.id);

      // Find all reservations for these shows
      const reservations = db.reservations.filter(
        (r) => showIds.includes(r.showId) && r.status === 'CONFIRMED'
      );

      const totalRevenue = reservations.reduce(
        (sum, r) => sum + r.totalPrice,
        0
      );
      const ticketsSold = reservations.reduce(
        (sum, r) => sum + r.seats.length,
        0
      );

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        venueCount: venues.length,
        showCount: shows.length,
        ticketsSold,
        totalRevenue,
      };
    });
  },

  GetEvents: ({ customerId } = {}) => {
    // Updated to accept customerId
    let shows = db.shows;

    // Filter shows if a specific customer is requested
    if (customerId) {
      const customerVenues = db.venues
        .filter((v) => v.customerId === customerId)
        .map((v) => v.id);
      shows = shows.filter((s) => customerVenues.includes(s.venueId));
    }

    return shows.map((show) => {
      const venue = db.venues.find((v) => v.id === show.venueId);
      // ... existing mapping logic ...
      const availableCount = show.seats.filter(
        (s) => s.status === 'AVAILABLE'
      ).length;
      const totalSeats = show.seats.length;

      const percentLeft = availableCount / totalSeats;
      const tags = [];
      if (percentLeft < 0.2 && availableCount > 0) tags.push('SELLING FAST 🔥');
      if (show.drinkMinimum) tags.push('2-Drink Min 🍺');

      return {
        id: show.id,
        comedianId: show.comedianId,
        artist: show.artist,
        description: show.description,
        date: show.date,
        venue: venue.name,
        basePrice: show.basePrice,
        available: availableCount,
        tags: tags,
      };
    });
  },

  // Advanced Seating Chart Query
  GetShowDetails: ({ showId }) => {
    const show = db.shows.find((s) => s.id === showId);
    if (!show) throw new Error('Show not found');
    const venue = db.venues.find((v) => v.id === show.venueId);

    // Calculate dimensions
    const rows = venue.layout.length;
    const cols = venue.layout[0].length; // Assume uniform width for now

    // Construct the render grid
    const gridCells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // Find if a seat exists at this coordinate
        const seat = show.seats.find((s) => s.r === r && s.c === c);

        if (seat) {
          gridCells.push({ type: 'SEAT', data: seat });
        } else {
          // It's a gap/aisle
          gridCells.push({ type: 'GAP' });
        }
      }
    }

    return {
      id: show.id,
      artist: show.artist,
      venueName: venue.name,
      rows: rows,
      cols: cols,
      basePrice: show.basePrice,
      drinkMinimum: show.drinkMinimum,
      grid: gridCells, // The visual map
    };
  },

  GetVenues: () =>
    db.venues.map((v) => {
      const customer = db.customers.find((c) => c.id === v.customerId);
      return {
        id: v.id,
        name: v.name,
        ownerName: customer ? customer.name : 'Unknown',
        capacity: v.layout.join('').replace(/\./g, '').length, // Count non-dots
        dims: `${v.layout.length}x${v.layout[0].length}`,
      };
    }),

  GetShowAnalytics: () => {
    return db.shows.map((show) => {
      const venue = db.venues.find((v) => v.id === show.venueId);
      const totalSeats = show.seats.length;
      const soldSeats = show.seats.filter((s) => s.status === 'SOLD').length;

      const showReservations = db.reservations.filter(
        (r) => r.showId === show.id
      );
      const totalRevenue = showReservations.reduce(
        (sum, r) => sum + r.totalPrice,
        0
      );

      return {
        id: show.id,
        artist: show.artist,
        venue: venue.name,
        date: show.date,
        totalSeats,
        soldSeats,
        occupancy:
          totalSeats > 0 ? ((soldSeats / totalSeats) * 100).toFixed(1) : 0,
        revenue: totalRevenue,
      };
    });
  },

  GetAdminDashboard: () => {
    return db.reservations.map((r) => {
      const user = db.users.find((u) => u.id === r.userId);
      const show = db.shows.find((s) => s.id === r.showId);
      return {
        reservationId: r.id,
        userName: user ? user.name : 'Unknown',
        userEmail: user ? user.email : 'Unknown',
        event: show.artist,
        quantity: r.seats.length,
        total: r.totalPrice,
        status: r.status,
        date: r.createdAt,
      };
    });
  },

  GetShowAttendees: ({ showId }) => {
    return db.reservations
      .filter((r) => r.showId === showId && r.status === 'CONFIRMED')
      .map((r) => {
        const user = db.users.find((u) => u.id === r.userId);
        return {
          reservationId: r.id,
          userName: user ? user.name : 'Unknown',
          userEmail: user ? user.email : 'Unknown',
          seats: r.seats.join(', '),
          total: r.totalPrice,
        };
      });
  },

  GetUserTickets: ({ userId }) => {
    return db.reservations
      .filter((r) => r.userId === userId)
      .map((r) => {
        const show = db.shows.find((s) => s.id === r.showId);
        return {
          id: r.id,
          artist: show.artist,
          venue: db.venues.find((v) => v.id === show.venueId).name,
          seats: r.seats.join(', '),
          status: r.status,
          total: r.totalPrice,
          date: show.date,
        };
      });
  },
};

module.exports = { commandHandlers, queryHandlers, seedData };
