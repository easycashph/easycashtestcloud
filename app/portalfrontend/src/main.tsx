import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import UnderDevelopment from './UnderDevelopment';
import './index.css';

// 2026-09-10 (user request): Portal taken offline again - back to the "Under Development"
// placeholder, reversing the 2026-09-10 re-enable (which itself reversed the original 2026-09-08
// takedown). The tunnel that would back a live deployment is down again too - see
// `Start Cloudflare Tunnel (Auto-Update).ps1`. Swap `<App />` back in here when the Portal returns.
//
// 2026-09-14: briefly swapped to `<App />` for local-only testing of the semi-major client-portal
// redesign (persistent nav shell, first-login profile gate, dashboard redesign); reverted back to
// this placeholder afterward per the same reasoning above - this toggle is unrelated to that work.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <UnderDevelopment />
  </React.StrictMode>,
);

// Only runs in the built app - vite-plugin-pwa's dev-time SW is disabled by default, and the
// virtual module resolves to a no-op during `vite dev` anyway. `immediate: true` since this app
// has no "reload to update" prompt (see vite.config.ts's registerType: 'autoUpdate' comment).
registerSW({ immediate: true });
