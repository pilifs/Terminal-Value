// server.js
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { commandBus, queryBus } = require('./bus');
const { commandHandlers, queryHandlers, seedData } = require('./domain');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Register Handlers
Object.keys(commandHandlers).forEach((key) =>
  commandBus.register(key, commandHandlers[key])
);
Object.keys(queryHandlers).forEach((key) =>
  queryBus.register(key, queryHandlers[key])
);

// --- API Routes ---
app.post('/api/command/:commandName', async (req, res) => {
  try {
    const { commandName } = req.params;
    const result = await commandBus.execute(commandName, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/query/:queryName', async (req, res) => {
  try {
    const { queryName } = req.params;
    const result = await queryBus.execute(queryName, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const PORT = 3002;

// Initialize Simulation Data before starting
seedData();

app.listen(PORT, () =>
  console.log(`TicketMaster Sandbox running on port ${PORT}`)
);
