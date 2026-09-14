import { Outlet } from 'react-router-dom';
import { PortalHeader } from '@/components/PortalHeader';
import { PortalProfileSetupGate } from '@/components/PortalProfileSetupGate';

/**
 * Parent route element for every authenticated Portal page (Dashboard, Application Form, My
 * Profile, Security, Loan Products - see App.tsx's route tree). 2026-09-14 (semi-major portal
 * redesign, user request: "navbar/sidebar must remain fixed and consistently accessible ... it
 * should not disappear or shift when navigating between pages").
 *
 * Previously each page rendered its own `<div className="min-h-screen bg-secondary/30">` +
 * `<PortalHeader />` independently, so React Router remounted the header on every navigation
 * between them (a visible flicker, and no way to keep e.g. a mobile menu state across a nav).
 * Consolidating that chrome here, with page content rendered via `<Outlet/>`, means the header
 * mounts once for the whole authenticated session.
 *
 * `PortalProfileSetupGate` sits inside the header (so a client can still open Security/log out
 * while completing their profile) but outside each page's own content - see that component's own
 * doc comment for why first-login completion is gated here rather than per-page.
 */
export function PortalAppShell() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />
      <PortalProfileSetupGate>
        <Outlet />
      </PortalProfileSetupGate>
    </div>
  );
}
