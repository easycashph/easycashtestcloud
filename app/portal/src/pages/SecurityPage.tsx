import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { PortalHeader } from '@/components/PortalHeader';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';

/** Portal Security tab (2026-07-27 user request): self-service login email and password change.
 * Both require the current password (see backend's ChangePortalEmailUseCase/
 * ChangePortalPasswordUseCase doc comments for why). 2FA is a separate, larger follow-up - not in
 * scope here (no portal-login 2FA infrastructure exists yet, unlike the internal LMS's staff-side
 * 2FA). */
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
              <Input type="password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} required />
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
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>New password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm new password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
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
          <p className="mt-1 text-sm text-muted-foreground">Coming soon.</p>
        </Card>
      </main>
    </div>
  );
}
