import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { apiClient } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';
import { readMutedTypes } from '@/lib/notificationPreference';
import type { ListNotificationsResponse, Notification } from '@/lib/notificationApiTypes';
import { cn } from '@/lib/utils';

const POLL_INTERVAL_MS = 30_000;

/** Where a notification's `entityType`/`entityId` links to, if anywhere - matches the routes used
 * elsewhere in the app for the same entity types (e.g. LoanApplicationDetailPage's route). */
function entityLink(notification: Notification): string | null {
  if (!notification.entityId) return null;
  if (notification.entityType === 'LoanApplication') return `/applications/${notification.entityId}`;
  if (notification.entityType === 'LoanAccount') return `/loans/${notification.entityId}`;
  return null;
}

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Notification Center (2026-07-17 user request) - bell icon in the Topbar with an unread badge
 * and a dropdown listing recent notifications, backed by the real `GET /notifications` endpoint
 * (see `app/backend/src/modules/notification`). No push/websocket mechanism exists in this
 * codebase, so this polls every 30s while open in a tab - server-side, LOAN_OVERDUE notifications
 * themselves are now created by a real periodic scheduler independent of anyone having the app
 * open (`OverdueNotificationScheduler.ts`), not tied to this poll.
 *
 * Muted types (Settings > Notifications) are filtered out client-side only - the notifications
 * still exist server-side (so unmuting later shows the backlog), this just hides them from this
 * device/account's badge and dropdown.
 */
export function NotificationBell() {
  const { currentAccount } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  // Re-read whenever the dropdown opens - Settings can change this while the bell stays mounted.
  const mutedTypes = React.useMemo(() => readMutedTypes(currentAccount.id), [currentAccount.id, open]);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get<ListNotificationsResponse>('/notifications?limit=20'),
    refetchInterval: POLL_INTERVAL_MS,
  });

  const items = (notificationsQuery.data?.items ?? []).filter((n) => !mutedTypes.includes(n.type));
  const unreadCount = items.filter((n) => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => apiClient.post('/notifications/mark-all-read'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 max-h-[28rem] overflow-y-auto p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>
        {notificationsQuery.isLoading ? (
          <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="divide-y">
            {items.map((notification) => {
              const link = entityLink(notification);
              const body = (
                <div className={cn('flex flex-col gap-0.5 px-3 py-2.5', !notification.read && 'bg-primary/5')}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-sm', !notification.read && 'font-semibold')}>{notification.title}</p>
                    {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  {notification.body && <p className="text-xs text-muted-foreground">{notification.body}</p>}
                  <p className="text-[11px] text-muted-foreground">{timeAgo(notification.createdAt)}</p>
                </div>
              );
              const handleClick = () => {
                if (!notification.read) markReadMutation.mutate(notification.id);
              };
              return (
                <li key={notification.id}>
                  {link ? (
                    <Link to={link} onClick={() => { handleClick(); setOpen(false); }} className="block hover:bg-muted/60">
                      {body}
                    </Link>
                  ) : (
                    <button type="button" onClick={handleClick} className="block w-full text-left hover:bg-muted/60">
                      {body}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
