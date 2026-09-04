import { Link } from 'react-router-dom';
import { Info, Mail, Phone } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { COMPANY, FORMATTED_ADDRESS } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Complaints & escalation page.
 *
 * A published complaints channel is expected of an SEC-registered lending company, and the legacy
 * Easycash site carried a "File Complaint" page that this restores. It also gives borrowers the
 * lawful escalation path (the SEC) rather than leaving a dissatisfied client with nowhere to go.
 *
 * DELIBERATELY NOT STATED HERE: a response-time SLA (e.g. "we respond within X business days").
 * Management has not committed to one, and publishing an SLA the operations team cannot meet
 * creates an obligation Easycash would then be breaching. Add it here once it is formally
 * approved - see `docs/PORTAL_WEBSITE_STRATEGY.md` §7, open question 9.
 *
 * 2026-07-29: wired to the i18n system - translations.ts already had a full `complaints`
 * namespace, but this page was never actually updated to read from it (same gap found and fixed
 * on SecurityTipsPage.tsx).
 */
export function ComplaintsPage() {
  const { t } = useLanguage();
  const [privacyBefore, privacyRest] = t.complaints.privacyBody.split('{feedbackEmail}');
  const [privacyMiddle, privacyAfter] = privacyRest.split('{privacyLink}');

  return (
    <PublicPageLayout
      title={t.complaints.title}
      intro={t.complaints.intro.replace('Easycash', COMPANY.shortName)}
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.complaints.reachUsHeading}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t.complaints.byPhone}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{COMPANY.contact.landline}</li>
                <li>SMART: {COMPANY.contact.mobileSmart}</li>
                <li>GLOBE: {COMPANY.contact.mobileGlobe}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">{t.complaints.inWriting}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <a href={`mailto:${COMPANY.contact.feedbackEmail}`} className="hover:text-foreground">
                  {COMPANY.contact.feedbackEmail}
                </a>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t.complaints.mailTo} {COMPANY.legalName}, {FORMATTED_ADDRESS}.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.complaints.includeHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.complaints.includeIntro}</p>
          <ul className="mt-4 space-y-2.5">
            {t.complaints.include.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.complaints.privacyHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {privacyBefore}
            <a
              href={`mailto:${COMPANY.contact.feedbackEmail}`}
              className="font-semibold text-primary hover:underline"
            >
              {COMPANY.contact.feedbackEmail}
            </a>
            {privacyMiddle}
            <Link to="/privacy-policy" className="font-semibold text-primary hover:underline">
              {t.complaints.privacyLinkText}
            </Link>
            {privacyAfter}
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">{t.complaints.unresolvedHeading}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.complaints.unresolvedBody}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.complaints.scamHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.complaints.scamBody.split('{securityLink}')[0]}
            <Link to="/security-tips" className="font-semibold text-primary hover:underline">
              {t.complaints.scamLinkText}
            </Link>
            {t.complaints.scamBody.split('{securityLink}')[1]}
          </p>
        </section>
      </div>
    </PublicPageLayout>
  );
}
