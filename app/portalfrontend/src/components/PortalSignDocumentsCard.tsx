import * as React from 'react';
import { PenLine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/apiClient';
import type { PortalPendingSigningSession } from '@/lib/portalApiTypes';

/**
 * Dashboard "Sign Documents" prompt (2026-08-20, Portal e-signature user request) - every one of
 * the client's loan accounts with at least one document still waiting for their signature,
 * surfaced at a glance so they don't have to go hunting through each loan. Renders nothing at all
 * once loaded if there's nothing pending - same "never a placeholder implying something exists"
 * posture as `PortalLoanAccountsSection`/`PortalNextPaymentDueCard`.
 */
export function PortalSignDocumentsCard() {
  const navigate = useNavigate();
  const [sessions, setSessions] = React.useState<PortalPendingSigningSession[] | null>(null);

  const refetch = React.useCallback(() => {
    apiClient
      .get<{ items: PortalPendingSigningSession[] }>('/portal/signing-sessions')
      .then((res) => setSessions(res.items))
      .catch(() => setSessions([]));
  }, []);

  React.useEffect(() => {
    refetch();
  }, [refetch]);

  if (!sessions || sessions.length === 0) return null;

  const totalUnsigned = sessions.reduce((sum, s) => sum + (s.documentCount - s.documentsSignedCount), 0);

  return (
    <Card className="flex flex-col gap-3 border-primary/30 bg-primary/5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <PenLine className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            {totalUnsigned} document{totalUnsigned === 1 ? '' : 's'} waiting for your signature
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {sessions.map((s) => s.loanCode).join(', ')} - sign online, no need to visit a branch.
          </p>
        </div>
      </div>
      <Button size="sm" onClick={() => navigate(`/sign/${sessions[0]!.sessionId}`)}>
        Sign now
      </Button>
    </Card>
  );
}
