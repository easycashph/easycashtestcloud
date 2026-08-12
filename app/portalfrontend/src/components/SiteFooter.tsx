import { Link } from 'react-router-dom';
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
 */
export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-border py-12">
      <div className="container grid gap-8 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <img src="./logo-easycash.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
            <span className="text-sm font-bold tracking-tight">{COMPANY.legalName}</span>
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
              className="font-medium text-primary hover:underline"
            >
              {t.footer.viewOnMap}
            </a>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">{REGULATORY_DISCLOSURE}</p>
          <p className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">{t.footer.tagline}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{t.footer.contactHeading}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li>{COMPANY.contact.landline}</li>
            <li>SMART: {COMPANY.contact.mobileSmart}</li>
            <li>GLOBE: {COMPANY.contact.mobileGlobe}</li>
            <li>{COMPANY.contact.businessHours}</li>
            <li>
              <a href={`mailto:${COMPANY.contact.dpoEmail}`} className="hover:text-foreground">
                {COMPANY.contact.dpoEmail}
              </a>
            </li>
            <li>
              <Link to="/contact" className="hover:text-foreground">
                {t.footer.contactPageLink}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{t.footer.quickLinksHeading}</p>
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li>
              <Link to="/requirements" className="hover:text-foreground">
                {t.footer.requirements}
              </Link>
            </li>
            <li>
              <Link to="/news" className="hover:text-foreground">
                {t.footer.news}
              </Link>
            </li>
            <li>
              <Link to="/security-tips" className="hover:text-foreground">
                {t.footer.security}
              </Link>
            </li>
            <li>
              <Link to="/complaints" className="hover:text-foreground">
                {t.footer.complaints}
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className="hover:text-foreground">
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-foreground">
                {t.footer.terms}
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="container mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
        {/* legalName already ends in "Inc." - no extra period, or it renders "Inc.." */}
        <p>
          © {new Date().getFullYear()} {COMPANY.legalName} {t.footer.rightsReserved}
        </p>
        <p>{t.footer.scamWarning}</p>
      </div>
    </footer>
  );
}
