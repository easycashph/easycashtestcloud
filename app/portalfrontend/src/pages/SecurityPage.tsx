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
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PortalOtpChannel, PortalTrustedDevice } from '@/lib/portalApiTypes';

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
  const { t } = useLanguage();

  const channelLabel = (channel: PortalOtpChannel): string =>
    channel === 'BOTH' ? t.auth.otp.channelBoth : channel === 'SMS' ? t.auth.otp.channelSms : t.auth.otp.channelEmail;

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
      setTwoFaMessage(t.security.twoFactor.codeSentTo.replace('{channel}', channelLabel(twoFaChannel)));
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : t.security.genericError);
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
      setTwoFaError(err instanceof ApiError ? err.message : t.security.genericError);
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
      setTwoFaError(err instanceof ApiError ? err.message : t.security.genericError);
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
      setEmailError(err instanceof ApiError ? err.message : t.security.genericError);
      setEmailState('error');
    }
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError(t.security.password.mismatch);
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
      setPasswordError(err instanceof ApiError ? err.message : t.security.genericError);
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
      setDeleteError(err instanceof ApiError ? err.message : t.security.genericError);
      setDeleteState('error');
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">{t.security.intro}</p>

        <Card className="mt-8 p-6">
          <h2 className="text-base font-semibold">{t.security.email.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.security.email.currentEmail.replace('{email}', account?.email ?? '')}</p>
          <form onSubmit={handleChangeEmail} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>{t.security.email.newEmailLabel}</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t.security.email.currentPasswordLabel}</Label>
              <PasswordInput value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
            </div>
            {emailState === 'error' && <Alert tone="error">{emailError}</Alert>}
            {emailState === 'saved' && <Alert tone="success">{t.security.email.updated}</Alert>}
            <Button type="submit" disabled={emailState === 'saving'}>
              {emailState === 'saving' ? t.security.email.submitting : t.security.email.submit}
            </Button>
          </form>
        </Card>

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">{t.security.password.title}</h2>
          <form onSubmit={handleChangePassword} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label>{t.security.password.currentPasswordLabel}</Label>
              <PasswordInput value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t.security.password.newPasswordLabel}</Label>
              <PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>{t.security.password.confirmPasswordLabel}</Label>
              <PasswordInput value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            {passwordState === 'error' && <Alert tone="error">{passwordError}</Alert>}
            {passwordState === 'saved' && <Alert tone="success">{t.security.password.updated}</Alert>}
            <Button type="submit" disabled={passwordState === 'saving'}>
              {passwordState === 'saving' ? t.security.password.submitting : t.security.password.submit}
            </Button>
          </form>
        </Card>

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">{t.security.twoFactor.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {account?.twoFactorEnabled
              ? t.security.twoFactor.enabled.replace('{channel}', channelLabel(account.twoFactorChannel ?? 'EMAIL'))
              : t.security.twoFactor.disabled}
          </p>

          {twoFaError && <Alert tone="error">{twoFaError}</Alert>}

          {account?.twoFactorEnabled ? (
            <form onSubmit={handleDisable} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>{t.security.twoFactor.currentPasswordLabel}</Label>
                <PasswordInput value={twoFaDisablePassword} onChange={(e) => setTwoFaDisablePassword(e.target.value)} required />
              </div>
              <Button type="submit" variant="outline" disabled={twoFaState === 'saving'}>
                {twoFaState === 'saving' ? t.security.twoFactor.turningOff : t.security.twoFactor.turnOff}
              </Button>
            </form>
          ) : twoFaChallengeId ? (
            <form onSubmit={handleConfirmEnable} className="mt-4 space-y-4">
              {twoFaMessage && <Alert tone="success">{twoFaMessage}</Alert>}
              <div className="space-y-1.5">
                <Label>{t.security.twoFactor.verificationCodeLabel}</Label>
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
                  {twoFaState === 'saving' ? t.security.twoFactor.confirming : t.security.twoFactor.confirm}
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
                  {t.security.twoFactor.cancel}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRequestEnable} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label>{t.security.twoFactor.sendCodeVia}</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={twoFaChannel === 'EMAIL' ? 'primary' : 'outline'}
                    onClick={() => setTwoFaChannel('EMAIL')}
                  >
                    {t.security.twoFactor.email}
                  </Button>
                  <Button
                    type="button"
                    variant={twoFaChannel === 'SMS' ? 'primary' : 'outline'}
                    disabled={!account?.contactNumber}
                    onClick={() => setTwoFaChannel('SMS')}
                  >
                    {t.security.twoFactor.sms}
                  </Button>
                  <Button
                    type="button"
                    variant={twoFaChannel === 'BOTH' ? 'primary' : 'outline'}
                    disabled={!account?.contactNumber}
                    onClick={() => setTwoFaChannel('BOTH')}
                  >
                    {t.security.twoFactor.both}
                  </Button>
                </div>
                {!account?.contactNumber && <p className="text-xs text-muted-foreground">{t.security.twoFactor.addMobileNote}</p>}
              </div>
              <Button type="submit" disabled={twoFaState === 'saving'}>
                {twoFaState === 'saving' ? t.security.twoFactor.sending : t.security.twoFactor.turnOn}
              </Button>
            </form>
          )}
        </Card>

        <Card className="mt-5 p-6">
          <h2 className="text-base font-semibold">{t.security.trustedDevices.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.security.trustedDevices.intro}</p>

          {trustedDevices === null ? (
            <p className="mt-4 text-sm text-muted-foreground">{t.security.trustedDevices.loading}</p>
          ) : trustedDevices.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t.security.trustedDevices.none}</p>
          ) : (
            <div className="mt-4 space-y-2">
              {trustedDevices.map((device) => (
                <div key={device.id} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {t.security.trustedDevices.rememberedSince.replace('{date}', new Date(device.createdAt).toLocaleDateString())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.security.trustedDevices.expires.replace('{date}', new Date(device.expiresAt).toLocaleDateString())}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingDeviceId === device.id}
                    onClick={() => handleRevokeDevice(device.id)}
                  >
                    {revokingDeviceId === device.id ? t.security.trustedDevices.removing : t.security.trustedDevices.remove}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="mt-5 border-destructive/30 p-6">
          <h2 className="text-base font-semibold text-destructive">{t.security.deleteAccount.title}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t.security.deleteAccount.note1}</li>
            <li>{t.security.deleteAccount.note2}</li>
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
            {t.security.deleteAccount.cta}
          </Button>
        </Card>

        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title={t.security.deleteAccount.dialogTitle}>
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t.security.deleteAccount.dialogBody}</p>
            <div className="space-y-1.5">
              <Label>{t.security.deleteAccount.currentPasswordLabel}</Label>
              <PasswordInput value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} required autoFocus />
            </div>
            {deleteState === 'error' && <Alert tone="error">{deleteError}</Alert>}
            <div className="flex gap-2">
              <Button type="submit" variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled={deleteState === 'saving'}>
                {deleteState === 'saving' ? t.security.deleteAccount.confirming : t.security.deleteAccount.confirm}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setDeleteConfirmOpen(false)}>
                {t.security.deleteAccount.cancel}
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
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-secondary/30">
      <PortalHeader />
      <main className="container max-w-2xl py-10">
        <h1 className="text-2xl font-bold tracking-tight">{t.security.pageTitle}</h1>
        <div className="mt-8">
          <SecurityForm />
        </div>
      </main>
    </div>
  );
}
