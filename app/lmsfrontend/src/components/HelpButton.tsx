import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getHelpTopic, HELP_TOPICS } from '@/lib/helpContent';

/**
 * In-app Help (2026-07-17 user request) - "?" button in the Topbar, opens a dialog with guidance
 * for whichever page the officer is currently on (see `helpContent.ts`), plus a full list of every
 * section's topic for browsing. No onboarding/help existed anywhere in this app before this.
 */
export function HelpButton() {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();
  const currentTopic = getHelpTopic(location.pathname);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Help">
        <HelpCircle className="h-5 w-5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{currentTopic.title}</DialogTitle>
            <DialogDescription>{currentTopic.summary}</DialogDescription>
          </DialogHeader>
          {currentTopic.tips.length > 0 && (
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {currentTopic.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          )}

          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other sections</p>
            <div className="grid gap-1 sm:grid-cols-2">
              {Object.entries(HELP_TOPICS)
                .filter(([, topic]) => topic.title !== currentTopic.title)
                .map(([path, topic]) => (
                  <p key={path} className="truncate text-xs text-muted-foreground" title={topic.summary}>
                    {topic.title}
                  </p>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
