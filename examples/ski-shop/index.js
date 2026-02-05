const Main = require('./main');

Main.runSimulation().then(() => {
  // Simulation complete
  console.log('Simulation finished.');

  // Start server
  Main.startServer();
});
