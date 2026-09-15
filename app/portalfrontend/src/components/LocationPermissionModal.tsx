import * as React from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import type { LocationPermissionStatus } from '@/lib/portalApiTypes';

export interface CapturedLocation {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  capturedAt: string;
  permissionStatus: LocationPermissionStatus;
}

/** 2026-09-14 (user request: "Geotagging / Location Verification feature") - the configurable
 * accuracy gate. No existing backend/business rule for a location-accuracy threshold was found
 * (grepped the whole backend for accuracy/geofence/GEOLOCATION config) - the backend accepts and
 * stores whatever accuracy value is reported without rejecting it, so this is purely a portal UX
 * safeguard: below this radius we ask the applicant to retry rather than silently keep a
 * low-confidence reading. Kept as one named constant (not scattered magic numbers) so a future
 * confirmed business rule can replace it in one place. */
export const MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS = 150;

type CaptureOutcome =
  | { kind: 'granted'; location: CapturedLocation }
  | { kind: 'poor-accuracy'; accuracyMeters: number }
  | { kind: 'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'error' };

/** Wraps the raw Geolocation API into the outcome union above - never rejects, so callers never
 * need a try/catch. Distinguishes GeolocationPositionError codes (1=denied, 2=unavailable,
 * 3=timeout) from "API doesn't exist on this browser" (unsupported) and any other unexpected
 * throw (error), per the user's explicit exhaustive error-handling requirement. */
function captureLocation(): Promise<CaptureOutcome> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ kind: 'unsupported' });
      return;
    }
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const accuracyMeters = position.coords.accuracy;
          if (accuracyMeters > MAX_ACCEPTABLE_LOCATION_ACCURACY_METERS) {
            resolve({ kind: 'poor-accuracy', accuracyMeters });
            return;
          }
          resolve({
            kind: 'granted',
            location: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracyMeters,
              capturedAt: new Date().toISOString(),
              permissionStatus: 'GRANTED',
            },
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) resolve({ kind: 'denied' });
          else if (err.code === err.POSITION_UNAVAILABLE) resolve({ kind: 'unavailable' });
          else if (err.code === err.TIMEOUT) resolve({ kind: 'timeout' });
          else resolve({ kind: 'error' });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    } catch {
      resolve({ kind: 'error' });
    }
  });
}

interface LocationPermissionModalProps {
  open: boolean;
  /** Called once the applicant has reached a final decision - either a successful capture, or a
   * non-blocking outcome (denied/unavailable/timeout/unsupported/error/skipped) the caller should
   * proceed past. Never called for an in-between state like "poor accuracy, offering retry". */
  onResolve: (outcome: CapturedLocation | { permissionStatus: LocationPermissionStatus }) => void;
  onCancel: () => void;
}

/** 2026-09-14 (user request: "Geotagging / Location Verification feature"). Shown only when the
 * applicant clicks Submit and no location has been captured yet for this session - explains why
 * before ever triggering the browser's own native permission prompt (which "Allow Location"
 * does). Deliberately never re-shows itself or re-triggers the browser prompt automatically after
 * a real denial - the applicant always has to take a fresh action (Try Again / Continue Without
 * Location) to move forward. */
export function LocationPermissionModal({ open, onResolve, onCancel }: LocationPermissionModalProps) {
  const { t } = useLanguage();
  const copy = t.loanApplicationForm.locationVerification;
  const [phase, setPhase] = React.useState<'prompt' | 'capturing' | 'poor-accuracy' | 'failed'>('prompt');
  const [failure, setFailure] = React.useState<{ message: string; status: LocationPermissionStatus } | null>(null);
  const [lastAccuracy, setLastAccuracy] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (open) {
      setPhase('prompt');
      setFailure(null);
      setLastAccuracy(null);
    }
  }, [open]);

  if (!open) return null;

  const FAILURE_COPY: Record<'denied' | 'unavailable' | 'timeout' | 'unsupported' | 'error', { message: string; status: LocationPermissionStatus }> = {
    denied: { message: copy.deniedMessage, status: 'DENIED' },
    unavailable: { message: copy.unavailableMessage, status: 'UNAVAILABLE' },
    timeout: { message: copy.timeoutMessage, status: 'TIMEOUT' },
    unsupported: { message: copy.unsupportedMessage, status: 'UNSUPPORTED' },
    error: { message: copy.errorMessage, status: 'ERROR' },
  };

  const handleAllow = async () => {
    setPhase('capturing');
    const outcome = await captureLocation();
    if (outcome.kind === 'granted') {
      onResolve(outcome.location);
      return;
    }
    if (outcome.kind === 'poor-accuracy') {
      setLastAccuracy(outcome.accuracyMeters);
      setPhase('poor-accuracy');
      return;
    }
    // Real terminal outcome (denied/unavailable/timeout/unsupported/error) - never auto-retries or
    // re-shows the browser's own permission prompt; the applicant must choose to try again or
    // continue, and only THAT choice actually reports the status to onResolve.
    setFailure(FAILURE_COPY[outcome.kind]);
    setPhase('failed');
  };

  const handleContinueWithout = () => {
    onResolve({ permissionStatus: 'SKIPPED' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-brand-green/15">
            <MapPin className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">{copy.modalTitle}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{copy.modalMessage}</p>

          {phase === 'prompt' && (
            <>
              <p className="mt-4 text-xs text-muted-foreground">{copy.modalWhy}</p>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/60 p-3 text-left text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                <span>{copy.modalPrivacy}</span>
              </div>
              <div className="mt-6 flex w-full flex-col gap-2">
                <Button type="button" className="w-full" size="lg" onClick={handleAllow}>
                  {copy.allowButton}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleContinueWithout}>
                  {copy.continueWithoutButton}
                </Button>
              </div>
            </>
          )}

          {phase === 'capturing' && <p className="mt-6 text-sm font-medium text-primary">{copy.capturing}</p>}

          {phase === 'poor-accuracy' && (
            <div className="mt-4 w-full">
              <Alert>{copy.poorAccuracy}</Alert>
              {lastAccuracy !== null && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {copy.accuracyLabel}: {copy.accuracyMeters.replace('{value}', Math.round(lastAccuracy).toString())}
                </p>
              )}
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button type="button" className="w-full" size="lg" onClick={handleAllow}>
                  {copy.retryButton}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={handleContinueWithout}>
                  {copy.continueWithoutButton}
                </Button>
              </div>
            </div>
          )}

          {phase === 'failed' && failure && (
            <div className="mt-4 w-full">
              <Alert>{failure.message}</Alert>
              <div className="mt-4 flex w-full flex-col gap-2">
                <Button type="button" className="w-full" size="lg" onClick={handleAllow}>
                  {copy.retryButton}
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => onResolve({ permissionStatus: failure.status })}>
                  {copy.continueWithoutButton}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
