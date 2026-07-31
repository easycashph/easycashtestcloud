import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/lib/roleContext';
import { apiClient } from '@/lib/apiClient';
import { ACTION_VERB, ENTITY_ROUTE } from '@/lib/activityVerbs';
import { initials } from '@/lib/initials';
import type { AuditLog } from '@/lib/auditLogApiTypes';
import { formatDateTime } from '@/lib/utils';

/** action -> a sentence-builder given the panel's own `label` and the log's `entityId`. Actions not
 * listed here fall back to the original generic Badge + entityId rendering below, so every other
 * page using this component (each with its own actions) is unaffected. 2026-07-30 (user request):
 * "VIEW SECTION" on every row read as repetitive noise with no way to tell what was actually done. */
const ACTIVITY_SENTENCE: Record<string, (label: string, entityId: string | null) => string> = {
  VIEW_SECTION: (label) => `viewed ${label}`,
  FILTER_SECTION: (label, entityId) => (entityId ? `filtered ${label} by ${entityId}` : `filtered ${label}`),
  OPEN_SIGNING_LOG: (_label, entityId) => (entityId ? `opened signing log for loan ${entityId}` : 'opened a signing log'),
};

interface RecentActivityPanelProps {
  /** Section name - builds the title ("Recent {label} Activity") and, unless `entityTypes` is given, is the sole entityType filter. */
  label: string;
  /** entityType values to match (view events use the page label; write events use the domain entity name, e.g. "LoanApplication"). Defaults to [label]. */
  entityTypes?: string[];
  /** Scope to a single record (shared by both view and write events for that record) - used on detail pages instead of entityTypes. */
  entityId?: string;
  limit?: number;
}

/**
 * Per-section "Recent Activity" panel - recent-to-oldest, MIS-only (per
 * this checkpoint's access policy: only MIS sees user activity logs).
 * Renders nothing at all for any other role, not even a lock notice -
 * this is meant to be an ambient audit widget, not a page users are
 * expected to request access to. Backed by the real `/audit-logs` audit
 * trail (same source as Administration > Activity Logs), scoped to this
 * page/record only.
 *
 * 2026-07-11 (user request): default limit lowered 10 -> 5 — 10 full-width entry cards took up
 * too much vertical space on a page that already has its own primary content above this panel. A
 * "View All Activity" link to the dedicated Activity Logs page (/admin/activity-logs) covers the
 * full history instead of growing this panel indefinitely; shown when the result was capped at
 * `limit` (a good proxy for "there's more" without a separate total-count request).
 */
export function RecentActivityPanel({ label, entityTypes, entityId, limit = 5 }: RecentActivityPanelProps) {
  const { canViewActivityLogs } = useRole();

  const params = new URLSearchParams();
  params.set('limit', String(limit));
  if (entityId) {
    params.set('entityId', entityId);
  } else {
    params.set('entityType', (entityTypes ?? [label]).join(','));
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', 'recent', label, entityTypes, entityId, limit],
    queryFn: () => apiClient.get<{ items: AuditLog[] }>(`/audit-logs?${params.toString()}`),
    enabled: canViewActivityLogs,
  });

  if (!canViewActivityLogs) return null;

  const recent = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" /> Recent {label} Activity Logs
          </CardTitle>
          <CardDescription>MIS-only · recent to oldest</CardDescription>
        </div>
        {recent.length === limit && (
          <Link to="/admin/system?tab=activity-logs" className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline">
            View All Activity
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No activity recorded yet for this section.</p>
        ) : (
          <ul className="space-y-2">
            {recent.map((log) => {
              const sentence = ACTIVITY_SENTENCE[log.action]?.(label, log.entityId);
              const staticVerb = ACTION_VERB[log.action];
              const routePrefix = ENTITY_ROUTE[log.entityType];
              return (
                <li key={log.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {initials(log.userName)}
                    </div>
                    {sentence ? (
                      <p className="min-w-0 text-sm">
                        <span className="font-medium">{log.userName ?? 'Unknown user'}</span> {sentence}
                      </p>
                    ) : staticVerb ? (
                      <p className="min-w-0 text-sm">
                        <span className="font-medium">{log.userName ?? 'Unknown user'}</span> {staticVerb}
                        {routePrefix && log.entityId && (
                          <>
                            {' '}
                            <Link to={`${routePrefix}/${log.entityId}`} className="text-primary hover:underline">
                              {log.entityLabel ?? log.entityId}
                            </Link>
                          </>
                        )}
                      </p>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {log.action.replaceAll('_', ' ')}
                        </Badge>
                        <span className="shrink-0 font-medium">{log.userName ?? '-'}</span>
                        {log.entityId && <span className="truncate font-mono text-xs text-muted-foreground">{log.entityLabel ?? log.entityId}</span>}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
