// domain/commands.js
const { v4: uuidv4 } = require('uuid');
const { emit } = require('./events');
const { readDb } = require('./db');

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
    };
    await emit('ShowCreated', newShow);
    return { success: true, showId: newShow.id };
  },

  ReserveTickets: async ({ userId, showId, seatIds }) => {
    const show = readDb.shows.find((s) => s.id === showId);
    if (!show) throw new Error('Show not found');

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

module.exports = { commandHandlers };
