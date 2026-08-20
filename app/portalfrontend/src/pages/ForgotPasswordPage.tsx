import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { ForgotPasswordRequest, ForgotPasswordResponse } from '@/lib/portalApiTypes';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: ForgotPasswordRequest = { email };
      const result = await apiClient.post<ForgotPasswordResponse>('/portal/forgot-password', body);
      // Always proceeds to the reset-code screen, even for an email that doesn't match any
      // account - the backend deliberately returns the same response shape either way, so this
      // page can never leak which emails are registered.
      navigate('/reset-password', { state: { challengeId: result.challengeId, email } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.auth.forgotPassword.genericError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title={t.auth.forgotPassword.title} subtitle={t.auth.forgotPassword.subtitle}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">{t.auth.emailLabel}</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? t.auth.forgotPassword.submitting : t.auth.forgotPassword.submit}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {t.auth.forgotPassword.rememberedIt}{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            {t.auth.forgotPassword.logInLink}
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
