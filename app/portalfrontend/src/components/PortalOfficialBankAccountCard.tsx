import { Landmark } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { OFFICIAL_BANK_ACCOUNT } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * "Official Bank Account" card for the logged-in Dashboard (2026-08-14 user request) - same
 * account details as the public landing page's "Ways to Pay" card, so a client doesn't have to
 * log out or go hunting for where to send a Bank Transfer payment. Values come from the same
 * `OFFICIAL_BANK_ACCOUNT` single source of truth as the public page's version.
 *
 * 2026-08-20: now translated (t.dashboardCards.officialBankAccount) - the Dashboard/authenticated
 * app used to be deliberately English-only, see translations.ts's own doc comment for why that
 * scope was superseded.
 */
export function PortalOfficialBankAccountCard() {
  const { t } = useLanguage();
  return (
    <Card className="overflow-hidden p-0">
      <div className="h-1.5 bg-primary" />
      <div className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold">{t.dashboardCards.officialBankAccount.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.dashboardCards.officialBankAccount.body}</p>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">{t.dashboardCards.officialBankAccount.accountName}</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.accountName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">{t.dashboardCards.officialBankAccount.bankName}</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.bankName}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">{t.dashboardCards.officialBankAccount.branch}</dt>
                <dd className="font-medium">{OFFICIAL_BANK_ACCOUNT.branch}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-0.5">
                <dt className="text-muted-foreground">{t.dashboardCards.officialBankAccount.accountNo}</dt>
                <dd className="font-mono font-semibold text-primary">{OFFICIAL_BANK_ACCOUNT.accountNo}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </Card>
  );
}
