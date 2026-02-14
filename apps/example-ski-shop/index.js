import * as Main from './main.js';

console.warn(
  'THIS FILE IS NOW DEPRECATED. We only use a client side server now for demo from CDN purposes.'
);

// To view the old CQRS back-end, check out commit: fc119684911d1466defeca0e5409740f709fef64
// Then run `npm start:ski-shop`

Main.runSimulation().then(() => {
  // Simulation complete
  console.log('Simulation finished.');

  // Start server
  Main.startServer();
});
