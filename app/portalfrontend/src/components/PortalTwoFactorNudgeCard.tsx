import { ShieldAlert } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/authContext';
import { usePortalDialogs } from '@/lib/portalDialogContext';

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

  if (!account || account.twoFactorEnabled) return null;

  return (
    <Card className="flex flex-col gap-3 border-warning/40 bg-warning/5 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Secure your account</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Two-factor authentication is off. Turn it on so a code is required to log in, even if someone else knows your password.
          </p>
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0 border-warning text-warning hover:bg-warning/10" onClick={openSecurityDialog}>
        Turn On 2FA
      </Button>
    </Card>
  );
}
