import { defineConfig, normalizePath } from 'vite'; // 1. Import normalizePath
import path from 'path';
import { fileURLToPath } from 'url';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// --- ESM FIX FOR CLOUDFLARE ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_PATH = 'apps/example-ski-shop';
const root = path.join(APP_PATH, 'public');

// Helper to ensure paths work on Windows for the copy plugin
const dynamicOrderSource = normalizePath(
  path.resolve(__dirname, root, 'components/dynamicOrder')
);
const dynamicHomeSource = normalizePath(
  path.resolve(__dirname, root, 'components/dynamicHome')
);

export default defineConfig({
  root,
  base: './',
  publicDir: false,

  plugins: [
    viteStaticCopy({
      targets: [
        {
          // 2. Use '/**/*' to recursively select every file and subfolder
          src: dynamicOrderSource + '/**/*',
          // 3. Place them inside a folder named 'dynamicOrder' in dist
          dest: 'assets/components/dynamicOrder',
        },
        {
          src: dynamicHomeSource + '/**/*',
          dest: 'assets/components/dynamicHome',
        },
      ],
    }),
  ],

  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, APP_PATH, 'public/index.html'),
        admin: path.resolve(__dirname, APP_PATH, 'public/admin.html'),
      },
    },
  },

  resolve: {
    alias: {
      '/store': path.resolve(__dirname, APP_PATH, 'store'),
    },
  },
});
