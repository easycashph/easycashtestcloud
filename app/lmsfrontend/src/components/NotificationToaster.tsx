import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';
import { readMutedTypes } from '@/lib/notificationPreference';
import type { ListNotificationsResponse, Notification } from '@/lib/notificationApiTypes';
import { entityLink, NOTIFICATIONS_POLL_INTERVAL_MS } from '@/components/NotificationBell';
import { cn } from '@/lib/utils';

const AUTO_DISMISS_MS = 6_000;
const MAX_VISIBLE_TOASTS = 4;

/**
 * Popup toast for a newly-arrived notification (2026-09-03 user request, mockup-approved) - the
 * bell's unread badge alone is easy to miss while working in another part of the screen. Rides the
 * same 30s `['notifications']` poll `NotificationBell` already runs (same query key, so React Query
 * shares one request between them) rather than opening a second connection.
 *
 * A notification only toasts the FIRST time it's seen by this browser tab - the initial poll after
 * mount seeds the "already seen" set without toasting (otherwise every page load would replay the
 * last 20 notifications as popups), and only notification ids that show up in a LATER poll trigger
 * a toast. Muted types (Settings > Notifications) are skipped, same as the bell dropdown.
 */
export function NotificationToaster() {
  const { currentAccount } = useRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [toasts, setToasts] = React.useState<Notification[]>([]);
  const seenIdsRef = React.useRef<Set<string> | null>(null);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiClient.get<ListNotificationsResponse>('/notifications?limit=20'),
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
  });

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  React.useEffect(() => {
    const items = notificationsQuery.data?.items;
    if (!items) return;

    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(items.map((n) => n.id));
      return;
    }

    const seen = seenIdsRef.current;
    const fresh = items.filter((n) => !seen.has(n.id));
    if (fresh.length === 0) return;
    fresh.forEach((n) => seen.add(n.id));

    const mutedTypes = readMutedTypes(currentAccount.id);
    const toToast = fresh.filter((n) => !mutedTypes.includes(n.type));
    if (toToast.length === 0) return;

    setToasts((prev) => [...toToast, ...prev].slice(0, MAX_VISIBLE_TOASTS));
    toToast.forEach((n) => {
      window.setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS);
    });
  }, [notificationsQuery.data, currentAccount.id, dismiss]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((notification) => {
        const link = entityLink(notification);
        const handleActivate = () => {
          if (!notification.read) markReadMutation.mutate(notification.id);
          dismiss(notification.id);
          if (link) navigate(link);
        };
        return (
          <div
            key={notification.id}
            role="button"
            tabIndex={0}
            onClick={handleActivate}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleActivate()}
            className={cn(
              'pointer-events-auto grid cursor-pointer grid-cols-[auto_1fr_auto] items-start gap-2.5 rounded-lg border border-l-[3px] border-l-primary bg-card p-3 shadow-lg',
              'animate-in slide-in-from-right-8 fade-in duration-300',
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold leading-snug">{notification.title}</p>
              {notification.body && (
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{notification.body}</p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={(e) => {
                e.stopPropagation();
                dismiss(notification.id);
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
