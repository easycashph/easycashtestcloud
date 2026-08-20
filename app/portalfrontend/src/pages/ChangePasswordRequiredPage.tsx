import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Bind existing Client data to Portal (2026-08-06, explicit user decision): shown instead of every
 * other authenticated page whenever `account.mustChangePassword` is true - i.e. this account is
 * still on the shared staff-issued temp password. There is no "skip"/"remind me later" - the whole
 * point of this gate is to close the window during which anyone who knows this client's email could
 * log in as them using that same temp password (see CreatePortalAccountForBorrowerUseCase's own
 * doc comment on the backend). `App.tsx`'s `ProtectedRoute` redirects here for every other route
 * until this succeeds.
 */
export function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const { refreshAccount } = useAuth();
  const { t } = useLanguage();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError(t.auth.changePasswordRequired.passwordMismatch);
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/portal/security/change-password', { currentPassword, newPassword }, true);
      await refreshAccount();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.changePasswordRequired.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t.auth.changePasswordRequired.title} subtitle={t.auth.changePasswordRequired.subtitle}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="current-password">{t.auth.changePasswordRequired.currentPasswordLabel}</Label>
          <PasswordInput id="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">{t.auth.changePasswordRequired.newPasswordLabel}</Label>
          <PasswordInput id="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t.auth.changePasswordRequired.confirmPasswordLabel}</Label>
          <PasswordInput id="confirm-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.auth.changePasswordRequired.submitting : t.auth.changePasswordRequired.submit}
        </Button>
      </form>
    </AuthLayout>
  );
}
