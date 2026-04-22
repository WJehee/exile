import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://exile.example.com',
  vite: {
    build: {
      // Globe.gl bundles Three.js (~2.4MB unminified) — expected
      chunkSizeWarningLimit: 3000,
    },
  },
});
