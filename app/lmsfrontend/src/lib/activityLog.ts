import * as React from 'react';
import { apiClient } from './apiClient';

/**
 * Logs one "viewed this section" activity entry per mount - satisfies the
 * "every section must log user activity, including just viewing/visiting
 * it" requirement. Call once at the top of a page component.
 *
 * Fire-and-forget against the real backend (`POST /audit-logs/view`): a
 * failed view-log write must never block or error the page itself, so
 * failures are swallowed here rather than surfaced.
 */
export function useLogPageView(sectionLabel: string, entityId?: string): void {
  React.useEffect(() => {
    apiClient.post('/audit-logs/view', { section: sectionLabel, entityId }).catch(() => {
      // Best-effort - page views are observability, not a page dependency.
    });
    // Intentionally logs once per mount (section/entity change), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionLabel, entityId]);
}

/**
 * Logs a specific in-section interaction (filtering, opening a specific record) instead of the
 * generic "viewed this section" event `useLogPageView` fires on mount - call this on demand from
 * an event handler, not as a hook. 2026-07-30 (user request): "Recent activity" panels read as
 * repetitive noise ("viewed X" over and over) with no way to tell what was actually done; giving
 * specific actions their own name lets `RecentActivityPanel` render a real sentence instead.
 * Fire-and-forget, same as `useLogPageView` - a failed write must never block the interaction it
 * describes.
 */
export function logActivity(sectionLabel: string, action: string, entityId?: string): void {
  apiClient.post('/audit-logs/view', { section: sectionLabel, action, entityId }).catch(() => {
    // Best-effort - activity logging is observability, not a page dependency.
  });
}
