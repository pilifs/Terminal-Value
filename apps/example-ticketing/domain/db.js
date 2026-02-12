// domain/db.js

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

module.exports = { eventJournal, readDb };
