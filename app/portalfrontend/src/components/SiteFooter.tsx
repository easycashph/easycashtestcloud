import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Lock, Mail, Phone, ShieldCheck } from 'lucide-react';
import { COMPANY, FORMATTED_ADDRESS, REGULATORY_DISCLOSURE } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * The public site footer, carrying Easycash's mandatory regulatory disclosure.
 *
 * This must render on every public-facing page, not just the landing page: SEC MC 18-2019 requires
 * a lending company's name, SEC Registration No., and Certificate of Authority No. to appear on
 * its online platform, and a visitor can land directly on any route via a shared link or search
 * result. Extracted out of LandingPage.tsx so there is exactly one copy to keep correct.
 *
 * All identity values come from `@/lib/companyInfo` - never hardcode them here.
 *
 * Nav/footer chrome is translated (see translations.ts). This footer also appears on the
 * (deliberately untranslated) Privacy Policy and Terms pages via PublicPageLayout - a Filipino
 * footer around an English legal document is standard practice on Philippine bank/government
 * sites and reads as normal, unlike a transient system message flipping languages mid-flow (see
 * OfflineBanner's doc comment for that distinction).
 *
 * 2026-09-04 (user request, "high-end, advance design"): redesigned from a plain text-list footer
 * to a tinted band with trust badges, an icon-led contact list, and clearer column hierarchy - same
 * legal content, no new disclosures. Trust badge copy/icons are reused verbatim from the hero's own
 * `t.landing.trust*` strings (LandingPage.tsx) rather than duplicated, so the two never drift apart.
 */
export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="container pt-14">
        {/* Trust badges - same three claims as the hero, restated here since a visitor may land
            directly on an inner page (Contact, Complaints, etc.) without ever seeing the hero. */}
        <div className="mb-10 flex flex-wrap gap-2">
          {[
            { icon: ShieldCheck, label: t.landing.trustSecRegistered },
            { icon: CheckCircle2, label: t.landing.trustNoAdvanceFee },
            { icon: Lock, label: t.landing.trustDataProtected },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-2 pr-3.5 text-xs font-semibold text-foreground shadow-sm"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-3 w-3" />
              </span>
              {label}
            </span>
          ))}
        </div>

        <div className="grid gap-9 pb-12 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2.5">
              <img src="./logo-easycash.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
              <span className="text-base font-extrabold tracking-tight">{COMPANY.legalName}</span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">
              {FORMATTED_ADDRESS}
              {' · '}
              {/* 2026-08-06 (user request, borrowed from a competitor site review): links to the
                  registered office's REAL address above on Google Maps - no new claim, just a
                  convenience link built from the same single source of truth every other address
                  display already uses. */}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FORMATTED_ADDRESS)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary hover:underline"
              >
                {t.footer.viewOnMap}
              </a>
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
              {REGULATORY_DISCLOSURE}
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">{t.footer.tagline}</p>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t.footer.contactHeading}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Phone className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.landline}
                </a>
              </li>
              <li className="pl-[34px] text-xs text-muted-foreground">
                SMART: {COMPANY.contact.mobileSmart} &middot; GLOBE: {COMPANY.contact.mobileGlobe}
              </li>
              <li>
                <a href={`mailto:${COMPANY.contact.email}`} className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Mail className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-3 w-3" />
                </span>
                {COMPANY.contact.businessHours}
              </li>
              <li className="pl-[34px]">
                <Link to="/contact" className="text-xs font-semibold text-primary hover:underline">
                  {t.footer.contactPageLink}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{t.footer.quickLinksHeading}</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-xs text-muted-foreground">
              <li>
                <Link to="/requirements" className="hover:text-foreground hover:underline">
                  {t.footer.requirements}
                </Link>
              </li>
              <li>
                <Link to="/news" className="hover:text-foreground hover:underline">
                  {t.footer.news}
                </Link>
              </li>
              <li>
                <Link to="/security-tips" className="hover:text-foreground hover:underline">
                  {t.footer.security}
                </Link>
              </li>
              <li>
                <Link to="/complaints" className="hover:text-foreground hover:underline">
                  {t.footer.complaints}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-foreground hover:underline">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground hover:underline">
                  {t.footer.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row">
          {/* legalName already ends in "Inc." - no extra period, or it renders "Inc.." */}
          <p>
            © {new Date().getFullYear()} {COMPANY.legalName} {t.footer.rightsReserved}
          </p>
          <p className="font-medium text-foreground">{t.footer.scamWarning}</p>
        </div>
      </div>
    </footer>
  );
}
