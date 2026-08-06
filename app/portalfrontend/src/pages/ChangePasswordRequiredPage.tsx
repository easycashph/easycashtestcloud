import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Label } from '@/components/ui/Label';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/authContext';

function friendlyApiError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Could not change your password. Please try again.';
}

/**
 * Bind existing Client data to Portal (2026-08-06, explicit user decision): shown instead of every
 * other authenticated page whenever `account.mustChangePassword` is true - i.e. this account is
 * still on the shared staff-issued temp password. There is no "skip"/"remind me later" - the whole
 * point of this gate is to close the window during which anyone who knows this client's email could
 * log in as them using that same temp password (see CreatePortalAccountForBorrowerUseCase's own
 * doc comment on the backend). `App.tsx`'s `ProtectedRoute` redirects here for every other route
 * until this succeeds.
 */
export function ChangePasswordRequiredPage() {
  const navigate = useNavigate();
  const { refreshAccount } = useAuth();

  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post('/portal/security/change-password', { currentPassword, newPassword }, true);
      await refreshAccount();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(friendlyApiError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="For your security, you must set your own password before continuing - the temporary one your loan officer gave you can no longer be used after this."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && <Alert>{error}</Alert>}
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Temporary password</Label>
          <PasswordInput id="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput id="new-password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput id="confirm-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Set password and continue'}
        </Button>
      </form>
    </AuthLayout>
  );
}
