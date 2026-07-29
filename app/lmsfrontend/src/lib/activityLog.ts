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
