import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Only runs in the built app - vite-plugin-pwa's dev-time SW is disabled by default, and the
// virtual module resolves to a no-op during `vite dev` anyway. `immediate: true` since this app
// has no "reload to update" prompt (see vite.config.ts's registerType: 'autoUpdate' comment).
registerSW({ immediate: true });
