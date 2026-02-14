import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// 1. Serve 'public' as the main root (http://localhost:3000/)
app.use(express.static(path.join(__dirname, 'public')));

// 2. Explicitly serve 'init' and 'store' folders so imports work
//    Request to '/init/startServer.js' -> serves './init/startServer.js'
app.use('/init', express.static(path.join(__dirname, 'init')));
app.use('/store', express.static(path.join(__dirname, 'store')));

// 3. SPA Fallback
//    Use regex /.*/ to avoid the "Missing parameter name" error in newer Express versions
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🎿 Static Sandbox Server running at http://localhost:${PORT}`);
  console.log(`   - App Root: public/`);
  console.log(`   - Mounted:  init/ and store/`);
});
