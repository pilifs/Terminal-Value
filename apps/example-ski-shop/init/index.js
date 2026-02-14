import runSimulation from './runSimulation.js';

// Re-seed the mock data
runSimulation().then(() => {
  // Simulation complete
  console.log('Simulation finished.');
});
