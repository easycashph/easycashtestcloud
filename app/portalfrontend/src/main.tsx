import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import UnderDevelopment from './UnderDevelopment';
import './index.css';

// 2026-09-08 (user request): Portal is being taken offline for rework - rendering the plain
// placeholder instead of `<App />` so visitors see "Under Development" instead of a UI that would
// otherwise fail every backend call (the tunnel that used to back this deployment is down and no
// longer being refreshed - see `Start Cloudflare Tunnel (Auto-Update).ps1`). Swap `<App />` back in
// here when the Portal returns; nothing else in this app was touched.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnderDevelopment />
  </React.StrictMode>,
);

// Only runs in the built app - vite-plugin-pwa's dev-time SW is disabled by default, and the
// virtual module resolves to a no-op during `vite dev` anyway. `immediate: true` since this app
// has no "reload to update" prompt (see vite.config.ts's registerType: 'autoUpdate' comment).
registerSW({ immediate: true });
