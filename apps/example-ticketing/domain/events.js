// domain/events.js
const { v4: uuidv4 } = require('uuid');
const { eventBus } = require('../bus'); // Note: '..' to go up one level
const { readDb, eventJournal } = require('./db');
const { generateSeats } = require('./utils');

// --- PROJECTIONS (Read Model Updaters) ---
const projectors = {
  UserRegistered: (e) => readDb.users.push(e.data),
  CustomerCreated: (e) => readDb.customers.push(e.data),
  ComedianCreated: (e) => readDb.comedians.push(e.data),
  VenueCreated: (e) => readDb.venues.push(e.data),

  ShowCreated: (e) => {
    const venue = readDb.venues.find((v) => v.id === e.data.venueId);
    if (venue) {
      // Hydrate seats for the read model
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

// --- EMIT HELPER ---
const emit = async (type, data) => {
  const event = { id: uuidv4(), type, data, timestamp: new Date() };
  eventJournal.push(event);

  // Simulate Eventual Consistency
  setImmediate(() => eventBus.publish(type, data));
};

module.exports = { emit };
