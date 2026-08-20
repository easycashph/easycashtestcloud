import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/authContext';
import { usePortalDialogs } from '@/lib/portalDialogContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Dashboard security nudge (2026-08-06 user request) - 2FA already exists (Security tab,
 * ChangePortalPasswordUseCase's sibling RequestEnablePortalTwoFactorUseCase/etc.), it just had no
 * on-dashboard reminder for an account that never turned it on. Renders nothing once the account
 * data has loaded if 2FA is already enabled, or before it's loaded at all - never a flash of a
 * banner that's about to disappear.
 */
export function PortalTwoFactorNudgeCard() {
  const { account } = useAuth();
  const { openSecurityDialog } = usePortalDialogs();
  const { t } = useLanguage();

  if (!account || account.twoFactorEnabled) return null;

  return (
    <Card className="flex flex-col gap-3 border-warning/40 bg-warning/5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t.dashboardCards.twoFactorNudge.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.dashboardCards.twoFactorNudge.body}</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0 border-warning text-warning hover:bg-warning/10" onClick={openSecurityDialog}>
        {t.dashboardCards.twoFactorNudge.cta}
      </Button>
    </Card>
  );
}
