import { defineConfig } from 'vite';
import path from 'path';

// Define where your app lives relative to this config file
const APP_PATH = 'apps/example-ski-shop';

export default defineConfig({
  // Set the root to your app folder so imports work correctly
  root: APP_PATH,

  // Base URL for relative links (important for CDNs)
  base: './',

  publicDir: false, // We define explicit inputs, so disable default public copying

  build: {
    // Output the build to a 'dist' folder in your project root
    // resolve(__dirname, 'dist') puts it in terminal-value/dist
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      // Point to the index.html inside the public folder
      input: path.resolve(__dirname, APP_PATH, 'public/index.html'),
    },
  },

  resolve: {
    alias: {
      // Map absolute imports (e.g., /init/...) to the correct file system path
      '/init': path.resolve(__dirname, APP_PATH, 'init'),
      '/store': path.resolve(__dirname, APP_PATH, 'store'),
    },
  },
});
