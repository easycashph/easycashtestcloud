import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useRole } from '@/lib/roleContext';
import { apiClient } from '@/lib/apiClient';

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

/** action -> verb phrase applied to "{userName} {verb} {entity link, if any}". No trailing punctuation. */
const ACTION_VERB: Record<string, string> = {
  ACTIVATE_LOAN: 'disbursed loan',
  ADJUST_FEES: 'adjusted fees on',
  APPROVE_LOAN: 'approved loan',
  APPROVE_LOAN_APPLICATION: 'approved application',
  CHANGE_OWN_PASSWORD: 'changed their password',
  CREATE_CO_BORROWER: 'added a co-borrower to',
  CREATE_MEMBER: 'created a new user account',
  CREATE_ROLE_CLASS: 'created a role class',
  DECLINE_LOAN_APPLICATION: 'declined application',
  DELETE_LOAN_NOTE: 'deleted a note on',
  LOGIN_FAILED: 'failed to log in',
  LOGIN_SUCCESS: 'logged in',
  PROCESS_PAYMENT: 'recorded a payment on',
  REDUCE_PENALTY: 'reduced a penalty on',
  REJECT_LOAN: 'rejected loan',
  REVERSE_PAYMENT: 'reversed a payment on',
  REVERT_LOAN_APPLICATION_DECISION: 'reverted the decision on',
  START_LOAN_APPLICATION_REVIEW: 'started reviewing',
  TAG_LOAN_APPLICATION_PRE_APPROVAL: 'tagged pre-approval on',
  UNDO_ACTIVATE_LOAN: 'undid the disbursement of',
  UNDO_APPROVE_LOAN: 'undid the approval of',
  UPDATE_LOAN_APPLICATION_REVIEW_REPORT: 'updated the review report on',
  UPDATE_ROLE_CLASS: 'updated a role class',
};

/** entityType -> route prefix for records worth linking to. Everything else renders as plain text. */
const ENTITY_ROUTE: Record<string, string> = {
  LoanAccount: '/loans',
  LoanApplication: '/applications',
};

function initials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
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
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
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
