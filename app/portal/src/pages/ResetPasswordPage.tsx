import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { ResetPasswordRequest } from '@/lib/portalApiTypes';

interface LocationState {
  challengeId?: string | null;
  email?: string;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const [code, setCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  if (!state.challengeId) {
    return (
      <AuthLayout title="Reset link expired" subtitle="Please request a new password reset code.">
        <Link to="/forgot-password">
          <Button className="w-full">Back to Forgot Password</Button>
        </Link>
      </AuthLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const body: ResetPasswordRequest = { challengeId: state.challengeId!, code, newPassword };
      await apiClient.post<void>('/portal/reset-password', body);
      setSuccess(true);
      window.setTimeout(() => navigate('/login', { state: { email: state.email } }), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter the code we sent you and your new password.">
      {success ? (
        <Alert tone="success">Password reset! Taking you to log in…</Alert>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <Alert>{error}</Alert>}
          <div className="space-y-1.5">
            <Label htmlFor="code">Reset code</Label>
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
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={12}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">At least 12 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting…' : 'Reset Password'}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
