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
 *
 * 2026-09-11 (user request, "add more navy, it's so white dominant"): switched from a near-white
 * `bg-secondary/30` band to a solid navy one - by far the largest single block of screen real
 * estate on every public page, so it was the highest-leverage place to add real navy rather than
 * another thin accent line. Uses `var(--navy-800)` (defined by the `.landing-mockup` wrapper every
 * page that renders this footer is inside) rather than the global `--secondary`/`--muted-foreground`
 * Tailwind theme tokens this file used before - those tokens are shared app-wide (Dashboard, etc.),
 * so retuning them here to fit a dark footer would have changed unrelated light-mode UI elsewhere.
 * Explicit white/[opacity] utilities keep this change scoped to just this component. Same legal
 * content and links throughout - a color change only. */
export function SiteFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-white/10" style={{ background: 'linear-gradient(165deg, var(--navy-800), var(--navy))' }}>
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
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1.5 pl-2 pr-3.5 text-xs font-semibold text-white shadow-sm backdrop-blur-sm"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-lime-300">
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
              <span className="font-display text-base font-medium tracking-tight text-white">{COMPANY.legalName}</span>
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/65">
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
                className="font-semibold text-lime-300 hover:underline"
              >
                {t.footer.viewOnMap}
              </a>
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white/65">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-lime-300" />
              {REGULATORY_DISCLOSURE}
            </p>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/65">{t.footer.tagline}</p>
            {/* 2026-09-05 (user request): real NPC (National Privacy Commission) DPO/DPS
                registration seal, extracted from the company's own COR SEAL 2026-2027 certificate
                PDF - not a placeholder or invented badge. public/npc-seal.png. A plain white chip
                behind the seal itself: the source PNG is designed for a light background and reads
                poorly directly on navy. */}
            <div className="mt-4 flex items-center gap-3">
              <span className="rounded-lg bg-white p-1.5">
                <img src="./npc-seal.png" alt="National Privacy Commission - DPO/DPS Registered" className="h-14 w-auto object-contain" />
              </span>
              <span className="text-xs font-semibold leading-tight text-white/65">
                NPC Certificate of
                <br />
                Registration (DPO/DPS)
              </span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{t.footer.contactHeading}</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} className="flex items-center gap-2.5 text-xs text-white/65 hover:text-white">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lime-300">
                    <Phone className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.landline}
                </a>
              </li>
              <li className="pl-[34px] text-xs text-white/65">
                SMART: {COMPANY.contact.mobileSmart} &middot; GLOBE: {COMPANY.contact.mobileGlobe}
              </li>
              <li>
                <a href={`mailto:${COMPANY.contact.email}`} className="flex items-center gap-2.5 text-xs text-white/65 hover:text-white">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lime-300">
                    <Mail className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-xs text-white/65">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lime-300">
                  <Clock className="h-3 w-3" />
                </span>
                {COMPANY.contact.businessHours}
              </li>
              <li className="pl-[34px]">
                <Link to="/contact" className="text-xs font-semibold text-lime-300 hover:underline">
                  {t.footer.contactPageLink}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">{t.footer.quickLinksHeading}</p>
            <ul className="mt-4 flex flex-col gap-2.5 text-xs text-white/65">
              <li>
                <Link to="/requirements" className="hover:text-white hover:underline">
                  {t.footer.requirements}
                </Link>
              </li>
              <li>
                <Link to="/security-tips" className="hover:text-white hover:underline">
                  {t.footer.security}
                </Link>
              </li>
              <li>
                <Link to="/complaints" className="hover:text-white hover:underline">
                  {t.footer.complaints}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" className="hover:text-white hover:underline">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-white hover:underline">
                  {t.footer.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-xs text-white/50 sm:flex-row">
          {/* legalName already ends in "Inc." - no extra period, or it renders "Inc.." */}
          <p>
            © {new Date().getFullYear()} {COMPANY.legalName} {t.footer.rightsReserved}
          </p>
          <p className="font-medium text-white/80">{t.footer.scamWarning}</p>
        </div>
      </div>
    </footer>
  );
}
