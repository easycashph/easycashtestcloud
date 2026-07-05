import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/lib/roleContext';
import type { MockActivityLogEntry } from '@/lib/mockData';
import { formatDateTime } from '@/lib/utils';

/**
 * Per-section "Recent Activity" panel — recent-to-oldest, MIS-only (per
 * this checkpoint's access policy: only MIS sees user activity logs).
 * Renders nothing at all for any other role, not even a lock notice —
 * this is meant to be an ambient audit widget, not a page users are
 * expected to request access to.
 */
export function RecentActivityPanel({
  entries,
  limit = 10,
  title = 'Recent Activity',
}: {
  entries: MockActivityLogEntry[];
  limit?: number;
  title?: string;
}) {
  const { canViewActivityLogs } = useRole();
  if (!canViewActivityLogs) return null;

  const recent = entries.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4 text-muted-foreground" /> {title}
        </CardTitle>
        <CardDescription>MIS-only · recent to oldest</CardDescription>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet for this section.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((log) => (
              <li key={log.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {log.action.replaceAll('_', ' ')}
                  </Badge>
                  <span className="font-medium">{log.userName}</span>
                  {log.entityId && <span className="font-mono text-xs text-muted-foreground">{log.entityId}</span>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
