import * as React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PrivacyContent } from '@/pages/PrivacyPolicyPage';
import { TermsContent } from '@/pages/TermsPage';

/** A dedicated "read this before you agree" overlay, not the shared `Dialog` component - `Dialog`
 * is hardcoded to `z-50`, which renders BEHIND this gate's own `z-[100]` overlay (found while
 * testing: the panel opened but was invisible, hidden under the opaque gate card). Everything else
 * about the interaction (Escape/backdrop/X to close) matches `Dialog` - only the stacking differs. */
function ReadPanel({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/** Bumping this invalidates every previously-stored acceptance (e.g. if the real Privacy/Terms
 * content is materially revised) - nothing else reads or clears this key. */
const CONSENT_KEY = 'easycash_portal_consent_accepted_v1';

/**
 * First-visit consent gate (2026-09-10 user request): a branded, non-dismissible screen shown once
 * per browser before any part of the site (including the landing page itself) is usable, requiring
 * an explicit opt-in checkbox before "Accept & Continue" unlocks. Deliberately NOT built on the
 * shared `Dialog` component for the outer gate - Dialog closes on Escape/backdrop click, which
 * would defeat "must not be able to proceed until consent is given". The two inner "read before you
 * agree" panels use a local `ReadPanel` (below) instead of `Dialog` for the same reason `Dialog`
 * wasn't right for the outer gate - its own doc comment explains why.
 *
 * Content note: the real `PrivacyContent`/`TermsContent` already in this codebase (see
 * PrivacyPolicyPage.tsx/TermsPage.tsx) are the actual CIC/Data-Privacy-Act consent clauses used
 * during a real loan application - not a general "we use cookies" website notice, because no such
 * document exists in this project yet. Reusing them here (rather than inventing lighter copy) is
 * the documented content this codebase actually has; the explanatory paragraph below is UI framing
 * text only, not a legal claim.
 *
 * Persisted in localStorage, not tied to the authenticated account: this gate applies to anonymous
 * visitors before they even have one, and (per the DPA content itself) recording "did this browser
 * see and accept the notice" for a website's UI gate does not need anything more identifying.
 */
export function ConsentGate() {
  const [accepted, setAccepted] = React.useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      return window.localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [agreed, setAgreed] = React.useState(false);
  const [panel, setPanel] = React.useState<'privacy' | 'terms' | null>(null);

  React.useEffect(() => {
    if (accepted) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [accepted]);

  if (accepted) return null;

  const handleAccept = () => {
    try {
      window.localStorage.setItem(CONSENT_KEY, 'true');
    } catch {
      /* localStorage unavailable (private mode / disabled) - still let the visitor through for
         this page view rather than trapping them behind a gate that can never be satisfied. */
    }
    setAccepted(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1128]/70 p-4 backdrop-blur-sm sm:p-6">
        <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-9 sm:py-10">
            <div className="flex items-center gap-3">
              <span className="dark:bg-primary/15 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Before you continue
              </span>
            </div>

            <h1 className="mt-5 font-display text-[1.9rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[2.15rem]">
              Your privacy matters.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Easycash processes personal information in connection with loan applications and account
              management. Please review our Privacy Notice and Terms &amp; Conditions before continuing.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <Button type="button" variant="outline" size="default" className="w-full" onClick={() => setPanel('privacy')}>
                Read Privacy Notice
              </Button>
              <Button type="button" variant="outline" size="default" className="w-full" onClick={() => setPanel('terms')}>
                Read Terms &amp; Conditions
              </Button>
            </div>

            <label className="mt-7 flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-foreground">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <span>
                I have read and understood the Privacy Notice and Terms &amp; Conditions, and I consent to the
                processing of my personal information as described.
              </span>
            </label>

            <Button type="button" size="lg" className="mt-6 w-full" disabled={!agreed} onClick={handleAccept}>
              Accept &amp; Continue
            </Button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              You can review these documents any time from the footer of the website.
            </p>
          </div>
        </div>
      </div>

      <ReadPanel open={panel === 'privacy'} onClose={() => setPanel(null)} title="Privacy Notice">
        <PrivacyContent />
      </ReadPanel>
      <ReadPanel open={panel === 'terms'} onClose={() => setPanel(null)} title="Terms & Conditions">
        <TermsContent />
      </ReadPanel>
    </>
  );
}
