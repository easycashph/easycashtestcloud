import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { PortalHeader } from '@/components/PortalHeader';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import type { PortalOtpChannel } from '@/lib/portalApiTypes';

function channelLabel(channel: PortalOtpChannel): string {
  if (channel === 'BOTH') return 'email address and mobile number';
  return channel === 'SMS' ? 'mobile number' : 'email address';
}

/** Portal Security tab (2026-07-27 user request): self-service login email and password change.
 * Both require the current password (see backend's ChangePortalEmailUseCase/
 * ChangePortalPasswordUseCase doc comments for why).
 *
 * 2026-07-30 (Login 2FA, user request): the "Coming soon" placeholder is now a real on/off toggle,
 * defaulting ON at sign-up. Turning it back on (or switching channel) requires proving the code
 * was received first (RequestEnableTwoFactorUseCase / ConfirmEnableTwoFactorUseCase); turning it
 * off only requires the current password (DisableTwoFactorUseCase) - same asymmetric posture as
 * the internal LMS's own staff-side 2FA. */
export function SecurityPage() {
  const { account, refreshAccount } = useAuth();

  const [newEmail, setNewEmail] = React.useState('');
  const [emailPassword, setEmailPassword] = React.useState('');
  const [emailState, setEmailState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [emailError, setEmailError] = React.useState('');

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordState, setPasswordState] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = React.useState('');

  const [twoFaChannel, setTwoFaChannel] = React.useState<PortalOtpChannel>(account?.twoFactorChannel ?? 'EMAIL');
  const [twoFaChallengeId, setTwoFaChallengeId] = React.useState<string | null>(null);
  const [twoFaCode, setTwoFaCode] = React.useState('');
  const [twoFaDisablePassword, setTwoFaDisablePassword] = React.useState('');
  const [twoFaState, setTwoFaState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [twoFaError, setTwoFaError] = React.useState('');
  const [twoFaMessage, setTwoFaMessage] = React.useState('');

  const handleRequestEnable = async (event: React.FormEvent) => {
    event.preventDefault();
    setTwoFaState('saving');
    setTwoFaError('');
    setTwoFaMessage('');
    try {
      const result = await apiClient.post<{ challengeId: string }>('/portal/security/2fa/request-enable', { channel: twoFaChannel }, true);
      setTwoFaChallengeId(result.challengeId);
      setTwoFaState('idle');
      setTwoFaMessage(`Code sent to your ${channelLabel(twoFaChannel)}.`);
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setTwoFaState('error');
    }
  };

  const handleConfirmEnable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!twoFaChallengeId) return;
    setTwoFaState('saving');
    setTwoFaError('');
    try {
      await apiClient.post('/portal/security/2fa/confirm-enable', { challengeId: twoFaChallengeId, code: twoFaCode.trim() }, true);
      setTwoFaChallengeId(null);
      setTwoFaCode('');
      setTwoFaMessage('');
      setTwoFaState('idle');
      await refreshAccount();
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setTwoFaState('error');
    }
  };

  const handleDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    setTwoFaState('saving');
    setTwoFaError('');
    try {
      await apiClient.post('/portal/security/2fa/disable', { currentPassword: twoFaDisablePassword }, true);
      setTwoFaDisablePassword('');
      setTwoFaState('idle');
      await refreshAccount();
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setTwoFaState('error');
    }
  };

  const handleChangeEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailState('saving');
    setEmailError('');
    try {
      await apiClient.patch('/portal/security/email', { newEmail: newEmail.trim(), currentPassword: emailPassword }, true);
      setEmailState('saved');
      setEmailPassword('');
      setNewEmail('');
      await refreshAccount();
    } catch (err) {
      setEmailError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setEmailState('error');
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      setPasswordState('error');
      return;
    }
    setPasswordState('saving');
    setPasswordError('');
    try {
      await apiClient.post('/portal/security/change-password', { currentPassword, newPassword }, true);
      setPasswordState('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setPasswordState('error');
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />

      <main className="container max-w-2xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your login email and password.</p>

        <Card className="mt-8 p-6">
          <h2 className="text-base font-semibold">Login Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">Current email: {account?.email}</p>
          <form onSubmit={handleChangeEmail} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>New email</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <PasswordInput value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
            </div>
            {emailState === 'error' && <Alert tone="error">{emailError}</Alert>}
            {emailState === 'saved' && <Alert tone="success">Login email updated.</Alert>}
            <Button type="submit" disabled={emailState === 'saving'}>
              {emailState === 'saving' ? 'Saving…' : 'Update Email'}
            </Button>
          </form>
        </Card>

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">Password</h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {passwordState === 'error' && <Alert tone="error">{passwordError}</Alert>}
            {passwordState === 'saved' && <Alert tone="success">Password updated.</Alert>}
            <Button type="submit" disabled={passwordState === 'saving'}>
              {passwordState === 'saving' ? 'Saving…' : 'Update Password'}
            </Button>
          </form>
        </Card>

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">Two-Factor Authentication</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {account?.twoFactorEnabled
              ? `Enabled - codes are sent to your ${channelLabel(account.twoFactorChannel ?? 'EMAIL')} on every login.`
              : 'Disabled - logging in only requires your password.'}
          </p>

          {twoFaError && <Alert tone="error">{twoFaError}</Alert>}

          {account?.twoFactorEnabled ? (
            <form onSubmit={handleDisable} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <PasswordInput value={twoFaDisablePassword} onChange={(e) => setTwoFaDisablePassword(e.target.value)} required />
              </div>
              <Button type="submit" variant="outline" disabled={twoFaState === 'saving'}>
                {twoFaState === 'saving' ? 'Turning off…' : 'Turn Off'}
              </Button>
            </form>
          ) : twoFaChallengeId ? (
            <form onSubmit={handleConfirmEnable} className="mt-4 space-y-4">
              {twoFaMessage && <Alert tone="success">{twoFaMessage}</Alert>}
              <div className="space-y-1.5">
                <Label>Verification code</Label>
                <Input
                  inputMode="numeric"
                  maxLength={6}
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value)}
                  className="text-center text-lg tracking-[0.5em]"
                  placeholder="000000"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={twoFaState === 'saving'}>
                  {twoFaState === 'saving' ? 'Confirming…' : 'Confirm'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTwoFaChallengeId(null);
                    setTwoFaCode('');
                    setTwoFaError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestEnable} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>Send code via</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={twoFaChannel === 'EMAIL' ? 'primary' : 'outline'}
                    onClick={() => setTwoFaChannel('EMAIL')}
                  >
                    Email
                  </Button>
                  <Button
                    type="button"
                    variant={twoFaChannel === 'SMS' ? 'primary' : 'outline'}
                    disabled={!account?.contactNumber}
                    onClick={() => setTwoFaChannel('SMS')}
                  >
                    SMS
                  </Button>
                  <Button
                    type="button"
                    variant={twoFaChannel === 'BOTH' ? 'primary' : 'outline'}
                    disabled={!account?.contactNumber}
                    onClick={() => setTwoFaChannel('BOTH')}
                  >
                    Both
                  </Button>
                </div>
                {!account?.contactNumber && <p className="text-xs text-muted-foreground">Add a mobile number to your profile to use SMS.</p>}
              </div>
              <Button type="submit" disabled={twoFaState === 'saving'}>
                {twoFaState === 'saving' ? 'Sending…' : 'Turn On'}
              </Button>
            </form>
          )}
        </Card>
      </main>
    </div>
  );
}
