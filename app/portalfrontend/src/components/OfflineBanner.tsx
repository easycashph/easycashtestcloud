import * as React from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Persistent "you are offline" indicator.
 *
 * `CLAUDE.md` requires the application to be resilient to temporary internet outages, with clear
 * offline indicators. This matters concretely here: a large share of the audience is on mobile
 * data, and an applicant halfway through the loan form whose connection drops would otherwise just
 * see saves fail silently and assume the site is broken.
 *
 * Uses the browser's own online/offline events. Note the well-known caveat: `navigator.onLine`
 * reports whether there is a network interface, not whether the internet is actually reachable —
 * so this catches "wifi/data dropped" but not "connected to a dead hotspot". Genuine
 * request-level failures are surfaced by each page's own error handling; this banner is the cheap,
 * immediate signal, not a substitute for that.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = React.useState(() => !navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You are offline. Some actions will not work until your connection returns.</span>
    </div>
  );
}
