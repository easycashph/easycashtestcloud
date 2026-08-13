import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Megaphone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';
import type { SystemAnnouncement } from '@/lib/systemAnnouncementApiTypes';

const DISMISSED_KEY = 'easycash_lms_dismissed_announcement_id';

/**
 * Attention popup for the active MIS-posted announcement (2026-08-14 user request) - so LMS staff
 * get advance notice of scheduled/emergency maintenance instead of being caught off guard when
 * they suddenly can't access the system. Polls every 2 minutes (a maintenance heads-up posted
 * while someone's tab is already open should still reach them) - not sensitive data, so a public,
 * low-frequency poll is fine.
 *
 * Dismissal is remembered PER ANNOUNCEMENT ID in localStorage (2026-08-14 user-confirmed): once
 * closed, that specific announcement never reappears for this browser, but a new one MIS posts
 * later will.
 */
export function SystemAnnouncementPopup() {
  const [dismissedId, setDismissedId] = React.useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(DISMISSED_KEY),
  );

  const announcementQuery = useQuery({
    queryKey: ['system-announcement-active'],
    queryFn: () => apiClient.get<SystemAnnouncement | null>('/system-announcements/active'),
    refetchInterval: 2 * 60 * 1000,
  });

  const announcement = announcementQuery.data;
  const isOpen = Boolean(announcement && announcement.id !== dismissedId);

  const handleClose = () => {
    if (!announcement) return;
    window.localStorage.setItem(DISMISSED_KEY, announcement.id);
    setDismissedId(announcement.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {announcement?.type === 'MAINTENANCE' ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <Megaphone className="h-5 w-5 text-primary" />
            )}
            {announcement?.title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap pt-2 text-sm text-foreground">{announcement?.body}</DialogDescription>
        </DialogHeader>
        <Button className="mt-2 w-full" onClick={handleClose}>
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
