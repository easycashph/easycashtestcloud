import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError, getStoredDeviceToken, setStoredDeviceToken } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import type { LoginRequest, LoginResult, LoginResponse, LoginTwoFactorRequired, PortalOtpChannel } from '@/lib/portalApiTypes';

const RESEND_COOLDOWN_SECONDS = 30;

function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Could not log in. Please try again.';
}

function channelLabel(channel: PortalOtpChannel): string {
  if (channel === 'BOTH') return 'email address and mobile number';
  return channel === 'EMAIL' ? 'email address' : 'mobile number';
}

/**
 * Login 2FA (2026-07-30 user request, default ON): if `/portal/login` resolves with
 * `twoFactorRequired`, the form swaps to a plain 6-digit code entry instead of completing the
 * login immediately - mirrors the internal LMS LoginPage's own OTP-step pattern exactly. Nothing
 * changes for an account that has 2FA turned off (Security tab).
 *
 * 2026-07-30 (user request): added a "Resend code" action on that OTP step, backed by
 * `POST /portal/resend-login-otp` - issues a fresh challenge (new code, new 5-minute expiry) for
 * the same in-progress login without making the client re-enter their password. Gated by a
 * client-side cooldown (matches the backend's own tighter rate limit on that route) so it can't be
 * spammed into re-triggering real message sends.
 */
export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? '';

  const { login } = useAuth();
  const [email, setEmail] = React.useState(prefillEmail);
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [otpStep, setOtpStep] = React.useState<{ challengeId: string; channel: PortalOtpChannel } | null>(null);
  const [otpCode, setOtpCode] = React.useState('');
  const [rememberDevice, setRememberDevice] = React.useState(true);
  const [isResending, setIsResending] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = React.useState(0);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const completeLogin = (result: LoginResponse) => {
    if (result.deviceToken) setStoredDeviceToken(result.deviceToken);
    login(result.accessToken, result.account);
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: LoginRequest = { email, password, deviceToken: getStoredDeviceToken() ?? undefined };
      const result = await apiClient.post<LoginResult>('/portal/login', body);
      if ('twoFactorRequired' in result) {
        setOtpStep({ challengeId: result.challengeId, channel: result.channel });
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        completeLogin(result);
      }
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpStep) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await apiClient.post<LoginResponse>('/portal/verify-login-otp', {
        challengeId: otpStep.challengeId,
        code: otpCode.trim(),
        rememberDevice,
      });
      completeLogin(result);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpStep || resendCooldown > 0) return;
    setError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      const result = await apiClient.post<LoginTwoFactorRequired>('/portal/resend-login-otp', { challengeId: otpStep.challengeId });
      setOtpStep({ challengeId: result.challengeId, channel: result.channel });
      setOtpCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage(`A new code was sent to your ${channelLabel(result.channel)}.`);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsResending(false);
    }
  };

  if (otpStep) {
    return (
      <AuthLayout
        title="Verify it's you"
        subtitle={`Enter the 6-digit code sent to your ${channelLabel(otpStep.channel)}. It expires in 5 minutes.`}
      >
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {error && <Alert>{error}</Alert>}
          {resendMessage && <Alert tone="success">{resendMessage}</Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="otp-code">Verification code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="text-center text-lg tracking-[0.5em]"
              placeholder="000000"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Remember this device for 30 days
          </label>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline"
            onClick={handleResendOtp}
            disabled={isResending || resendCooldown > 0}
          >
            {isResending ? 'Sending…' : resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Didn't get a code? Resend"}
          </button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setOtpStep(null);
              setOtpCode('');
              setError(null);
              setResendMessage(null);
              setResendCooldown(0);
            }}
          >
            Back to login
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to check your application status.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Log In'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
