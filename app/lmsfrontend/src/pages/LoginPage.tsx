import * as React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/components/theme-provider';
import { COMPANY_INFO } from '@/lib/staticConfig';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { LoginResponse } from '@/lib/authTypes';

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<LoginResponse>;
  /** Settings > Security > Two-Factor Authentication (2026-07-22). `rememberDevice` (2026-07-30
   * user request, moved to the initial login screen 2026-07-31) - only takes effect once a 2FA
   * challenge is actually triggered, but shown upfront so it isn't hidden behind a screen most
   * logins never reach. */
  onVerifyOtp: (challengeId: string, code: string, rememberDevice: boolean) => Promise<void>;
}

/** One of the four things this page can show at a time. An explicit enum rather than several
 * independent booleans/nullable-object flags (the previous `otpStep ? ... : ...` shape) - it makes
 * "OTP step AND forgot-password step both active" structurally unrepresentable instead of merely
 * unlikely. */
type Screen = 'login' | 'otp' | 'forgot-password' | 'reset-password';

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
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

/** Shared styling for every text/password field on this page - a taller, more generously padded
 * input than the app's default (this screen has one job, so it can afford to be roomier), with a
 * focus ring in the brand navy rather than the default ring color. */
const FIELD_CLASS = 'h-11 rounded-lg border-border/80 px-3.5 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary';
const FIELD_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-foreground/80';

/** The faint ascending-line motif behind the brand panel - suggests portfolio growth without
 * literally being a chart of anything. Two independent paths at low opacity so it reads as texture,
 * not data. */
function GrowthLines() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMaxYMax slice"
      aria-hidden="true"
    >
      <path
        d="M-40 620 C 120 560, 200 460, 300 480 S 480 560, 560 420 S 720 220, 860 260"
        stroke="hsl(41 68% 58%)"
        strokeWidth="2"
        fill="none"
        opacity="0.22"
      />
      <path
        d="M-40 700 C 140 660, 220 560, 330 590 S 500 660, 600 520 S 760 320, 900 350"
        stroke="white"
        strokeWidth="1.4"
        fill="none"
        opacity="0.12"
      />
    </svg>
  );
}

/** Left-hand brand panel of the split login layout - hidden below `lg`, where the page falls back
 * to a single centered card (see the mobile brand header rendered inline with the form instead). */
function BrandPanel() {
  return (
    <div
      className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-16"
      style={{
        background:
          'radial-gradient(120% 140% at 15% 0%, hsl(213 55% 34% / 0.55), transparent 55%), linear-gradient(155deg, hsl(213 60% 15%) 0%, hsl(217 62% 10%) 100%)',
      }}
    >
      <GrowthLines />
      <div className="relative flex items-center gap-3">
        <img src="/logo-easycash-white.png" alt="Easycash" className="h-8 w-auto" />
        <span className="border-l border-white/25 pl-3 text-[0.68rem] uppercase tracking-[0.18em] text-white/70">
          Loan Management System
        </span>
      </div>

      <div className="relative max-w-[30ch]">
        <p className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[hsl(41,68%,62%)]">Trusted since day one</p>
        <h1 className="font-display text-[2.1rem] font-medium leading-[1.18] text-balance text-white xl:text-[2.5rem]">
          Lending, managed with precision.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          One platform for every loan, every client, every branch - built for the people who keep {COMPANY_INFO.name.replace(' Inc.', '')}{' '}
          running.
        </p>
      </div>

      <div className="relative flex items-center gap-2 text-xs text-white/50">
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(41,68%,58%)]" />
        <span>{COMPANY_INFO.name} &middot; Internal Platform</span>
      </div>
    </div>
  );
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
 *
 * 2026-08-28 (redesign, user request: "high-end, advance sophisticated") - visual restyle only, a
 * split brand panel + sign-in card, mockup-approved first. No change to the four-screen state
 * machine, handlers, or endpoints below - see `Screen` and each `handle*` function, all unchanged.
 */
