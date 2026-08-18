import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useRole } from '@/lib/roleContext';
import { apiClient } from '@/lib/apiClient';
import { ACTION_VERB, ENTITY_ROUTE } from '@/lib/activityVerbs';
import { initials } from '@/lib/initials';
import { avatarColorClasses } from '@/lib/avatarColor';
import { cn } from '@/lib/utils';

interface RecentSystemActivityPanelProps {
  limit?: number;
}

/** Stripped-down shape returned by the all-roles `/audit-logs/recent-activity` endpoint - see `RecentActivityPresenter` on the backend for why this omits previousValue/newValue/ipAddress/userAgent. */
interface RecentActivityRecord {
  id: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  createdAt: string;
}

function formatRelative(dateString: string): string {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Dashboard-wide "who's doing what right now" widget - visible to every role (unlike the MIS-only
 * full audit trail at Administration > Activity Logs), backed by the stripped-down
 * `/audit-logs/recent-activity` endpoint so no sensitive audit detail (previous/new values, IP,
 * user agent) leaves the MIS-only surface. Shows the latest meaningful actions across every user
 * and record; VIEW_SECTION (page-view) events are excluded server-side via `excludeActions`.
 */
export function RecentSystemActivityPanel({ limit = 6 }: RecentSystemActivityPanelProps) {
  const { canViewActivityLogs } = useRole();

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', 'recent-activity', limit],
    queryFn: () =>
      apiClient.get<{ items: RecentActivityRecord[] }>(`/audit-logs/recent-activity?limit=${limit}&excludeActions=VIEW_SECTION`),
  });

  const recent = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <p className="text-base font-medium leading-none">Recent system activity</p>
          <p className="mt-1.5 text-sm text-muted-foreground">All users, most recent first</p>
        </div>
        {canViewActivityLogs && (
          <Link to="/admin/activity-logs" className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ul>
            {recent.map((log, index) => {
              const verb = ACTION_VERB[log.action] ?? log.action.toLowerCase().replaceAll('_', ' ');
              const routePrefix = ENTITY_ROUTE[log.entityType];
              return (
                <li key={log.id} className={`flex items-center gap-3 py-2.5 ${index > 0 ? 'border-t' : ''}`}>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
                      avatarColorClasses(log.userName),
                    )}
                  >
                    {initials(log.userName)}
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm">
                    <span className="font-medium">{log.userName ?? 'Unknown user'}</span> {verb}
                    {routePrefix && (
                      <>
                        {' '}
                        <Link to={`${routePrefix}/${log.entityId}`} className="text-primary hover:underline">
                          {log.entityLabel ?? log.entityId}
                        </Link>
                      </>
                    )}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatRelative(log.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
