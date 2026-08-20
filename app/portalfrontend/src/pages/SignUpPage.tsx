import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { PhoneInput } from '@/components/PhoneInput';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { SignUpRequest, SignUpResponse } from '@/lib/portalApiTypes';
import { SIGNUP_VERIFY_STORAGE_KEY } from './VerifyEmailPage';

export function SignUpPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [contactNumber, setContactNumber] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 12) {
      setError(t.auth.signUp.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.auth.signUp.passwordMismatch);
      return;
    }

    setIsSubmitting(true);
    try {
      const body: SignUpRequest = { email, password, contactNumber: contactNumber || undefined };
      const result = await apiClient.post<SignUpResponse>('/portal/signup', body);
      // 2026-07-30 (bug found in production testing): a client who navigated away from /verify
      // (closed the tab, hit back, etc.) had no way back in - the challengeId only ever lived in
      // React Router's in-memory navigation state. Persisted here too so VerifyEmailPage can
      // recover it on a fresh mount/reload, not just via direct navigation from this page.
      sessionStorage.setItem(SIGNUP_VERIFY_STORAGE_KEY, JSON.stringify({ challengeId: result.challengeId, channel: result.channel, email }));
      navigate('/verify', { state: { challengeId: result.challengeId, channel: result.channel, email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.signUp.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t.auth.signUp.title} subtitle={t.auth.signUp.subtitle}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.emailLabel}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contact">{t.auth.signUp.contactLabel}</Label>
          <PhoneInput id="contact" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="09XX XXX XXXX" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t.auth.passwordLabel}</Label>
          <PasswordInput id="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">{t.auth.signUp.passwordHint}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">{t.auth.signUp.confirmPasswordLabel}</Label>
          <PasswordInput
            id="confirm-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.auth.signUp.submitting : t.auth.signUp.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t.auth.signUp.haveAccount}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t.auth.signUp.logInLink}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
