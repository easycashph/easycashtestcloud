import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ResetPasswordRequest } from '@/lib/portalApiTypes';

interface LocationState {
  challengeId?: string | null;
  email?: string;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const { t } = useLanguage();

  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!state.challengeId) {
    return (
      <AuthLayout title={t.auth.resetPassword.expiredTitle} subtitle={t.auth.resetPassword.expiredSubtitle}>
        <Link to="/forgot-password">
          <Button className="w-full">{t.auth.resetPassword.backToForgot}</Button>
        </Link>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError(t.auth.resetPassword.passwordTooShort);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t.auth.resetPassword.passwordMismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const body: ResetPasswordRequest = { challengeId: state.challengeId!, code, newPassword };
      await apiClient.post<void>('/portal/reset-password', body);
      setSuccess(true);
      window.setTimeout(() => navigate('/login', { state: { email: state.email } }), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.resetPassword.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t.auth.resetPassword.title} subtitle={t.auth.resetPassword.subtitle}>
      {success ? (
        <Alert tone="success">{t.auth.resetPassword.success}</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="code">{t.auth.resetPassword.codeLabel}</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-[0.5em]"
              placeholder="000000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">{t.auth.resetPassword.newPasswordLabel}</Label>
            <PasswordInput
              id="new-password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.auth.resetPassword.passwordHint}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">{t.auth.resetPassword.confirmPasswordLabel}</Label>
            <PasswordInput
              id="confirm-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t.auth.resetPassword.submitting : t.auth.resetPassword.submit}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