export function LoginPage({ onLogin, onVerifyOtp }: LoginPageProps) {
  const { theme, toggleTheme } = useTheme();
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
    <div className="grid min-h-screen bg-background lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />

      <div className="relative flex items-center justify-center px-5 py-10 sm:px-8">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="w-full max-w-[380px]">
          {/* Compact brand header, shown only when the split panel is hidden (below `lg`). */}
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <img src="/logo-easycash.png" alt="Easycash" className="mb-3 h-14 w-14 object-contain" />
            <p className="font-display text-lg font-medium">{COMPANY_INFO.name}</p>
            <p className="text-xs text-muted-foreground">Loan Management System Platform</p>
          </div>

          {screen === 'otp' && otpStep && (
            <>
              <div className="mb-8">
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Verification</p>
                <h2 className="font-display text-2xl font-medium">Enter your code</h2>
              </div>
              <form className="space-y-5" onSubmit={handleVerifyOtp}>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to your {otpStep.channel === 'EMAIL' ? 'email address' : 'mobile number'}. It expires in 5
                  minutes.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="otp-code" className={FIELD_LABEL_CLASS}>
                    Verification Code
                  </Label>
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
                    className={FIELD_CLASS}
                  />
                </div>

                {error && <ErrorBanner message={error} />}

                <Button type="submit" className="h-11 w-full rounded-lg text-sm shadow-md shadow-primary/15" disabled={submitting}>
                  {submitting ? 'Verifying…' : 'Verify'}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={resetToLogin}
                >
                  Back to login
                </button>
              </form>
            </>
          )}

          {screen === 'forgot-password' && (
            <>
              <div className="mb-8">
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account recovery</p>
                <h2 className="font-display text-2xl font-medium">Reset your password</h2>
              </div>
              <form className="space-y-5" onSubmit={handleRequestReset}>
                <p className="text-sm text-muted-foreground">Enter your username and we&apos;ll email you a reset code.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email" className={FIELD_LABEL_CLASS}>
                    Username
                  </Label>
                  <Input
                    id="reset-email"
                    type="text"
                    autoComplete="username"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    autoFocus
                    className={FIELD_CLASS}
                  />
                </div>

                {error && <ErrorBanner message={error} />}

                <Button type="submit" className="h-11 w-full rounded-lg text-sm shadow-md shadow-primary/15" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send Reset Code'}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                  onClick={resetToLogin}
                >
                  Back to login
                </button>
              </form>
            </>
          )}

          {screen === 'reset-password' &&
            (resetComplete ? (
              <div className="space-y-5">
                <div className="mb-3">
                  <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account recovery</p>
                  <h2 className="font-display text-2xl font-medium">All set</h2>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-2.5 text-xs text-success">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>Password reset. You can now log in with your new password.</span>
                </div>
                <Button type="button" className="h-11 w-full rounded-lg text-sm shadow-md shadow-primary/15" onClick={resetToLogin}>
                  Back to login
                </Button>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Account recovery</p>
                  <h2 className="font-display text-2xl font-medium">Choose a new password</h2>
                </div>
                <form className="space-y-5" onSubmit={handleConfirmReset}>
                  <p className="text-sm text-muted-foreground">Enter the 6-digit code we emailed you, plus your new password.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-code" className={FIELD_LABEL_CLASS}>
                      Reset Code
                    </Label>
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
                      className={FIELD_CLASS}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className={FIELD_LABEL_CLASS}>
                      New Password
                    </Label>
                    <PasswordInput
                      id="new-password"
                      autoComplete="new-password"
                      minLength={12}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className={FIELD_CLASS}
                    />
                    <p className="text-xs text-muted-foreground">At least 12 characters.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-new-password" className={FIELD_LABEL_CLASS}>
                      Confirm New Password
                    </Label>
                    <PasswordInput
                      id="confirm-new-password"
                      autoComplete="new-password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      className={FIELD_CLASS}
                    />
                  </div>

                  {error && <ErrorBanner message={error} />}

                  <Button type="submit" className="h-11 w-full rounded-lg text-sm shadow-md shadow-primary/15" disabled={submitting}>
                    {submitting ? 'Resetting…' : 'Reset Password'}
                    {!submitting && <ArrowRight className="h-4 w-4" />}
                  </Button>

                  <button
                    type="button"
                    className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
                    onClick={resetToLogin}
                  >
                    Back to login
                  </button>
                </form>
              </>
            ))}

          {screen === 'login' && (
            <>
              <div className="mb-8">
                <p className="mb-1 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Staff sign in</p>
                <h2 className="font-display text-2xl font-medium">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Sign in with your Easycash account to continue.</p>
              </div>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="username" className={FIELD_LABEL_CLASS}>
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className={FIELD_LABEL_CLASS}>
                    Password
                  </Label>
                  <PasswordInput
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={FIELD_CLASS}
                  />
                </div>

                <div className="-mt-1 flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    Remember this device for 30 days
                  </label>
                </div>

                {error && <ErrorBanner message={error} />}

                <Button type="submit" className="h-11 w-full rounded-lg text-sm shadow-md shadow-primary/15" disabled={submitting}>
                  {submitting ? 'Signing in…' : 'Login'}
                  {!submitting && <ArrowRight className="h-4 w-4" />}
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

                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[0.65rem] uppercase tracking-[0.1em] text-muted-foreground">Security</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-2.5 text-xs leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Protected by two-factor authentication and encrypted sessions. Never share your password or one-time codes with
                    anyone.
                  </span>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
