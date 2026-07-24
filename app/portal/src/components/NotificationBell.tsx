import * as React from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import type { PortalNotification, PortalNotificationListResponse } from '@/lib/portalApiTypes';

/** Portal Notification Center bell (2026-07-24 user request, Phase C) - polls unread count every
 * 30s (same interval the staff-facing NotificationBell already uses), independent of whether the
 * dropdown is open, so the badge stays live across the whole session. */
const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [items, setItems] = React.useState<PortalNotification[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const refreshUnreadCount = React.useCallback(() => {
    apiClient
      .get<PortalNotificationListResponse>('/portal/notifications?limit=1')
      .then((res) => setUnreadCount(res.unreadCount))
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refreshUnreadCount]);

  React.useEffect(() => {
    if (!open) return;
    apiClient
      .get<PortalNotificationListResponse>('/portal/notifications?limit=20')
      .then((res) => {
        setItems(res.items);
        setUnreadCount(res.unreadCount);
      })
      .catch(() => setItems([]));
  }, [open]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (notification: PortalNotification) => {
    if (notification.read) return;
    setItems((prev) => (prev ? prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)) : prev));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await apiClient.patch(`/portal/notifications/${notification.id}/read`, undefined, true);
    } catch {
      // Best-effort - a stale unread badge self-corrects on the next poll.
    }
  };

  const handleMarkAllRead = async () => {
    setItems((prev) => (prev ? prev.map((n) => ({ ...n, read: true })) : prev));
    setUnreadCount(0);
    try {
      await apiClient.post('/portal/notifications/mark-all-read', undefined, true);
    } catch {
      // Best-effort - see handleMarkRead.
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-xl border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            {unreadCount > 0 && (
              <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-primary hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              items.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleMarkRead(notification)}
                  className={cn(
                    'block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-secondary/60',
                    !notification.read && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!notification.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    <div className={cn(!notification.read ? 'ml-0' : 'ml-4')}>
                      <p className="text-sm font-medium">{notification.title}</p>
                      {notification.body && notification.body !== notification.title && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{notification.body}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
