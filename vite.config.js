import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

// --- ESM FIX FOR CLOUDFLARE ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_PATH = 'apps/example-ski-shop';

export default defineConfig({
  root: APP_PATH,
  base: './', // Ensures assets work on any path (like /public/)
  publicDir: false,

  build: {
    // Force output to the root 'dist' folder
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: path.resolve(__dirname, APP_PATH, 'public/index.html'),
    },
  },

  resolve: {
    alias: {
      '/init': path.resolve(__dirname, APP_PATH, 'init'),
      '/store': path.resolve(__dirname, APP_PATH, 'store'),
    },
  },
});
