// domain/queries.js
const { readDb } = require('./db');

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

module.exports = { queryHandlers };
