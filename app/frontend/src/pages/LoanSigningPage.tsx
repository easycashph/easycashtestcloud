import * as React from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { apiClient, ApiError } from '@/lib/apiClient';
import type { SigningSessionView } from '@/lib/loanSigningApiTypes';

/**
 * 2026-07-22 (e-signature, phase 1). UNAUTHENTICATED public page - reached only via the SMS link
 * (`/sign/:token`), rendered OUTSIDE `RoleProvider` (see `main.tsx`). One SMS link -> one OTP
 * verification -> every required document signed in the same visit, in order.
 */
export function LoanSigningPage() {
  const { token } = useParams<{ token: string }>();
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ['public-signing-session', token],
    queryFn: () => apiClient.get<SigningSessionView>(`/public/signing-sessions/${token}`),
    enabled: Boolean(token),
    retry: false,
  });

  const [otpSent, setOtpSent] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);

  const requestOtpMutation = useMutation({
    mutationFn: () => apiClient.post(`/public/signing-sessions/${token}/request-otp`),
    onSuccess: () => {
      setOtpSent(true);
      setOtpError(null);
    },
    onError: (error: unknown) => {
      setOtpError(error instanceof ApiError ? error.message : 'Could not send the code. Check your connection and try again.');
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: () => apiClient.post<{ verified: boolean }>(`/public/signing-sessions/${token}/verify-otp`, { code: otpCode }),
    onSuccess: (result) => {
      if (!result.verified) {
        setOtpError('That code is incorrect. Try again.');
        return;
      }
      setOtpError(null);
      void queryClient.invalidateQueries({ queryKey: ['public-signing-session', token] });
    },
    onError: (error: unknown) => {
      setOtpError(error instanceof ApiError ? error.message : 'Could not verify the code. Check your connection and try again.');
    },
  });

  const [consentChecked, setConsentChecked] = React.useState(false);
  const [signError, setSignError] = React.useState<string | null>(null);
  const [hasSignature, setHasSignature] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadHandle>(null);
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);

  const session = sessionQuery.data;
  const currentDocument = session?.documents.find((d) => !d.signed);

  const signMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/public/signing-sessions/${token}/documents/${currentDocument!.id}/sign`, {
        consentChecked,
        signatureImagePng: signatureDataUrl,
      }),
    onSuccess: () => {
      setSignError(null);
      setConsentChecked(false);
      setSignatureDataUrl(null);
      setHasSignature(false);
      signaturePadRef.current?.clear();
      void queryClient.invalidateQueries({ queryKey: ['public-signing-session', token] });
    },
    onError: (error: unknown) => {
      setSignError(error instanceof ApiError ? error.message : 'Could not save your signature. Check your connection and try again.');
    },
  });

  if (!token) return null;

  if (sessionQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (sessionQuery.isError || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-5 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">This signing link is no longer valid</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sessionQuery.error instanceof ApiError ? sessionQuery.error.message : 'It may have expired. Contact your loan officer for a new link.'}
          </p>
        </div>
      </div>
    );
  }

  if (!session.otpVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg border bg-background p-5">
          <div>
            <p className="text-sm font-medium">Confirm it's you</p>
            <p className="text-xs text-muted-foreground">
              {session.loanCode} · {session.borrowerName}
            </p>
          </div>
          {otpError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}
          {!otpSent ? (
            <Button className="w-full" onClick={() => requestOtpMutation.mutate()} disabled={requestOtpMutation.isPending}>
              {requestOtpMutation.isPending ? 'Sending…' : session.channel === 'EMAIL' ? 'Send code to my email' : 'Send code to my phone'}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code we {session.channel === 'EMAIL' ? 'emailed' : 'texted'} you.
              </p>
              <Input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="text-center tracking-[0.3em]"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button className="w-full" onClick={() => verifyOtpMutation.mutate()} disabled={otpCode.length !== 6 || verifyOtpMutation.isPending}>
                {verifyOtpMutation.isPending ? 'Verifying…' : 'Verify code'}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline"
                onClick={() => requestOtpMutation.mutate()}
                disabled={requestOtpMutation.isPending}
              >
                Resend code
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="w-full max-w-sm rounded-lg border bg-background p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="text-sm font-medium">All documents signed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Thank you - {session.loanCode} is now fully signed. You may close this page.
          </p>
        </div>
      </div>
    );
  }

  const signedCount = session.documents.filter((d) => d.signed).length;
  const totalCount = session.documents.length;
  const currentIndex = session.documents.findIndex((d) => d.id === currentDocument.id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-3 rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{currentDocument.name}</p>
          <p className="text-xs text-muted-foreground">
            {currentIndex + 1} of {totalCount}
          </p>
        </div>
        <div className="flex gap-1">
          {session.documents.map((d) => (
            <div key={d.id} className={`h-1 flex-1 rounded-full ${d.signed || d.id === currentDocument.id ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {signError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{signError}</span>
          </div>
        )}

        <iframe
          title={currentDocument.name}
          src={`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? `http://${window.location.hostname}:4000/api/v1`}/public/signing-sessions/${token}/documents/${currentDocument.id}/file`}
          className="h-56 w-full rounded-md border"
        />

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          I have read this document and agree to its terms.
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">Sign below</p>
          <SignaturePad
            ref={signaturePadRef}
            onChange={(dataUrl) => {
              setSignatureDataUrl(dataUrl);
              setHasSignature(Boolean(dataUrl));
            }}
          />
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => signaturePadRef.current?.clear()}
          >
            Clear
          </button>
        </div>

        <Button
          className="w-full"
          onClick={() => signMutation.mutate()}
          disabled={!consentChecked || !hasSignature || signMutation.isPending}
        >
          {signMutation.isPending ? 'Saving…' : 'Sign and continue'}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {signedCount} of {totalCount} signed so far
        </p>
      </div>
    </div>
  );
}
