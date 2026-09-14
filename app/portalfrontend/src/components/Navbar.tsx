import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Menu, Phone, Smartphone, X } from 'lucide-react';
import * as React from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useAuth } from '@/lib/authContext';
import { COMPANY } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS, localizedProductText } from '@/lib/loanProducts';

/** Sticky nav that earns a surface once the page has scrolled past the point it stops overlaying
 * the hero photo - transparent-over-hero, refined-surface once scrolled, per the redesign brief. */
function useScrollStuck(threshold = 8) {
  const [stuck, setStuck] = React.useState(false);
  React.useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return stuck;
}

/**
 * Site-wide nav - extracted from LandingPage.tsx (2026-09-11 user request, "retain the navbar on
 * other pages instead of falling back to home") so RequirementsPage and SecurityTipsPage can share
 * the exact same header instead of each showing only a bare "Back to home" link. Only meaningful
 * inside a `.landing-mockup` scope (see landingMockupClone.css `.nav`/`.menu`/`.drawer` rules).
 *
 * 2026-09-11 (same request): the News nav link (desktop + mobile drawer) was removed as part of
 * removing the News feature entirely - see App.tsx's own doc comment on that removal.
 */
export function Navbar() {
  const { isAuthenticated } = useAuth();
  const { t, locale } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [productMenuOpen, setProductMenuOpen] = React.useState(false);
  const stuck = useScrollStuck();

  return (
    <header className={`nav ${stuck || open ? 'is-stuck' : ''}`}>
      <div className="shell nav__in">
        <Link to="/" className="nav__brand">
          <img src="./logo-easycash.png" alt="Easycash" />
        </Link>

        <nav className="nav__links">
          <div style={{ position: 'relative' }} onMouseEnter={() => setProductMenuOpen(true)} onMouseLeave={() => setProductMenuOpen(false)}>
            <button type="button" className="nav__trigger" onClick={() => setProductMenuOpen((o) => !o)} aria-expanded={productMenuOpen}>
              {t.nav.product}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {productMenuOpen && (
              <div className="menu">
                {LOAN_PRODUCTS.map((product) => (
                  <Link key={product.category} to="/signup" onClick={() => setProductMenuOpen(false)} className="menu__item">
                    <span className="menu__ico">
                      <product.icon className="h-[18px] w-[18px]" />
                    </span>
                    <span>
                      <span className="menu__name">{product.displayLabel}</span>
                      <span className="menu__desc">{localizedProductText(product.blurb, locale)}</span>
                    </span>
                  </Link>
                ))}
                <Link to="/#products" onClick={() => setProductMenuOpen(false)} className="menu__all">
                  {t.nav.seeAllProducts}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
          <Link to="/requirements">{t.nav.requirements}</Link>
          <Link to="/security-tips">{t.nav.security}</Link>
        </nav>

        <div className="nav__end">
          <Link to="/get-app" className="btn btn--quiet" style={{ padding: '0.6rem 1.1rem' }}>
            <Smartphone className="h-3.5 w-3.5" />
            {t.nav.getApp}
          </Link>
          <LanguageToggle />
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn--primary">
              {t.nav.goToDashboard}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn--quiet">
                {t.common.logIn}
              </Link>
              <Link to="/signup" className="btn btn--primary">
                {t.common.applyNow}
              </Link>
            </>
          )}
          <button type="button" className="nav__burger" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="drawer">
          <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`}>
            <Phone className="h-4 w-4" />
            {COMPANY.contact.landline}
          </a>
          <p className="drawer__label">{t.nav.productFull}</p>
          <div className="drawer__group">
            {LOAN_PRODUCTS.map((product) => (
              <Link key={product.category} to="/signup" onClick={() => setOpen(false)}>
                {product.displayLabel}
              </Link>
            ))}
          </div>
          <Link to="/requirements" onClick={() => setOpen(false)}>{t.nav.requirementsFull}</Link>
          <Link to="/security-tips" onClick={() => setOpen(false)}>{t.nav.securityFull}</Link>
          <Link to="/get-app" onClick={() => setOpen(false)}>
            <Smartphone className="h-4 w-4" />
            {t.nav.getApp}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink-2)' }}>{t.nav.language}</span>
            <LanguageToggle />
          </div>
          {isAuthenticated ? (
            <Link to="/dashboard" onClick={() => setOpen(false)} className="btn-solid" style={{ justifyContent: 'center' }}>
              {t.nav.goToDashboard}
            </Link>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost" style={{ justifyContent: 'center' }}>
                {t.common.logIn}
              </Link>
              <Link to="/signup" onClick={() => setOpen(false)} className="btn-solid" style={{ justifyContent: 'center' }}>
                {t.common.applyNow}
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
