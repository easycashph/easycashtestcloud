import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SignaturePad, type SignaturePadHandle } from '@/components/SignaturePad';
import { apiClient, ApiError, API_BASE_URL, getStoredToken } from '@/lib/apiClient';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { PortalSigningSessionView } from '@/lib/portalApiTypes';

/**
 * 2026-08-20 (Portal e-signature, user request): authenticated counterpart of app/lmsfrontend's
 * `/sign/:token` `LoanSigningPage.tsx` - same OTP -> document -> signature flow, reused verbatim
 * where possible, but reached from inside the logged-in Portal (`/sign/:sessionId`, behind
 * `ProtectedRoute`) instead of a mailed link. `sessionId` (not a raw token) identifies the
 * session - the backend authorizes by portal JWT + loan-account ownership instead
 * (`resolvePortalSigningSession`), OTP verification is still required as an additional identity
 * check even though the borrower is already logged in.
 *
 * Plain `useState`/`useEffect` throughout, not react-query - this app has no react-query
 * dependency (unlike app/lmsfrontend), same "fetch in an effect, mutate with a local async
 * handler" shape every other Portal page already uses (see DashboardPage.tsx).
 */
export function PortalSigningPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [session, setSession] = React.useState<PortalSigningSessionView | null | undefined>(undefined);
  const [sessionError, setSessionError] = React.useState<string | null>(null);

  const loadSession = React.useCallback(() => {
    if (!sessionId) return;
    apiClient
      .get<PortalSigningSessionView>(`/portal/signing-sessions/${sessionId}`)
      .then((data) => {
        setSession(data);
        setSessionError(null);
      })
      .catch((error: unknown) => {
        setSession(null);
        setSessionError(error instanceof ApiError ? error.message : t.portalSigning.expiredFallback);
      });
  }, [sessionId, t.portalSigning.expiredFallback]);

  React.useEffect(() => {
    loadSession();
  }, [loadSession]);

  const [otpSent, setOtpSent] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState('');
  const [otpError, setOtpError] = React.useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = React.useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = React.useState(false);

  const requestOtp = async () => {
    setIsSendingOtp(true);
    setOtpError(null);
    try {
      await apiClient.post(`/portal/signing-sessions/${sessionId}/request-otp`, undefined, true);
      setOtpSent(true);
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : t.portalSigning.otpSendError);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    setIsVerifyingOtp(true);
    setOtpError(null);
    try {
      const result = await apiClient.post<{ verified: boolean }>(`/portal/signing-sessions/${sessionId}/verify-otp`, { code: otpCode }, true);
      if (!result.verified) {
        setOtpError(t.portalSigning.otpIncorrect);
        return;
      }
      loadSession();
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : t.portalSigning.otpVerifyError);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const [consentChecked, setConsentChecked] = React.useState(false);
  const [signError, setSignError] = React.useState<string | null>(null);
  const [hasSignature, setHasSignature] = React.useState(false);
  const [isSigning, setIsSigning] = React.useState(false);
  const signaturePadRef = React.useRef<SignaturePadHandle>(null);
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);

  const currentDocument = session?.documents.find((d) => !d.signed);

  const signCurrentDocument = async () => {
    if (!currentDocument) return;
    setIsSigning(true);
    setSignError(null);
    try {
      await apiClient.post(
        `/portal/signing-sessions/${sessionId}/documents/${currentDocument.id}/sign`,
        { consentChecked, signatureImagePng: signatureDataUrl },
        true,
      );
      setConsentChecked(false);
      setSignatureDataUrl(null);
      setHasSignature(false);
      signaturePadRef.current?.clear();
      loadSession();
    } catch (error) {
      setSignError(error instanceof ApiError ? error.message : t.portalSigning.signError);
    } finally {
      setIsSigning(false);
    }
  };

  if (!sessionId) return null;

  if (session === undefined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <p className="text-sm text-muted-foreground">{t.portalSigning.loading}</p>
      </div>
    );
  }

  if (session === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-sm p-5 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">{t.portalSigning.expiredTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{sessionError}</p>
          <Button className="mt-4" variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            {t.portalSigning.backToDashboard}
          </Button>
        </Card>
      </div>
    );
  }

  if (!session.otpVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-sm space-y-4 p-5">
          <div>
            <p className="text-sm font-medium">{t.portalSigning.confirmItsYou}</p>
            <p className="text-xs text-muted-foreground">{session.loanCode}</p>
          </div>
          {otpError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{otpError}</span>
            </div>
          )}
          {!otpSent ? (
            <Button className="w-full" onClick={requestOtp} disabled={isSendingOtp}>
              {isSendingOtp
                ? t.portalSigning.sending
                : session.channel === 'EMAIL'
                  ? t.portalSigning.sendCodeEmail
                  : t.portalSigning.sendCodePhone}
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t.portalSigning.enterCode.replace(
                  '{channel}',
                  session.channel === 'EMAIL' ? t.portalSigning.channelEmailed : t.portalSigning.channelTexted,
                )}
              </p>
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-center text-sm tracking-[0.3em]"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <Button className="w-full" onClick={verifyOtp} disabled={otpCode.length !== 6 || isVerifyingOtp}>
                {isVerifyingOtp ? t.portalSigning.verifying : t.portalSigning.verifyCode}
              </Button>
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={requestOtp} disabled={isSendingOtp}>
                {t.portalSigning.resendCode}
              </button>
            </>
          )}
        </Card>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
        <Card className="w-full max-w-sm p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="text-sm font-medium">{t.portalSigning.allSignedTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t.portalSigning.allSignedBody.replace('{loanCode}', session.loanCode)}</p>
          <Button className="mt-4" size="sm" onClick={() => navigate('/dashboard')}>
            {t.portalSigning.backToDashboard}
          </Button>
        </Card>
      </div>
    );
  }

  const signedCount = session.documents.filter((d) => d.signed).length;
  const totalCount = session.documents.length;
  const currentIndex = session.documents.findIndex((d) => d.id === currentDocument.id);

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/30 p-4">
      <Card className="w-full max-w-sm space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{currentDocument.name}</p>
          <p className="text-xs text-muted-foreground">
            {t.portalSigning.documentCount.replace('{current}', String(currentIndex + 1)).replace('{total}', String(totalCount))}
          </p>
        </div>
        <div className="flex gap-1">
          {session.documents.map((d) => (
            <div key={d.id} className={`h-1 flex-1 rounded-full ${d.signed || d.id === currentDocument.id ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>

        {signError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{signError}</span>
          </div>
        )}

        {/* 2026-08-20: the document-file endpoint requires the Portal's own bearer token
            (`requirePortalAuth`), which a plain <iframe src> can't attach - fetched as a blob and
            shown via an object URL instead, mirroring how downloadFile()/apiClient.ts already
            handle authenticated binary responses elsewhere in this app. */}
        <SigningDocumentFrame sessionId={sessionId} documentId={currentDocument.id} documentName={currentDocument.name} />

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-input"
            checked={consentChecked}
            onChange={(e) => setConsentChecked(e.target.checked)}
          />
          {t.portalSigning.consentLabel}
        </label>

        <div className="space-y-1.5">
          <p className="text-xs font-medium">{t.portalSigning.signBelow}</p>
          <SignaturePad
            ref={signaturePadRef}
            onChange={(dataUrl) => {
              setSignatureDataUrl(dataUrl);
              setHasSignature(Boolean(dataUrl));
            }}
          />
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => signaturePadRef.current?.clear()}>
            {t.portalSigning.clear}
          </button>
        </div>

        <Button className="w-full" onClick={signCurrentDocument} disabled={!consentChecked || !hasSignature || isSigning}>
          {isSigning ? t.portalSigning.saving : t.portalSigning.signAndContinue}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t.portalSigning.signedSoFar.replace('{signed}', String(signedCount)).replace('{total}', String(totalCount))}
        </p>
      </Card>
    </div>
  );
}

/** Fetches the (auth-required) document PDF as a blob and renders it via an object URL - a plain
 * `<iframe src="...">` can't attach the portal's bearer token to its own request. */
function SigningDocumentFrame({
  sessionId,
  documentId,
  documentName,
}: {
  sessionId: string;
  documentId: string;
  documentName: string;
}) {
  const { t } = useLanguage();
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    let currentUrl: string | null = null;
    setObjectUrl(null);
    setLoadError(false);

    const token = getStoredToken();
    fetch(`${API_BASE_URL}/portal/signing-sessions/${sessionId}/documents/${documentId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load document');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setObjectUrl(currentUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [sessionId, documentId]);

  if (loadError) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
        {t.portalSigning.documentLoadError}
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className="flex h-56 w-full items-center justify-center rounded-md border border-border text-xs text-muted-foreground">
        {t.portalSigning.documentLoading}
      </div>
    );
  }

  return <iframe title={documentName} src={objectUrl} className="h-56 w-full rounded-md border border-border" />;
}
