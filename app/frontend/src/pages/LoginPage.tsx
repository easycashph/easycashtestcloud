import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { COMPANY_INFO } from '@/lib/staticConfig';
import { ApiError } from '@/lib/apiClient';
import type { LoginResponse } from '@/lib/authTypes';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<LoginResponse>;
  /** Settings > Security > Two-Factor Authentication (2026-07-22). */
  onVerifyOtp: (challengeId: string, code: string) => Promise<void>;
}

/**
 * Frontend↔Backend Wiring Pilot, Stage 0b. Real login screen, rendered by `RoleProvider` in place
 * of the app whenever there's no active session - `POST /auth/login` under the hood.
 *
 * The field is labeled "Username" per the approved design (docs/Architecture/
 * FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md §6 point 1), but is submitted as the backend's `email`
 * field - the API has no separate username concept.
 *
 * 2026-07-22 (Two-Factor Authentication, user request) - a second step: if `onLogin` resolves with
 * `twoFactorRequired`, the form swaps to a plain 6-digit code entry instead of completing the
 * login immediately. Nothing changes for an account that hasn't turned 2FA on.
 */
export function LoginPage({ onLogin, onVerifyOtp }: LoginPageProps) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [otpStep, setOtpStep] = React.useState<{ challengeId: string; channel: 'EMAIL' | 'SMS' } | null>(null);
  const [otpCode, setOtpCode] = React.useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await onLogin(username.trim(), password);
      if ('twoFactorRequired' in result) {
        setOtpStep({ challengeId: result.challengeId, channel: result.channel });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : err.message);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpStep) return;
    setError(null);
    setSubmitting(true);
    try {
      await onVerifyOtp(otpStep.challengeId, otpCode.trim());
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : err.message);
      } else {
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/logo-easycash.png" alt="Easycash logo" className="mb-2 h-16 w-16 object-contain" />
          <CardTitle className="text-lg">{COMPANY_INFO.name}</CardTitle>
          <p className="text-sm text-muted-foreground">Easycash Loan Management System Platform</p>
        </CardHeader>
        <CardContent>
          {otpStep ? (
            <form className="space-y-4" onSubmit={handleVerifyOtp}>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to your {otpStep.channel === 'EMAIL' ? 'email address' : 'mobile number'}. It expires in 5
                minutes.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="otp-code">Verification Code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setOtpStep(null);
                  setOtpCode('');
                  setError(null);
                }}
              >
                Back to login
              </button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Login'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => setError('Password reset is not available yet - contact your MIS administrator.')}
              >
                Forgot password?
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
