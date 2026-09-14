import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

// 2026-09-14 (user request): Portal re-enabled again, reversing the 2026-09-10 takedown (itself a
// reversal of a 2026-09-08 re-enable...) - see git history on this file for the full back-and-forth.
// Swap back to `<UnderDevelopment />` if the Portal needs to go offline again (e.g. the Cloudflare
// tunnel backing the live deployment goes down - `Start Cloudflare Tunnel (Auto-Update).ps1`).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Only runs in the built app - vite-plugin-pwa's dev-time SW is disabled by default, and the
// virtual module resolves to a no-op during `vite dev` anyway. `immediate: true` since this app
// has no "reload to update" prompt (see vite.config.ts's registerType: 'autoUpdate' comment).
registerSW({ immediate: true });
