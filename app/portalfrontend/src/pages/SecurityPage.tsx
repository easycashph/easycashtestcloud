import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { Dialog } from '@/components/ui/Dialog';
import { PortalHeader } from '@/components/PortalHeader';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import type { PortalOtpChannel, PortalTrustedDevice } from '@/lib/portalApiTypes';

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
/** The reusable form content, with no page chrome of its own - used both by the full-page
 * `SecurityPage` route (direct-link/bookmark entry point) and by `PortalDialogHost` when opened as
 * a dialog (2026-07-31 user request) from the header nav or Dashboard. */
export function SecurityForm() {
  const { account, refreshAccount, logout } = useAuth();
  const navigate = useNavigate();

  const [deletePassword, setDeletePassword] = React.useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [deleteState, setDeleteState] = React.useState<'idle' | 'saving' | 'error'>('idle');
  const [deleteError, setDeleteError] = React.useState('');

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

  const [trustedDevices, setTrustedDevices] = React.useState<PortalTrustedDevice[] | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = React.useState<string | null>(null);

  const loadTrustedDevices = React.useCallback(() => {
    apiClient
      .get<PortalTrustedDevice[]>('/portal/security/trusted-devices')
      .then(setTrustedDevices)
      .catch(() => setTrustedDevices([]));
  }, []);

  React.useEffect(() => {
    loadTrustedDevices();
  }, [loadTrustedDevices]);

  const handleRevokeDevice = async (id: string) => {
    setRevokingDeviceId(id);
    try {
      await apiClient.delete(`/portal/security/trusted-devices/${id}`, true);
      setTrustedDevices((prev) => (prev ? prev.filter((d) => d.id !== id) : prev));
    } finally {
      setRevokingDeviceId(null);
    }
  };

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

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeleteState('saving');
    setDeleteError('');
    try {
      await apiClient.post('/portal/security/delete-account', { currentPassword: deletePassword }, true);
      setDeleteConfirmOpen(false);
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setDeleteState('error');
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">Manage your login email and password.</p>

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

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">Trusted Devices</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Devices you've chosen to remember skip the two-factor code for 30 days. Remove one if it's no longer yours or you want it to
            require a code again.
          </p>

          {trustedDevices === null ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
          ) : trustedDevices.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No remembered devices right now.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {trustedDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">Remembered since {new Date(device.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs text-muted-foreground">Expires {new Date(device.expiresAt).toLocaleDateString()}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingDeviceId === device.id}
                    onClick={() => handleRevokeDevice(device.id)}
                  >
                    {revokingDeviceId === device.id ? 'Removing…' : 'Remove'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="mt-5 border-destructive/30 p-6">
          <h2 className="text-base font-semibold text-destructive">Delete My Portal Account</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>This deletes only your Easycash Portal login - it does NOT delete your loan account or loan history with Easycash.</li>
            <li>If you still have an active loan, your Portal account cannot be deleted until it's settled or closed.</li>
          </ul>
          <Button
            type="button"
            variant="outline"
            className="mt-4 border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => {
              setDeleteError('');
              setDeletePassword('');
              setDeleteState('idle');
              setDeleteConfirmOpen(true);
            }}
          >
            Delete My Portal Account
          </Button>
        </Card>

        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete My Portal Account">
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your password to confirm. This only removes your Portal login - your client profile and loan records with Easycash stay
              exactly as they are.
            </p>
            <div className="space-y-1.5">
              <Label>Current password</Label>
              <PasswordInput value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required autoFocus />
            </div>
            {deleteState === 'error' && <Alert tone="error">{deleteError}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled={deleteState === 'saving'}>
                {deleteState === 'saving' ? 'Deleting…' : 'Confirm Deletion'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Dialog>
    </>
  );
}

/** Full-page route wrapper (direct-link/bookmark entry point) - the everyday in-app flow now opens
 * `SecurityForm` inside a Dialog instead (see PortalDialogHost). */
export function SecurityPage() {
  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />
      <main className="container max-w-2xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">Security</h1>
        <div className="mt-8">
          <SecurityForm />
        </div>
      </main>
    </div>
  );
}
