import { defineConfig } from 'vite';
import { resolve } from 'path';

// Ensure both index.html (landing) and viewer.html (viewer) are built and deployed
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        viewer: resolve(__dirname, 'viewer.html'),
      },
    },
  },
});
