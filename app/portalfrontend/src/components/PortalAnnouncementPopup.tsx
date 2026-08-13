import * as React from 'react';
import { AlertTriangle, Megaphone } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';

type SystemAnnouncementType = 'MAINTENANCE' | 'NEWS' | 'GENERAL';

interface PublicSystemAnnouncement {
  id: string;
  title: string;
  body: string;
  type: SystemAnnouncementType;
}

const DISMISSED_KEY = 'easycash_portal_dismissed_announcement_id';

/**
 * Attention popup for the active MIS-posted announcement (2026-08-14 user request) - so Portal
 * clients get advance notice of scheduled/emergency maintenance instead of being caught off guard
 * when they suddenly can't access the site. Mounted at the app root regardless of login state -
 * even a not-yet-logged-in visitor on the landing page deserves the heads-up, and the backend
 * route (`GET /portal/announcements/active`) requires no auth for exactly that reason.
 *
 * Polls every 2 minutes. Dismissal is remembered PER ANNOUNCEMENT ID in localStorage (2026-08-14
 * user-confirmed): once closed, that specific announcement never reappears for this browser, but
 * a new one MIS posts later will.
 */
export function PortalAnnouncementPopup() {
  const [announcement, setAnnouncement] = React.useState<PublicSystemAnnouncement | null>(null);
  const [dismissedId, setDismissedId] = React.useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(DISMISSED_KEY),
  );

  React.useEffect(() => {
    let cancelled = false;
    const fetchActive = () => {
      apiClient
        .get<PublicSystemAnnouncement | null>('/portal/announcements/active')
        .then((result) => {
          if (!cancelled) setAnnouncement(result);
        })
        .catch(() => {
          if (!cancelled) setAnnouncement(null);
        });
    };
    fetchActive();
    const interval = window.setInterval(fetchActive, 2 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const handleClose = () => {
    if (!announcement) return;
    window.localStorage.setItem(DISMISSED_KEY, announcement.id);
    setDismissedId(announcement.id);
  };

  const isOpen = Boolean(announcement && announcement.id !== dismissedId);

  return (
    <Dialog open={isOpen} onClose={handleClose} title={announcement?.title ?? ''}>
      {announcement && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${announcement.type === 'MAINTENANCE' ? 'bg-warning/15 text-warning' : 'bg-primary/15 text-primary'}`}>
              {announcement.type === 'MAINTENANCE' ? <AlertTriangle className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{announcement.body}</p>
          </div>
          <Button className="w-full" onClick={handleClose}>
            Got it
          </Button>
        </div>
      )}
    </Dialog>
  );
}
