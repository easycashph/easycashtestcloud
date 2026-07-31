import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { VerifySignUpRequest, PortalOtpChannel } from '@/lib/portalApiTypes';

const RESEND_COOLDOWN_SECONDS = 30;

interface LocationState {
  challengeId?: string;
  channel?: PortalOtpChannel;
  email?: string;
}

/** 2026-07-30 (bug found in production testing) - shared with SignUpPage, which writes this entry
 * right after a successful signup so this page can recover the in-progress challenge even if the
 * client left and came back (router navigation state alone doesn't survive a reload/new tab). */
export const SIGNUP_VERIFY_STORAGE_KEY = 'easycash-portal-signup-verify';

function readStoredState(): LocationState | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_VERIFY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocationState;
  } catch {
    return null;
  }
}

function channelLabel(channel: PortalOtpChannel): string {
  if (channel === 'BOTH') return 'email address and mobile number';
  return channel === 'EMAIL' ? 'email address' : 'mobile number';
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = (location.state ?? {}) as LocationState;
  // Router state (fresh navigation from Sign Up) wins when present; otherwise fall back to
  // whatever SignUpPage last persisted - covers a reload, a closed tab reopened, or hitting Back
  // then forward again, none of which router state alone survives.
  const initialState = routerState.challengeId ? routerState : (readStoredState() ?? routerState);

  const [challenge, setChallenge] = React.useState<{ challengeId: string; channel: PortalOtpChannel } | null>(
    initialState.challengeId ? { challengeId: initialState.challengeId, channel: initialState.channel ?? 'EMAIL' } : null,
  );
  const [email] = React.useState(initialState.email);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isResending, setIsResending] = React.useState(false);
  const [resendMessage, setResendMessage] = React.useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = React.useState(RESEND_COOLDOWN_SECONDS);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (!challenge) {
    return (
      <AuthLayout title="Verification link expired" subtitle="Please sign up again to get a new code.">
        <Link to="/signup">
          <Button className="w-full">Back to Sign Up</Button>
        </Link>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const body: VerifySignUpRequest = { challengeId: challenge.challengeId, code };
      await apiClient.post<void>('/portal/verify-signup', body);
      sessionStorage.removeItem(SIGNUP_VERIFY_STORAGE_KEY);
      setSuccess(true);
      window.setTimeout(() => navigate('/login', { state: { email } }), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify your code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2026-07-30 (user request): a real "Request another code" action, not just "go back and
  // re-submit sign-up" - calls POST /portal/resend-signup-otp directly, updates the in-progress
  // challenge in place (and its sessionStorage copy) so a client who's already on this screen never
  // has to leave it.
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      const result = await apiClient.post<{ challengeId: string; channel: PortalOtpChannel }>('/portal/resend-signup-otp', {
        challengeId: challenge.challengeId,
      });
      setChallenge(result);
      setCode('');
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setResendMessage(`A new code was sent to your ${channelLabel(result.channel)}.`);
      sessionStorage.setItem(SIGNUP_VERIFY_STORAGE_KEY, JSON.stringify({ ...result, email }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend your code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your account"
      subtitle={`Enter the 6-digit code sent to your ${channelLabel(challenge.channel)}. It expires in 5 minutes.`}
    >
      {success ? (
        <Alert tone="success">Verified! Taking you to log in…</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert>{error}</Alert>}
          {resendMessage && <Alert tone="success">{resendMessage}</Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-[0.5em]"
              placeholder="000000"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Verifying…' : 'Verify'}
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:no-underline"
            onClick={handleResend}
            disabled={isResending || resendCooldown > 0}
          >
            {isResending ? 'Sending…' : resendCooldown > 0 ? `Request another code (${resendCooldown}s)` : 'Request another code'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
