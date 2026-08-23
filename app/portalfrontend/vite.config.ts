import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    // 2026-08-23 (user request): installable app + offline resilience. `manifest: false` because
    // index.html already links its own hand-tuned site.webmanifest (see that file's own comment) -
    // this plugin only needs to generate the service worker. `registerType: 'autoUpdate'` silently
    // swaps in a new service worker on the next load rather than making the portal show a stale
    // cached build after a deploy (a manual "update available" prompt is unnecessary complexity
    // for this app's release cadence). App shell (JS/CSS/HTML/icons) is precached so the portal
    // still loads offline; `/api/` calls are explicitly NOT precached or matched by any runtime
    // rule below, since a cached loan balance or status silently going stale is worse than the
    // existing OfflineBanner honestly telling the borrower they're offline - matches CLAUDE.md's
    // "cached recently viewed data... graceful retry... clear offline indicators", not "serve
    // stale financial data as if it were live".
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false,
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
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
