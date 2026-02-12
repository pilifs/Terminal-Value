// domain/index.js
const { commandHandlers } = require('./commands');
const { queryHandlers } = require('./queries');
const { seedData } = require('./seed');

module.exports = {
  commandHandlers,
  queryHandlers,
  seedData,
};
