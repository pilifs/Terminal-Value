import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// --- SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());

// --- HELPER: Scan for Component Versions ---
// Looks inside: public/components/dynamic{Type}/{hash}/{type}Page-{clientId}.js
function getComponentVersions(type, clientId) {
  const baseDir = path.join(__dirname, `public/components/dynamic${type}`);

  if (!fs.existsSync(baseDir)) return [];

  try {
    const hashDirs = fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    return hashDirs.filter((hash) => {
      const filePath = path.join(
        baseDir,
        hash,
        `${type.toLowerCase()}Page-${clientId}.js`
      );
      return fs.existsSync(filePath);
    });
  } catch (err) {
    console.error(`Error scanning versions for ${type}:`, err);
    return [];
  }
}

// --- 1. STATIC FILE SERVING ---

// Main App Root
app.use(express.static(path.join(__dirname, 'public')));

// Mount specific source folders so browser ESM imports work
// (e.g., import ... from '/store/projections.js')
app.use('/init', express.static(path.join(__dirname, 'init')));
app.use('/store', express.static(path.join(__dirname, 'store')));

// --- 2. API ROUTES (Must be before SPA Fallback) ---

app.get('/api/components/:clientId', (req, res) => {
  const { clientId } = req.params;

  // Scan the file system for this client's specific component versions
  const homeVersions = getComponentVersions('Home', clientId);
  const orderVersions = getComponentVersions('Order', clientId);

  res.json({
    clientId,
    customHomeVersions: homeVersions,
    customOrderVersions: orderVersions,
  });
});

// --- 3. SPA FALLBACK ---

// Catch-all to serve index.html for non-API routes (Client-side routing support)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- START ---
app.listen(PORT, () => {
  console.log(
    `\n🎿 Sandbox & Component Server running at http://localhost:${PORT}`
  );
  console.log(`   - Static: public/ (root), init/, store/`);
  console.log(`   - API:    /api/components/:clientId`);
});
