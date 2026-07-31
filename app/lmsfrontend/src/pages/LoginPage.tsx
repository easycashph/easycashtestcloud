import * as React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { COMPANY_INFO } from '@/lib/staticConfig';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { LoginResponse } from '@/lib/authTypes';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<LoginResponse>;
  /** Settings > Security > Two-Factor Authentication (2026-07-22). `rememberDevice` (2026-07-30
   * user request) - the checkbox on this page's OTP step. */
  onVerifyOtp: (challengeId: string, code: string, rememberDevice: boolean) => Promise<void>;
}

/** One of the four things this page can show at a time. An explicit enum rather than several
 * independent booleans/nullable-object flags (the previous `otpStep ? ... : ...` shape) - it makes
 * "OTP step AND forgot-password step both active" structurally unrepresentable instead of merely
 * unlikely. */
type Screen = 'login' | 'otp' | 'forgot-password' | 'reset-password';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 429 ? 'Too many attempts. Please wait a few minutes and try again.' : err.message;
  }
  return 'Could not reach the server. Check your connection and try again.';
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
 *
 * 2026-07-28 (Forgot Password, user request) - "Forgot password?" used to just show a static
 * "contact your MIS administrator" message. Now calls the real `/auth/forgot-password` and
 * `/auth/reset-password` endpoints (see backend's RequestPasswordResetUseCase/
 * ConfirmPasswordResetUseCase) directly via `apiClient`, entirely within this component's own
 * state - it never touches `RoleProvider`/session state, since a password reset completes before
 * any login attempt, not in place of one.
 */
export function LoginPage({ onLogin, onVerifyOtp }: LoginPageProps) {
  const [screen, setScreen] = React.useState<Screen>('login');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [otpStep, setOtpStep] = React.useState<{ challengeId: string; channel: 'EMAIL' | 'SMS' } | null>(null);
  const [otpCode, setOtpCode] = React.useState('');
  const [rememberDevice, setRememberDevice] = React.useState(true);

  const [resetEmail, setResetEmail] = React.useState('');
  const [resetChallengeId, setResetChallengeId] = React.useState<string | null>(null);
  const [resetCode, setResetCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmNewPassword, setConfirmNewPassword] = React.useState('');
  const [resetComplete, setResetComplete] = React.useState(false);

  const resetToLogin = () => {
    setScreen('login');
    setError(null);
    setOtpStep(null);
    setOtpCode('');
    setResetChallengeId(null);
    setResetCode('');
    setNewPassword('');
    setConfirmNewPassword('');
    setResetComplete(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await onLogin(username.trim(), password);
      if ('twoFactorRequired' in result) {
        setOtpStep({ challengeId: result.challengeId, channel: result.channel });
        setScreen('otp');
      }
    } catch (err) {
      setError(friendlyApiError(err));
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
      await onVerifyOtp(otpStep.challengeId, otpCode.trim(), rememberDevice);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  /** Always advances to the code-entry screen on success, whether or not the email matched an
   * account - the backend deliberately returns the same response shape either way (see
   * RequestPasswordResetUseCase), so this page can never leak which usernames exist. */
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await apiClient.post<{ challengeId: string }>('/auth/forgot-password', { email: resetEmail.trim() });
      setResetChallengeId(result.challengeId);
      setScreen('reset-password');
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetChallengeId) return;
    setError(null);

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post<void>('/auth/reset-password', {
        challengeId: resetChallengeId,
        code: resetCode.trim(),
        newPassword,
      });
      setResetComplete(true);
    } catch (err) {
      setError(friendlyApiError(err));
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
          {screen === 'otp' && otpStep && (
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

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                Remember this device for 30 days
              </label>

              {error && <ErrorBanner message={error} />}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Verifying…' : 'Verify'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={resetToLogin}
              >
                Back to login
              </button>
            </form>
          )}

          {screen === 'forgot-password' && (
            <form className="space-y-4" onSubmit={handleRequestReset}>
              <p className="text-sm text-muted-foreground">Enter your username and we&apos;ll email you a reset code.</p>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Username</Label>
                <Input
                  id="reset-email"
                  type="text"
                  autoComplete="username"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Sending…' : 'Send Reset Code'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={resetToLogin}
              >
                Back to login
              </button>
            </form>
          )}

          {screen === 'reset-password' &&
            (resetComplete ? (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md border border-success/40 bg-success/10 p-2.5 text-xs text-success">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Password reset. You can now log in with your new password.</span>
                </div>
                <Button type="button" className="w-full" onClick={resetToLogin}>
                  Back to login
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleConfirmReset}>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code we emailed you, plus your new password.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-code">Reset Code</Label>
                  <Input
                    id="reset-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New Password</Label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    minLength={12}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">At least 12 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                  <PasswordInput
                    id="confirm-new-password"
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                  />
                </div>

                {error && <ErrorBanner message={error} />}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Resetting…' : 'Reset Password'}
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={resetToLogin}
                >
                  Back to login
                </button>
              </form>
            ))}

          {screen === 'login' && (
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
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <ErrorBanner message={error} />}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Login'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setError(null);
                  setResetEmail(username);
                  setScreen('forgot-password');
                }}
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
