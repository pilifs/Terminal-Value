import * as Main from './main.js';

Main.runSimulation().then(() => {
  // Simulation complete
  console.log('Simulation finished.');

  // Start server
  Main.startServer();
});
