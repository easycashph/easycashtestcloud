import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Lock,
  Mail,
  Menu,
  Phone,
  Quote,
  Clock,
  ShieldCheck,
  Smartphone,
  UserPlus,
  FileEdit,
  BadgeCheck,
  X,
} from 'lucide-react';
import * as React from 'react';
import { EligibilityCheckWidget } from '@/components/EligibilityCheckWidget';
import { MobileApplyBar } from '@/components/MobileApplyBar';
import { NewsFlashTicker } from '@/components/NewsFlashTicker';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useAuth } from '@/lib/authContext';
import { COMPANY, FORMATTED_ADDRESS, REGULATORY_DISCLOSURE } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getLoanProductDisplayLabel, LOAN_PRODUCTS, localizedProductText } from '@/lib/loanProducts';
import { estimateMonthlyPayment } from '@/lib/loanEstimator';
import './landingMockupClone.css';

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString()}`;
}

/** Hero estimate card inputs (2026-09-05 redesign) - a representative example only, same posture
 * as LoanCalculatorWidget's own default ₱50,000/12-month starting values. Not Easycash's minimum,
 * maximum, or "typical" loan - see that widget's doc comment for why these bounds aren't published
 * anywhere this codebase has verified. */
const HERO_ESTIMATE_PRINCIPAL = 150_000;
const HERO_ESTIMATE_TERM_MONTHS = 12;
const HERO_AMOUNT_MIN = 10_000;
const HERO_AMOUNT_MAX = 500_000;
const HERO_AMOUNT_STEP = 10_000;

const STEP_ICONS = [UserPlus, FileEdit, BadgeCheck];
const FEATURE_ICONS = [Smartphone, CheckCircle2, ShieldCheck];
/** 2026-08-06 (user request, competitor site review): only the two channels confirmed as real
 * client-facing payment methods (see ACTIVE_PAYMENT_METHODS in app/lmsfrontend's staticConfig.ts) -
 * most of that list is internal accounting/ledger categories (Suspense Account, Adjustment,
 * Unearned Income, etc.), never something a client actually pays through, so this is deliberately
 * a curated subset, not the full list. */
const WAYS_TO_PAY_ICONS = [Banknote, CalendarClock];
/** Decorative micro-labels only (not a disclosure), paired by index with t.landing.waysToPay -
 * same non-translated, index-paired pattern already used for WAYS_TO_PAY_ICONS above. */
const WAYS_TO_PAY_TAGS = ['Instant', 'Scheduled'];
/** Decorative category labels for the product cards (mockup-approved) - paired by index with
 * LOAN_PRODUCTS, same non-translated pattern as WAYS_TO_PAY_TAGS above. Generic marketing
 * groupings, not a value from loanProducts.ts (which only has the real `category`/`displayLabel`
 * fields used for actual application submission - see that file's own doc comment). */
const PRODUCT_TAGS = ['Business', 'Everyday', 'Overseas'];

/** Client stories inherited from the legacy Easycash website. The numeric star ratings that
 * previously accompanied these were removed on 2026-07-28: they implied a verified review system
 * that does not exist, which is not defensible on a regulated financial site. The quotes are
 * retained but attributed only by role, as received.
 *
 * Kept English-only (not in translations.ts) even when the page is set to Filipino: these are
 * direct quotes as originally given, not Easycash's own copy - translating someone else's quoted
 * words changes what they're reported to have said. `testimonialsNote` in the dictionary says so
 * explicitly when Filipino is selected.
 *
 * PENDING BUSINESS DECISION: these are unattributed and their consent status is undocumented.
 * Either obtain documented consent and attribute them properly (first name, role, year), or
 * replace them with verified stories. See docs/PORTAL_WEBSITE_STRATEGY.md §3.4 and §7 question 7. */
const TESTIMONIALS = [
  {
    role: 'Seafarer',
    quote:
      "Being a seafarer means irregular paychecks and a constant fear of financial instability. Easycash changed the game for me. They understand the unique challenges we face, and their seafarer loans were a lifesaver. The lower rates and faster approvals were a breath of fresh air. I'm now well on my way to achieving my dream of owning a home when I retire. Smooth sailing all the way!",
  },
  {
    role: 'Seafarer',
    quote:
      "As someone who's been working at sea for over a decade, finding a reliable loan provider that caters to our needs was a constant struggle. But Easycash not only understood our financial frustrations but offered tailored solutions that worked with our income patterns. Their seafarer loans are a game-changer, and the dream of sending my children to college is becoming a reality. Thank you, Easycash!",
  },
  {
    role: 'Business Owner',
    quote:
      "As a small business owner, I'd always felt constrained by the rigid requirements and inflexible terms of traditional lenders. Easycash provided a refreshing alternative. Their business loans offer flexibility, competitive rates, and a swift approval process. With their support, I expanded my business, opened new locations, and achieved financial success beyond my wildest dreams. This is the financing partner every entrepreneur needs!",
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button type="button" className="faq-summary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {question}
        <span className="faq-plus" aria-hidden="true">+</span>
      </button>
      {open && <p>{answer}</p>}
    </div>
  );
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

/** How-it-works section only (2026-09-04, "pwede ba natin lagyan ng animation" request,
 * mockup-approved): the connecting rail "draws" left-to-right as its own staggered child, timed
 * to finish roughly as the step cards start popping in below it. `scaleX` from a `transform-
 * origin: left` element, not an animated `width`, so the browser only ever compositor-animates a
 * transform (no layout thrash). */
const railDraw: Variants = {
  hidden: { scaleX: 0 },
  show: { scaleX: 1, transition: { duration: 0.9, ease: [0.65, 0, 0.35, 1] } },
};

/** The numbered badge floating above each step card - pops in with a spring after its card has
 * started fading up (the `delay` lets the card's own `fadeUp` lead), picked up automatically via
 * framer-motion's variant propagation (a nested motion element with matching 'hidden'/'show' keys
 * inherits its parent's animation state without needing its own `initial`/`animate` props). */
const badgePop: Variants = {
  // x: '-50%' is repeated in both keyframes because framer-motion owns this element's `transform`
  // once `variants` is set - it only renders the motion values it's animating (here just `scale`),
  // silently overriding the CSS `.step-badge { left:50%; transform: translateX(-50%); }` rule.
  // Without it, the badge's left edge (not center) lands at 50%, shifting it right by half its
  // own width.
  hidden: { scale: 0, x: '-50%' },
  show: { scale: 1, x: '-50%', transition: { type: 'spring', stiffness: 260, damping: 18, delay: 0.2 } },
};

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const [inView, setInView] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}

function Navbar() {
  const { isAuthenticated } = useAuth();
  const { t, locale } = useLanguage();
  const [open, setOpen] = React.useState(false);
  const [productMenuOpen, setProductMenuOpen] = React.useState(false);

  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'transparent' }}>
      <nav className="top wrap">
        <Link to="/" className="brand">
          <img src="./logo-easycash.png" alt="Easycash" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
        </Link>

        <div className="navlinks" style={{ alignItems: 'center' }}>
          <div
            style={{ position: 'relative' }}
            onMouseEnter={() => setProductMenuOpen(true)}
            onMouseLeave={() => setProductMenuOpen(false)}
          >
            <button
              type="button"
              style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
              onClick={() => setProductMenuOpen((o) => !o)}
              aria-expanded={productMenuOpen}
            >
              {t.nav.product}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {productMenuOpen && (
              <div className="widget-card" style={{ position: 'absolute', left: '50%', top: '100%', zIndex: 50, marginTop: 10, width: 420, transform: 'translateX(-50%)', padding: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {LOAN_PRODUCTS.map((product) => (
                    <Link
                      key={product.category}
                      to="/signup"
                      onClick={() => setProductMenuOpen(false)}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, borderRadius: 10, padding: 12, textDecoration: 'none', color: 'inherit' }}
                    >
                      <span className="icon-sq">
                        <product.icon className="h-[18px] w-[18px]" />
                      </span>
                      <span>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{product.displayLabel}</span>
                        <span style={{ marginTop: 2, display: 'block', fontSize: 12, lineHeight: 1.4, color: 'var(--ink-soft)' }}>
                          {localizedProductText(product.blurb, locale)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  to="/#products"
                  onClick={() => setProductMenuOpen(false)}
                  style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: 700, color: 'var(--brand-navy)', textDecoration: 'none' }}
                >
                  {t.nav.seeAllProducts}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}
          </div>
          <Link to="/requirements">{t.nav.requirements}</Link>
          <Link to="/news">{t.nav.news}</Link>
          <Link to="/security-tips">{t.nav.security}</Link>
        </div>

        <div className="navcta">
          <a
            href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`}
            className="link-inline"
            style={{ display: 'none' }}
          >
            <Phone className="h-3.5 w-3.5" />
            {COMPANY.contact.landline}
          </a>
          {/* 2026-09-06 (user request, mockup-approved): icon + visible text, not an icon-only
              button - a plain icon with only a hover tooltip went unnoticed when this same link
              lived in the footer, so the label stays on-screen at all times here instead. */}
          <Link to="/get-app" className="btn-ghost">
            <Smartphone className="h-3.5 w-3.5" />
            {t.nav.getApp}
          </Link>
          <LanguageToggle />
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-solid">
              {t.nav.goToDashboard}
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-ghost">
                {t.common.logIn}
              </Link>
              <Link to="/signup" className="btn-solid">
                {t.common.applyNow}
              </Link>
            </>
          )}
          <button
            type="button"
            style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer' }}
            className="mobile-menu-toggle"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="widget-card" style={{ margin: '0 20px 20px', borderRadius: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
              <Phone className="h-3.5 w-3.5" />
              {COMPANY.contact.landline}
            </a>
            <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{t.nav.productFull}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderLeft: '1px solid var(--line)', paddingLeft: 12 }}>
              {LOAN_PRODUCTS.map((product) => (
                <Link key={product.category} to="/signup" onClick={() => setOpen(false)} style={{ fontSize: 14, color: 'var(--ink-soft)', textDecoration: 'none' }}>
                  {product.displayLabel}
                </Link>
              ))}
            </div>
            <Link to="/requirements" onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
              {t.nav.requirementsFull}
            </Link>
            <Link to="/news" onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
              {t.nav.newsFull}
            </Link>
            <Link to="/security-tips" onClick={() => setOpen(false)} style={{ fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}>
              {t.nav.securityFull}
            </Link>
            <Link
              to="/get-app"
              onClick={() => setOpen(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'inherit', textDecoration: 'none' }}
            >
              <Smartphone className="h-3.5 w-3.5" />
              {t.nav.getApp}
            </Link>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>{t.nav.language}</span>
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
        </div>
      )}

      <style>{`
        @media (max-width: 860px) {
          .landing-mockup .navlinks { display: none !important; }
          .landing-mockup .navcta .btn-ghost,
          .landing-mockup .navcta .btn-solid,
          .landing-mockup .navcta > span { display: none !important; }
          .landing-mockup .mobile-menu-toggle { display: block !important; }
        }
      `}</style>
    </header>
  );
}

