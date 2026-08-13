import * as React from 'react';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { PortalLoanAccountSummary } from '@/lib/portalApiTypes';

const OPEN_LOAN_ACCOUNT_STATUSES = new Set(['ACTIVE', 'ACTIVE_IN_ARREARS']);
const ACCEPTED_TYPES = 'application/pdf,image/jpeg,image/png';

/**
 * "Upload Proof of Payment" card (2026-08-14 user request) - replaces the landing page's "email
 * collections@easycash.ph" instruction with an in-app upload for a Bank Transfer receipt/
 * screenshot, so staff can see it directly on the Loan Account's Attachments panel instead of
 * relying on the inbox. Fetches its own loan accounts (cheap call, same as
 * PortalLoanAccountsSection) rather than requiring a prop, and renders nothing at all if the
 * client has no open loan account to attach a proof to - mirrors that section's own
 * "never a placeholder for something that doesn't exist" convention.
 *
 * No loan account picker: by business rule a client has at most one open loan account at a time
 * (2026-08-14 user confirmation) - the backend resolves it server-side (see
 * UploadPortalPaymentProofUseCase), so this never sends a loanAccountId.
 */
export function PortalPaymentProofCard() {
  const [loanAccounts, setLoanAccounts] = React.useState<PortalLoanAccountSummary[] | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [status, setStatus] = React.useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    apiClient
      .get<PortalLoanAccountSummary[]>('/portal/loan-accounts')
      .then(setLoanAccounts)
      .catch(() => setLoanAccounts([]));
  }, []);

  const hasOpenLoanAccount = (loanAccounts ?? []).some((loanAccount) => OPEN_LOAN_ACCOUNT_STATUSES.has(loanAccount.status));
  if (loanAccounts !== null && !hasOpenLoanAccount) return null;

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setError(null);
    try {
      await apiClient.postFile('/portal/loan-accounts/payment-proof', file);
      setStatus('done');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Could not upload your proof of payment. Please try again.');
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Receipt className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold">Upload Proof of Payment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Made a Bank Transfer to our official account? Upload your receipt or screenshot here and our team will match it to your loan.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_TYPES}
              className="text-sm"
              disabled={status === 'uploading'}
              onChange={(e) => {
                setStatus('idle');
                setError(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
            <Button type="button" size="sm" disabled={!file || status === 'uploading'} onClick={handleUpload}>
              {status === 'uploading' ? 'Uploading…' : 'Upload'}
            </Button>
          </div>

          {status === 'done' && (
            <Alert tone="success" className="mt-3">
              Uploaded. Our team will review and match it to your loan.
            </Alert>
          )}
          {status === 'error' && error && (
            <Alert className="mt-3">{error}</Alert>
          )}
          <p className="mt-2 text-xs text-muted-foreground">PDF, JPEG, or PNG, up to 10 MB.</p>
        </div>
      </div>
    </Card>
  );
}
