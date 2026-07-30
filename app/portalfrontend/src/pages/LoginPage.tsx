import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';
import type { LoginRequest, LoginResult, LoginResponse } from '@/lib/portalApiTypes';

function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Could not log in. Please try again.';
}

/**
 * Login 2FA (2026-07-30 user request, default ON): if `/portal/login` resolves with
 * `twoFactorRequired`, the form swaps to a plain 6-digit code entry instead of completing the
 * login immediately - mirrors the internal LMS LoginPage's own OTP-step pattern exactly. Nothing
 * changes for an account that has 2FA turned off (Security tab).
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

  const [otpStep, setOtpStep] = React.useState<{ challengeId: string; channel: 'EMAIL' | 'SMS' } | null>(null);
  const [otpCode, setOtpCode] = React.useState('');

  const completeLogin = (result: LoginResponse) => {
    login(result.accessToken, result.account);
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: LoginRequest = { email, password };
      const result = await apiClient.post<LoginResult>('/portal/login', body);
      if ('twoFactorRequired' in result) {
        setOtpStep({ challengeId: result.challengeId, channel: result.channel });
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
      const result = await apiClient.post<LoginResponse>('/portal/verify-login-otp', { challengeId: otpStep.challengeId, code: otpCode.trim() });
      completeLogin(result);
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (otpStep) {
    return (
      <AuthLayout
        title="Verify it's you"
        subtitle={`Enter the 6-digit code sent to your ${otpStep.channel === 'EMAIL' ? 'email address' : 'mobile number'}. It expires in 5 minutes.`}
      >
        <form className="space-y-4" onSubmit={handleVerifyOtp}>
          {error && <Alert>{error}</Alert>}
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
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:underline"
            onClick={() => {
              setOtpStep(null);
              setOtpCode('');
              setError(null);
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