/** Landing-page-only footer, styled to clone the approved mockup's `.site-footer` exactly - kept
 * separate from the shared `SiteFooter` component (which still renders normally, Tailwind-styled,
 * on every other public page: Contact, Privacy Policy, Terms, etc.) rather than restyling that
 * shared component, which would have broken it everywhere else it's used. All content still comes
 * from the same single sources of truth (`companyInfo.ts`, `t.footer.*`) as SiteFooter - only the
 * visual language differs here. */
function LandingFooter() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="badge-row">
          {[
            { icon: ShieldCheck, label: t.landing.trustSecRegistered },
            { icon: CheckCircle2, label: t.landing.trustNoAdvanceFee },
            { icon: Lock, label: t.landing.trustDataProtected },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="trust-badge">
              <span className="dot-icon">
                <Icon className="h-3 w-3" />
              </span>
              {label}
            </span>
          ))}
        </div>

        <div className="footer-grid">
          <div className="footer-col">
            <div className="footer-brand">
              <span className="dot" />
              {COMPANY.legalName}
            </div>
            <p className="addr">
              {FORMATTED_ADDRESS} &middot;{' '}
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(FORMATTED_ADDRESS)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--brand-navy)', fontWeight: 700 }}
              >
                {t.footer.viewOnMap}
              </a>
            </p>
            <p className="reg">
              <ShieldCheck className="h-3.5 w-3.5" />
              {REGULATORY_DISCLOSURE}
            </p>
            <p className="tag">{t.footer.tagline}</p>
            {/* Real NPC (National Privacy Commission) DPO/DPS registration seal - extracted from
                the company's own COR SEAL 2026-2027 certificate PDF, not a placeholder. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <img src="./npc-seal.png" alt="National Privacy Commission - DPO/DPS Registered" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: 'var(--ink-soft)' }}>
                NPC Certificate of
                <br />
                Registration (DPO/DPS)
              </span>
            </div>
          </div>

          <div className="footer-col">
            <p className="footer-heading">{t.footer.contactHeading}</p>
            <ul className="footer-list">
              <li>
                <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit', textDecoration: 'none' }}>
                  <span className="ico">
                    <Phone className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.landline}
                </a>
              </li>
              <li style={{ paddingLeft: 30, fontSize: 12 }}>
                SMART: {COMPANY.contact.mobileSmart} &middot; GLOBE: {COMPANY.contact.mobileGlobe}
              </li>
              <li>
                <a href={`mailto:${COMPANY.contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit', textDecoration: 'none' }}>
                  <span className="ico">
                    <Mail className="h-3 w-3" />
                  </span>
                  {COMPANY.contact.email}
                </a>
              </li>
              <li>
                <span className="ico">
                  <Clock className="h-3 w-3" />
                </span>
                {COMPANY.contact.businessHours}
              </li>
              <li style={{ paddingLeft: 30 }}>
                <Link to="/contact" style={{ fontWeight: 700, color: 'var(--brand-navy)', textDecoration: 'none' }}>
                  {t.footer.contactPageLink}
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <p className="footer-heading">{t.footer.quickLinksHeading}</p>
            <ul className="footer-list">
              <li>
                <Link to="/requirements" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.requirements}
                </Link>
              </li>
              <li>
                <Link to="/news" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.news}
                </Link>
              </li>
              <li>
                <Link to="/security-tips" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.security}
                </Link>
              </li>
              <li>
                <Link to="/complaints" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.complaints}
                </Link>
              </li>
              <li>
                <Link to="/privacy-policy" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link to="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>
                  {t.footer.terms}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom-wrap" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="wrap footer-bottom">
          <p>
            &copy; {new Date().getFullYear()} {COMPANY.legalName} {t.footer.rightsReserved}
          </p>
          <p className="warn">{t.footer.scamWarning}</p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const { t, locale } = useLanguage();
  // Marks where the hero ends, so MobileApplyBar knows when to slide in - see its own doc comment.
  const heroEndRef = React.useRef<HTMLDivElement>(null);
  // 2026-09-05 (user request): the hero card is now a REAL interactive calculator, not a static
  // preview - same estimateMonthlyPayment formula LoanCalculatorWidget uses, fixed to a 12-month
  // Salary Loan term (the mockup's own slider only ever adjusted amount, not term).
  const [heroAmount, setHeroAmount] = React.useState(HERO_ESTIMATE_PRINCIPAL);
  const heroEstimateMonthly = estimateMonthlyPayment(heroAmount, HERO_ESTIMATE_TERM_MONTHS, 'Salary Loan');
  const heroFillPercent = ((heroAmount - HERO_AMOUNT_MIN) / (HERO_AMOUNT_MAX - HERO_AMOUNT_MIN)) * 100;

  return (
    <div className="landing-mockup">
      <NewsFlashTicker />
      <MobileApplyBar sentinelRef={heroEndRef} />

      <div className="page">
        <div className="mesh" />
        <div className="wrap">
          <Navbar />

          {/* Hero */}
          <motion.div className="hero" initial="hidden" animate="show" variants={stagger}>
            <div>
              <motion.span variants={fadeUp} className="eyebrow">
                {t.landing.badge}
              </motion.span>
              <motion.h1 variants={fadeUp} className="display">
                {locale === 'fil' ? (
                  <>
                    Pautang na kasabay ng <em>bilis ng iyong pangarap.</em>
                  </>
                ) : (
                  <>
                    Financing that moves at the <em>speed of your ambition.</em>
                  </>
                )}
              </motion.h1>
              <motion.p variants={fadeUp} className="lede">
                {t.landing.heroSubtitle}
              </motion.p>
              <motion.div variants={fadeUp} className="hero-actions">
                <Link to="/signup" className="btn-solid" style={{ padding: '14px 26px', fontSize: '0.88rem' }}>
                  {t.landing.applyToday}
                </Link>
                <Link to="/login" className="link-inline">
                  {t.common.logIn}
                </Link>
              </motion.div>

              <motion.div variants={fadeUp} className="trust-row">
                {[
                  { label: t.landing.statYearsLabel, value: '16' },
                  { label: t.landing.statDreamsLabel, value: '7,000+' },
                  { label: t.landing.statPartnersLabel, value: '20' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <b>{stat.value}</b>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </motion.div>

            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            >
              {/* Glass loan-estimate card - a REAL interactive calculator (2026-09-05 user
                  request), same estimateMonthlyPayment formula LoanCalculatorWidget uses, fixed
                  to a 12-month Salary Loan term. Not a duplicate of that widget: this one only
                  adjusts amount (matching the mockup's own single slider), while the full widget
                  (loan type + amount + term) lives at /signup once an applicant starts a real
                  application. */}
              <div className="glass-card">
                <div className="glass-head">
                  <span className="label">Estimate your loan</span>
                  <span className="icon">₱</span>
                </div>
                <div className="amount-display">{peso(heroAmount)}</div>
                <div className="amount-sub">
                  {getLoanProductDisplayLabel('Salary Loan')} &middot; {HERO_ESTIMATE_TERM_MONTHS}-month term
                </div>
                <div className="range">
                  <div className="fill" style={{ inset: `0 ${100 - heroFillPercent}% 0 0` }} />
                  <input
                    type="range"
                    aria-label="Loan amount"
                    min={HERO_AMOUNT_MIN}
                    max={HERO_AMOUNT_MAX}
                    step={HERO_AMOUNT_STEP}
                    value={heroAmount}
                    onChange={(e) => setHeroAmount(Number(e.target.value))}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 0, opacity: 0, cursor: 'pointer' }}
                  />
                  <div className="knob" style={{ left: `${heroFillPercent}%`, pointerEvents: 'none' }} />
                </div>
                <div className="range-labels">
                  <span>{peso(HERO_AMOUNT_MIN)}</span>
                  <span>{peso(HERO_AMOUNT_MAX)}</span>
                </div>
                <div className="glass-grid">
                  <div className="glass-stat">
                    <span>Est. Monthly</span>
                    <b>{peso(heroEstimateMonthly)}</b>
                  </div>
                  <div className="glass-stat">
                    <span>Total Interest</span>
                    <b>{peso(heroEstimateMonthly * HERO_ESTIMATE_TERM_MONTHS - heroAmount)}</b>
                  </div>
                </div>
                <Link to="/signup" className="glass-cta">
                  Apply for this loan
                </Link>
                <p style={{ marginTop: 10, textAlign: 'center', fontSize: '0.66rem', lineHeight: 1.5, color: 'var(--ink-soft)' }}>
                  Sample computation only, not a loan offer - see full disclaimer below.
                </p>
              </div>
            </motion.div>
          </motion.div>
          {/* Zero-height sentinel, not a visual element - MobileApplyBar watches this to know when
              the hero (and its own Apply button) has scrolled out of view. */}
          <div ref={heroEndRef} aria-hidden="true" />
        </div>
      </div>

      {/* Mission */}
      <section className="mission">
        <div className="wrap">
          <Reveal>
            <h2>
              {locale === 'fil' ? (
                <>
                  Mangarap nang Malaki, <em>Bawasan ang Takot</em>
                </>
              ) : (
                <>
                  Dream Big, <em>Fear Less</em>
                </>
              )}
            </h2>
            <p>{t.landing.missionBody}</p>
          </Reveal>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="products">
        <div className="wrap">
          <Reveal>
            <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
              <h2>{t.landing.productsTitle}</h2>
              <p style={{ margin: '8px auto 0' }}>{t.landing.productsSubtitle}</p>
            </div>
          </Reveal>
          <div className="product-row" style={{ marginTop: 34 }}>
            {LOAN_PRODUCTS.map((product, index) => (
              <Link
                key={product.category}
                to="/signup"
                className={`product-card ${index === 1 ? 'navy' : ''}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className="glow" />
                <div className="product-tag">{PRODUCT_TAGS[index]}</div>
                <h3>{product.displayLabel}</h3>
                <p style={{ marginBottom: 0 }}>{localizedProductText(product.blurb, locale)}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Eligibility self-check + Requirements checklist (2026-09-05, mockup-approved) - placed
          right after Products, once a visitor has picked a loan type they're interested in but
          before committing to the full application form. The interactive LoanCalculatorWidget
          used to sit here (2026-07-29) but was replaced per the approved mockup - the hero's own
          static loan-estimate card now covers that role, so this pairing no longer needed a
          second calculator. LoanCalculatorWidget itself is untouched and still exported, just not
          rendered on this page. The checklist content below was confirmed by the business owner
          (Nomer, 2026-09-05) as accurate for a real Easycash application - not derived from
          loanRequirements.ts's DOCUMENT_SLOTS, which only models uploadable document categories
          (it has no slot for a photo or contact-info requirement); the full accurate per-product
          document list still lives at /requirements. */}
      <section className="split">
        <div className="wrap">
          <div className="split-row">
            <Reveal>
              <EligibilityCheckWidget />
            </Reveal>
            <Reveal>
              <div className="widget-card">
                <div className="widget-head">
                  <span className="icon-sq">
                    <ClipboardList className="h-4 w-4" />
                  </span>
                  <h3>What you&apos;ll need to apply</h3>
                </div>
                <p className="sub">Have these ready and your application moves even faster.</p>
                {[
                  '1 valid government-issued ID',
                  'Proof of income (payslip, COE, or bank statement)',
                  'Proof of billing, issued within the last 3 months',
                  '1x1 or 2x2 ID photo',
                  'Active mobile number and email address',
                ].map((doc, i) => (
                  <div key={doc} className="q-row" style={{ justifyContent: 'flex-start', gap: 12, borderTop: i === 0 ? 'none' : undefined }}>
                    <Check className="h-[15px] w-[15px]" style={{ color: 'var(--brand-green-deep)', flexShrink: 0 }} />
                    <span>{doc}</span>
                  </div>
                ))}
                <Link to="/requirements" className="glass-cta" style={{ marginTop: 'auto' }}>
                  See Full Requirements List
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="steps">
        <div className="wrap">
          <Reveal>
            <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
              <h2 style={{ maxWidth: '36ch' }}>{t.landing.howItWorksTitle}</h2>
            </div>
          </Reveal>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="steps-row">
            <motion.div variants={railDraw} className="steps-rail" style={{ transformOrigin: 'left' }} />
            {t.landing.steps.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <motion.div key={step.title} variants={fadeUp} className="step-card">
                  <motion.div variants={badgePop} className="step-badge">
                    {index + 1}
                  </motion.div>
                  <div className="step-icon">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="wrap">
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="feature-row">
            {t.landing.features.map((feature, index) => {
              const Icon = FEATURE_ICONS[index];
              return (
                <motion.div key={feature.title} variants={fadeUp} className="feature-card">
                  <span className="num">{String(index + 1).padStart(2, '0')}</span>
                  <div className="fi">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4>{feature.title}</h4>
                  <p>{feature.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Ways to Pay (2026-08-06 user request, competitor site review) */}
      <section className="ways">
        <div className="wrap">
          <Reveal>
            <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
              <h2>{t.landing.waysToPayTitle}</h2>
              <p style={{ margin: '8px auto 0' }}>{t.landing.waysToPaySubtitle}</p>
            </div>
          </Reveal>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="ways-row" style={{ marginTop: 34 }}>
            {t.landing.waysToPay.map((way, index) => {
              const Icon = WAYS_TO_PAY_ICONS[index];
              const tag = WAYS_TO_PAY_TAGS[index];
              return (
                <motion.div key={way.title} variants={fadeUp} className={`way-card ${index === 1 ? 'navy' : ''}`}>
                  <div className="glow" />
                  <span className="way-tag">{tag}</span>
                  <div className="icon-sq">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h4>{way.title}</h4>
                  <p className="desc">{way.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="wrap">
          <Reveal>
            <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
              <h2>{t.landing.testimonialsTitle}</h2>
              <p style={{ margin: '8px auto 0' }}>{t.landing.testimonialsSubtitle}</p>
              {/* Testimonials themselves are never translated - see TESTIMONIALS' doc comment. */}
              {locale === 'fil' && (
                <p style={{ marginTop: 8, fontSize: '0.76rem', fontStyle: 'italic', color: 'var(--ink-soft)' }}>{t.landing.testimonialsNote}</p>
              )}
            </div>
          </Reveal>
          <motion.div initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }} variants={stagger} className="testi-row" style={{ marginTop: 34 }}>
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div key={index} variants={fadeUp} className="testi-card">
                <Quote className="h-[22px] w-[22px]" aria-hidden="true" />
                <p>&ldquo;{testimonial.quote}&rdquo;</p>
                <b>{testimonial.role}</b>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="faq">
        <div className="wrap">
          <Reveal>
            <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
              <h2>{t.landing.faqTitle}</h2>
            </div>
          </Reveal>
          <div className="faq-list" style={{ marginTop: 34 }}>
            {t.landing.faqs.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <footer className="tease">
        <div className="wrap">
          <Reveal>
            <div className="footer-card">
              <h3 style={{ position: 'relative', zIndex: 1 }}>{t.landing.ctaTitle}</h3>
              <p style={{ position: 'relative', zIndex: 1 }}>{t.landing.ctaBody}</p>
              <Link
                to="/signup"
                className="btn-solid"
                style={{ position: 'relative', zIndex: 1, display: 'inline-flex', padding: '14px 30px' }}
              >
                {t.common.createAccount}
              </Link>
            </div>
          </Reveal>
        </div>
      </footer>

      <LandingFooter />
    </div>
  );
}
