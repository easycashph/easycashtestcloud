import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { COMPANY, OFFICIAL_CHANNELS } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Security & Anti-Scam page.
 *
 * Purpose is protective, not promotional. Online lending scams in the Philippines routinely
 * impersonate SEC-registered lenders: the fraudster asks for an "advance processing fee" before
 * release, or phishes an OTP. Publishing an unambiguous list of what Easycash will never do, plus
 * the definitive list of official channels, gives a borrower a way to check a suspicious message
 * against the real thing.
 *
 * Every claim here must stay true operationally. If Easycash ever legitimately needs to do one of
 * the things listed under "never", this page must change first.
 *
 * 2026-07-29: wired to the i18n system (translations.ts already had a full `securityTips`
 * namespace defined, but this page was never actually updated to read from it - found while
 * auditing which public pages are genuinely bilingual vs. only claimed to be). Also turned the
 * "verify our registration" tip into a real link to the SEC's official website (sec.gov.ph) -
 * previously just prose telling a visitor to go verify, without a link to click.
 */
export function SecurityTipsPage() {
  const { t } = useLanguage();

  return (
    <PublicPageLayout title={t.securityTips.title} intro={t.securityTips.intro}>
      <div className="space-y-8">
        {/* The single most important message on the page - given visual priority. */}
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">{t.securityTips.alertTitle}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                {t.securityTips.alertBody}
              </p>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.securityTips.neverDoesHeading}</h2>
          <div className="mt-4 space-y-3">
            {t.securityTips.neverDoes.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.securityTips.channelsHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.securityTips.channelsIntro}</p>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <dl className="space-y-3">
              {OFFICIAL_CHANNELS.map((channel) => (
                <div key={channel.label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-sm text-muted-foreground">{channel.label}</dt>
                  <dd className="text-sm font-semibold">{channel.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              {t.securityTips.registeredOffice}: {COMPANY.address.line1}, {COMPANY.address.line2}, {COMPANY.address.city}.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.securityTips.protectHeading}</h2>
          <ul className="mt-4 space-y-2.5">
            {t.securityTips.protect.map((tip, index) => (
              <li key={tip} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-sm leading-relaxed text-muted-foreground">
                  {tip}
                  {/* The "check our registration" tip (index 1) is the one place on the whole site
                      that tells a visitor to independently verify Easycash with the SEC - giving
                      it an actual link, not just prose, is what makes that advice actionable. */}
                  {index === 1 && (
                    <>
                      {' '}
                      <a
                        href="https://www.sec.gov.ph"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-primary hover:underline"
                      >
                        sec.gov.ph
                      </a>
                      .
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">{t.securityTips.targetedHeading}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t.securityTips.targetedBody.split('{complaintsLink}')[0]}
                <Link to="/complaints" className="font-semibold text-primary hover:underline">
                  {t.securityTips.targetedLinkText}
                </Link>
                {t.securityTips.targetedBody.split('{complaintsLink}')[1]}
              </p>
            </div>
          </div>
        </section>
      </div>
    </PublicPageLayout>
  );
}
