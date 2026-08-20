import * as React from 'react';
import { MessageCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { apiClient } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';

interface PortalAssignedLoanOfficer {
  firstName: string;
}

/**
 * "Chat with your loan officer" dashboard card (2026-08-06 user request) - shows only the FIRST
 * NAME of the client's assigned loan officer, if one exists (privacy - never the last name). Per
 * explicit user decision, there is no guarantee every client has one specifically assigned; when
 * there isn't, this falls back to a generic "a loan officer will respond via chat" message rather
 * than showing nothing or implying a specific person is unavailable. Points to the floating chat
 * widget (bottom-right) rather than opening it directly - the widget has no external "open"
 * control today, and this card's job is just to set the right expectation before the client clicks it.
 */
export function PortalLoanOfficerCard() {
  const { t } = useLanguage();
  const [loanOfficer, setLoanOfficer] = React.useState<PortalAssignedLoanOfficer | null | undefined>(undefined);

  React.useEffect(() => {
    apiClient
      .get<PortalAssignedLoanOfficer | null>('/portal/loan-officer')
      .then(setLoanOfficer)
      .catch(() => setLoanOfficer(null));
  }, []);

  if (loanOfficer === undefined) return null;

  return (
    <Card className="flex items-center gap-3 p-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <MessageCircle className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-base font-semibold">{t.dashboardCards.loanOfficer.title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {loanOfficer
            ? t.dashboardCards.loanOfficer.withOfficer.replace('{name}', loanOfficer.firstName)
            : t.dashboardCards.loanOfficer.withoutOfficer}
        </p>
      </div>
    </Card>
  );
}
