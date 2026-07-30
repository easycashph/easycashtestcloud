import { Link } from 'react-router-dom';
import { Building2, Mail, MapPin, Phone, ShieldAlert } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { COMPANY, FORMATTED_ADDRESS, REGULATORY_DISCLOSURE } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Contact page.
 *
 * Only values confirmed from `@/lib/companyInfo` appear here. Deliberately absent: office hours,
 * a contact form, branch addresses, and social media links — none are confirmed, and inventing a
 * phone-answering schedule or an unmonitored inbox is worse than omitting it. See
 * `docs/PORTAL_WEBSITE_STRATEGY.md` §7 questions 6, 8, and 10.
 *
 * 2026-07-29: wired to the i18n system - translations.ts already had a full `contact` namespace,
 * but this page was never actually updated to read from it (same gap found and fixed on
 * SecurityTipsPage.tsx and ComplaintsPage.tsx).
 */
export function ContactPage() {
  const { t } = useLanguage();

  return (
    <PublicPageLayout title={t.contact.title} intro={t.contact.intro}>
      <div className="space-y-8">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <Phone className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{t.contact.phoneHeading}</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>
                <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} className="hover:text-foreground">
                  {COMPANY.contact.landline}
                </a>
              </li>
              <li>
                SMART:{' '}
                <a href={`tel:${COMPANY.contact.mobileSmart.replace(/\s/g, '')}`} className="hover:text-foreground">
                  {COMPANY.contact.mobileSmart}
                </a>
              </li>
              <li>
                GLOBE:{' '}
                <a href={`tel:${COMPANY.contact.mobileGlobe.replace(/\s/g, '')}`} className="hover:text-foreground">
                  {COMPANY.contact.mobileGlobe}
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{t.contact.emailHeading}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <a href={`mailto:${COMPANY.contact.dpoEmail}`} className="hover:text-foreground">
                {COMPANY.contact.dpoEmail}
              </a>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.contact.emailNote}</p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 sm:col-span-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="mt-3 text-sm font-semibold">{t.contact.officeHeading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{FORMATTED_ADDRESS}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">{COMPANY.legalName}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{REGULATORY_DISCLOSURE}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">{t.contact.impostorsHeading}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                {t.contact.impostorsBody.split('{securityLink}')[0]}
                <Link to="/security-tips" className="font-semibold underline">
                  {t.contact.impostorsLinkText}
                </Link>
                {t.contact.impostorsBody.split('{securityLink}')[1]}
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.contact.complaintHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {t.contact.complaintBody.split('{complaintsLink}')[0]}
            <Link to="/complaints" className="font-semibold text-primary hover:underline">
              {t.contact.complaintLinkText}
            </Link>
            {t.contact.complaintBody.split('{complaintsLink}')[1]}
          </p>
        </section>
      </div>
    </PublicPageLayout>
  );
}
