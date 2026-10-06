import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the built site works from any folder of a static host.
  base: './',
  build: {
    // main.js awaits at the top level, which needs a modern target.
    target: 'es2022',
    chunkSizeWarningLimit: 800, // three.js and the app share one bundle on purpose
  },
});
