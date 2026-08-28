import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient, ApiError } from '@/lib/apiClient';

interface ForceTwoFactorSetupModalProps {
  userEmail: string;
  /** Re-fetches `/auth/me` (`RoleProvider.refreshCurrentUser`) - once the backend confirms setup,
   * `twoFactorSetupRequired` flips to false and `RoleProvider` renders the real app instead of
   * this modal. */
  onCompleted: () => Promise<void>;
  /** An escape hatch for someone who isn't ready to set this up right now - matches every other
   * 2FA screen in this app (Settings > Security), which never traps an account with no way out. */
  onLogout: () => Promise<void>;
}

/**
 * "Require 2FA for all users" (2026-08-28 user request) - `RoleProvider` renders this INSTEAD OF
 * the app's normal layout whenever `AuthenticatedUserView.twoFactorSetupRequired` is true. A real
 * session already exists at this point (LoginUseCase never withheld tokens for this), so this
 * reuses the exact same self-service endpoints as Settings > Security > Two-Factor Authentication's
 * "Disabled" state (`POST /users/me/two-factor/setup` then `/confirm`) - no new backend flow, no
 * way to flip `twoFactorEnabled` without proving receipt of a real code first (same invariant every
 * other 2FA path in this app already upholds).
 */
export function ForceTwoFactorSetupModal({ userEmail, onCompleted, onLogout }: ForceTwoFactorSetupModalProps) {
  const [channel, setChannel] = React.useState<'EMAIL' | 'SMS'>('EMAIL');
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState('');
  const [message, setMessage] = React.useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [loggingOut, setLoggingOut] = React.useState(false);

  const requestSetupMutation = useMutation({
    mutationFn: () => apiClient.post<{ challengeId: string }>('/users/me/two-factor/setup', { channel }),
    onSuccess: (result) => {
      setChallengeId(result.challengeId);
      setMessage({ tone: 'success', text: `Code sent via ${channel === 'EMAIL' ? 'email' : 'SMS'}.` });
    },
    onError: (error: unknown) =>
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Could not send a code. Please try again.' }),
  });

  const confirmSetupMutation = useMutation({
    mutationFn: () => apiClient.post('/users/me/two-factor/confirm', { challengeId, code: code.trim() }),
    onSuccess: () => {
      onCompleted();
    },
    onError: (error: unknown) =>
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Could not confirm that code. Please try again.' }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Two-factor authentication required</CardTitle>
          <CardDescription>
            Your administrator now requires every account to have two-factor authentication enabled. Set it up below to continue to
            your account, <span className="font-medium text-foreground">{userEmail}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p className={message.tone === 'error' ? 'flex items-center gap-2 text-sm text-destructive' : 'text-sm text-success'}>
              {message.tone === 'error' && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
              {message.text}
            </p>
          )}

          {!challengeId ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Send code via</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as 'EMAIL' | 'SMS')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="SMS">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={requestSetupMutation.isPending}
                onClick={() => requestSetupMutation.mutate()}
              >
                {requestSetupMutation.isPending ? 'Sending…' : 'Send Code'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="force-2fa-code">Verification Code</Label>
                <Input id="force-2fa-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!code.trim() || confirmSetupMutation.isPending}
                  onClick={() => confirmSetupMutation.mutate()}
                >
                  {confirmSetupMutation.isPending ? 'Confirming…' : 'Confirm'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setChallengeId(null);
                    setCode('');
                    setMessage(null);
                  }}
                >
                  Back
                </Button>
              </div>
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 text-center text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-60"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              await onLogout();
            }}
          >
            <LogOut className="h-3 w-3" /> Not now - log out
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
