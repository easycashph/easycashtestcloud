import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { VerifySignUpRequest } from '@/lib/portalApiTypes';

interface LocationState {
  challengeId?: string;
  channel?: 'EMAIL' | 'SMS';
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

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routerState = (location.state ?? {}) as LocationState;
  // Router state (fresh navigation from Sign Up) wins when present; otherwise fall back to
  // whatever SignUpPage last persisted - covers a reload, a closed tab reopened, or hitting Back
  // then forward again, none of which router state alone survives.
  const state = routerState.challengeId ? routerState : (readStoredState() ?? routerState);

  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!state.challengeId) {
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
      const body: VerifySignUpRequest = { challengeId: state.challengeId!, code };
      await apiClient.post<void>('/portal/verify-signup', body);
      sessionStorage.removeItem(SIGNUP_VERIFY_STORAGE_KEY);
      setSuccess(true);
      window.setTimeout(() => navigate('/login', { state: { email: state.email } }), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify your code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your account"
      subtitle={`Enter the 6-digit code sent to your ${state.channel === 'SMS' ? 'mobile number' : 'email address'}. It expires in 5 minutes.`}
    >
      {success ? (
        <Alert tone="success">Verified! Taking you to log in…</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert>{error}</Alert>}
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
          <p className="text-center text-sm text-muted-foreground">
            Didn&apos;t get a code, or it expired?{' '}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up again
            </Link>{' '}
            with the same email to get a fresh one.
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
