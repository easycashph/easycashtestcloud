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
});
