import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Serve the 'public' folder as the root
app.use(express.static(path.join(__dirname, 'public')));

// 2. Expose 'init' and 'store' directories so index.html can import the Mock Server
//    Browser requests to /init/startServer.js will resolve to ./init/startServer.js
app.use('/init', express.static(path.join(__dirname, 'init')));
app.use('/store', express.static(path.join(__dirname, 'store')));

// Fallback for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎿 Static Sandbox Server running at http://localhost:${PORT}`);
  console.log(`   Serving public/, init/, and store/ directories.`);
});
