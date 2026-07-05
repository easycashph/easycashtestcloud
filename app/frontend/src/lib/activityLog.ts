import * as React from 'react';
import { useRole } from './roleContext';
import { logActivity } from './mockData';

/**
 * Logs one "viewed this section" activity entry per mount — satisfies the
 * "every section must log user activity, including just viewing/visiting
 * it" requirement. Call once at the top of a page component.
 */
export function useLogPageView(sectionLabel: string, entityId?: string): void {
  const { currentAccount } = useRole();
  React.useEffect(() => {
    logActivity({
      userName: currentAccount.name,
      action: 'VIEW_SECTION',
      entityType: sectionLabel,
      entityId: entityId ?? sectionLabel,
      at: new Date().toISOString(),
    });
    // Intentionally logs once per mount (section/entity change), not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionLabel, entityId]);
}
