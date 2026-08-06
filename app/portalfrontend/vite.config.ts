import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Relative base so the build works whether GitHub Pages serves it from the repo root
  // (username.github.io) or a project subpath (username.github.io/easycash-portal/) - avoids
  // hardcoding a path before that hosting decision is finalized.
  base: './',
  server: {
    port: 5199,
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Performance (2026-08-06 user request): split large, rarely-changing third-party
        // dependencies into their own chunk(s), separate from application code. framer-motion in
        // particular is pulled in eagerly by the (deliberately non-lazy) LandingPage, so without
        // this it was bundled directly into the main entry chunk - every app-code deploy forced
        // visitors to re-download framer-motion too, even though it hadn't changed. Splitting it
        // out lets the browser cache it independently across releases.
        manualChunks: {
          'vendor-motion': ['framer-motion'],
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
