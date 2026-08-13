import { Landmark } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { OFFICIAL_BANK_ACCOUNT } from '@/lib/companyInfo';

/**
 * "Official Bank Account" card for the logged-in Dashboard (2026-08-14 user request) - same
 * account details as the public landing page's "Ways to Pay" card, so a client doesn't have to
 * log out or go hunting for where to send a Bank Transfer payment. Deliberately a separate,
 * plain-English component rather than reusing LandingPage's version: the Dashboard/authenticated
 * app is intentionally NOT translated (see translations.ts's own doc comment on scope), so sharing
 * a component would either force English-only text into the public page's `t.landing.*` slots or
 * require threading translation props through a card that has none anywhere else. Values
 * themselves come from the same `OFFICIAL_BANK_ACCOUNT` single source of truth either way.
 */
export function PortalOfficialBankAccountCard() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="h-1.5 bg-primary" />
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">Official Bank Account</h2>
            <p className="mt-1 text-sm text-muted-foreground">Send your Bank Transfer payment here, then upload your proof of payment below.</p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">Account Name</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.accountName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">Bank Name</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.bankName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">Branch</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.branch}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">Account No.</dt>
                <dd className="font-mono font-semibold text-primary">{OFFICIAL_BANK_ACCOUNT.accountNo}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Card>
  );
}
