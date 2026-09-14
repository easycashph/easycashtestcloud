import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  ArrowRight,
  ArrowRightLeft,
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  Info,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  Phone,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import * as React from 'react';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { ChromaKeyImage } from '@/components/ChromaKeyImage';
import { EligibilityCheckWidget } from '@/components/EligibilityCheckWidget';
import { FaqAccordionItem } from '@/components/FaqAccordionItem';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { Navbar } from '@/components/Navbar';
import { PaymentChannelsMarquee } from '@/components/PaymentChannelsMarquee';
import { Reveal } from '@/components/Reveal';
import { MobileApplyBar } from '@/components/MobileApplyBar';
import { COMPANY, FORMATTED_ADDRESS, OFFICIAL_BANK_ACCOUNT, REGULATORY_DISCLOSURE } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { getLoanProductDisplayLabel, LOAN_PRODUCTS, localizedProductText } from '@/lib/loanProducts';
import { estimateMonthlyPayment, estimateTotalRepayment } from '@/lib/loanEstimator';
import './landingMockupClone.css';

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString()}`;
}

/** 2026-09-10 (world-class redesign) hero stage snapshot - a static, illustrative figure (not an
 * interactive control anymore: the real interactive calculator now lives in its own dedicated
 * section below, per the redesign brief's "one immersive navy section carrying the calculator").
 * Same posture as the previous hero card's defaults - a representative example only, not
 * Easycash's published minimum/maximum/typical loan. */
const HERO_SNAPSHOT_PRINCIPAL = 150_000;
const HERO_SNAPSHOT_TERM_MONTHS = 12;
/** 2026-09-10 (user request, "Seafarer Loan is the #1 featured product"): switched from Salary
 * Loan - the hero photo is already a seafarer portrait, so the sample figure now matches what's
 * pictured. Every category shares the same flat 3%/month rate (see loanEstimator.ts), so this is
 * a labeling/consistency change only - the computed monthly figure is unchanged. */
const HERO_SNAPSHOT_CATEGORY = 'Seafarer Loan';

/** Calculator section bounds. The amount floor is UI convenience only (see LoanCalculatorWidget's
 * own doc comment) - never presented as Easycash's official minimum. The ceiling tracks
 * CALC_CATEGORY's own real `maxAmount` in loanProducts.ts (CONFIRMED, read off the live
 * easycash.ph product page, 2026-09-10) rather than a flat guess. */
const CALC_AMOUNT_MIN = 5_000;
const CALC_AMOUNT_STEP = 5_000;
const CALC_TERM_MIN = 1;
/** 2026-09-10 (user-confirmed business rule): Easycash does not offer installment terms beyond 12
 * months on any product - matches the same cap in LoanCalculatorWidget.tsx. */
const CALC_TERM_MAX = 12;
/** 2026-09-10 (user request, "Seafarer Loan is the #1 featured product"): switched from Salary
 * Loan, matching the hero and featured-product row - this section should showcase the same
 * flagship product, not a different one. */
const CALC_CATEGORY = 'Seafarer Loan';
const CALC_AMOUNT_MAX = LOAN_PRODUCTS.find((p) => p.category === CALC_CATEGORY)?.maxAmount ?? 200_000;

/** Decorative category labels for the product rows (mockup-approved lineage) - paired by index
 * with LOAN_PRODUCTS, not a value from loanProducts.ts itself (see that file's own doc comment on
 * why `category` must stay the exact backend-facing value). */
/** Paired by index with LOAN_PRODUCTS - reordered 2026-09-10 to match that array's own reorder
 * (Seafarer first). */
const PRODUCT_TAGS = ['Overseas', 'Salary', 'Business'];

/** Icons for the "Ways to pay" 3-step repayment process (2026-09-11 redesign) - paired by index
 * with `t.landing.repaymentSteps` (enter account number / transfer the exact amount / keep your
 * reference number). */
const REPAY_STEP_ICONS = [KeyRound, ArrowRightLeft, ReceiptText];

/** Illustrations for the "Why borrow with Easycash" section (2026-09-11 user request, "insert
 * images to this section, use the following images") - paired by index with t.landing.features
 * (Easy & convenient / Flexible terms / Safe & secure). Each source file has a flat solid-color
 * background (not our navy/lime palette) - rendered through `ChromaKeyImage` rather than as a plain
 * `<img>` so that background is keyed out to transparent at runtime and the surrounding
 * `.step__img` panel's own navy gradient shows through instead, while the illustration's own colors
 * stay untouched (user's explicit choice over recoloring everything or leaving the green as-is). */
const REASON_IMAGES = ['./images/easy.png', './images/flexible.png', './images/secure.png'];

/** Illustrations per "How it works" step (paired by index with t.landing.steps - Create an
 * account / Apply online / Track your status).
 *
 * History: started as custom duotone icon glyphs (StepIcons.tsx) since real product screenshots
 * weren't usable on this public marketing page (signup/the application form/the dashboard are all
 * only reachable authenticated). 2026-09-11 (user request, "use the following images"): replaced
 * with the user's own supplied illustrations. Rendered as plain framed images (not run through
 * `ChromaKeyImage`, unlike the "Why borrow" section's illustrations) - two of these have a clean
 * flat background that would key out fine, but `step-track-status.png` is a full scene (a room,
 * window, plants), not a flat color, so chroma-keying it would fail; kept all three in the same
 * plain-framed treatment for visual consistency across the row rather than mixing techniques. */
const STEP_IMAGES = ['./images/step-create-account.png', './images/step-apply-online.png', './images/step-track-status.png'];

const HERO_PHOTO_SRC = './images/hero-seafarer.jpg';

/** Client stories inherited from the legacy Easycash website - see loanProducts.ts-adjacent
 * history. Star ratings were removed 2026-07-28 (implied a review system that doesn't exist).
 * Kept English-only (not translated) even under Filipino: direct quotes as originally given, not
 * Easycash's own copy - `testimonialsNote` says so explicitly when Filipino is selected.
 * PENDING BUSINESS DECISION: unattributed, consent status undocumented - see
 * docs/PORTAL_WEBSITE_STRATEGY.md §3.4 and §7 question 7. */
const TESTIMONIALS = [
  {
    role: 'Seafarer',
    quote:
      "Being a seafarer means irregular paychecks and a constant fear of financial instability. Easycash changed the game for me. They understand the unique challenges we face, and their seafarer loans were a lifesaver. The lower rates and faster approvals were a breath of fresh air. I'm now well on my way to achieving my dream of owning a home when I retire.",
  },
  {
    role: 'Seafarer',
    quote:
      "As someone who's been working at sea for over a decade, finding a reliable loan provider that caters to our needs was a constant struggle. Easycash offered tailored solutions that worked with our income patterns. The dream of sending my children to college is becoming a reality.",
  },
  {
    role: 'Business Owner',
    quote:
      "As a small business owner, I'd always felt constrained by the rigid requirements of traditional lenders. Easycash's business loans offer flexibility, competitive rates, and a swift approval process. I expanded my business and opened new locations.",
  },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

function LandingFooter() {
  const { t } = useLanguage();

  return (
    <footer className="site-footer">
      <div className="shell">
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
              >
                {t.footer.viewOnMap}
              </a>
            </p>
            <p className="reg">
              <ShieldCheck className="h-3.5 w-3.5" />
              {REGULATORY_DISCLOSURE}
            </p>
            <p className="tag">{t.footer.tagline}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              {/* Plain white chip behind the seal - the source PNG is designed for a light
                  background and reads poorly directly on this footer's navy (2026-09-11). */}
              <span style={{ display: 'inline-flex', background: '#fff', borderRadius: 8, padding: 6 }}>
                <img src="./npc-seal.png" alt="National Privacy Commission - DPO/DPS Registered" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, color: 'rgba(255,255,255,0.65)' }}>
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
                <a href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ico"><Phone className="h-3 w-3" /></span>
                  {COMPANY.contact.landline}
                </a>
              </li>
              <li style={{ paddingLeft: 30 }}>
                SMART: {COMPANY.contact.mobileSmart} &middot; GLOBE: {COMPANY.contact.mobileGlobe}
              </li>
              <li>
                <a href={`mailto:${COMPANY.contact.email}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="ico"><Mail className="h-3 w-3" /></span>
                  {COMPANY.contact.email}
                </a>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="ico"><Clock className="h-3 w-3" /></span>
                {COMPANY.contact.businessHours}
              </li>
              <li style={{ paddingLeft: 30 }}>
                <Link to="/contact" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                  {t.footer.contactPageLink}
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <p className="footer-heading">{t.footer.quickLinksHeading}</p>
            <ul className="footer-list">
              <li><Link to="/requirements">{t.footer.requirements}</Link></li>
              <li><Link to="/security-tips">{t.footer.security}</Link></li>
              <li><Link to="/complaints">{t.footer.complaints}</Link></li>
              <li><Link to="/privacy-policy">{t.footer.privacy}</Link></li>
              <li><Link to="/terms">{t.footer.terms}</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom-wrap">
        <div className="shell footer-bottom">
          <p>&copy; {new Date().getFullYear()} {COMPANY.legalName} {t.footer.rightsReserved}</p>
          <p className="warn">{t.footer.scamWarning}</p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage() {
  const { t, locale } = useLanguage();
  const heroEndRef = React.useRef<HTMLDivElement>(null);

  // "Ways to pay" official account panel - copy-to-clipboard convenience for the account number
  // (2026-09-11 redesign). Falls back silently if the Clipboard API is unavailable (e.g. non-HTTPS
  // preview) rather than throwing - copying is a nicety, the number is also shown as plain text.
  const [accountCopied, setAccountCopied] = React.useState(false);
  const copyAccountNo = React.useCallback(() => {
    navigator.clipboard?.writeText(OFFICIAL_BANK_ACCOUNT.accountNo).then(
      () => {
        setAccountCopied(true);
        window.setTimeout(() => setAccountCopied(false), 2000);
      },
      () => {},
    );
  }, []);

  // Calculator section state - a real interactive calculator (amount + term), same formula
  // LoanCalculatorWidget uses (estimateMonthlyPayment/estimateTotalRepayment - see loanEstimator.ts
  // doc comment for the real, verified 3%/month flat add-on rate this mirrors).
  const [calcAmount, setCalcAmount] = React.useState(75_000);
  const [calcTerm, setCalcTerm] = React.useState(12);
  const calcMonthly = estimateMonthlyPayment(calcAmount, calcTerm, CALC_CATEGORY);
  const calcTotal = estimateTotalRepayment(calcAmount, calcTerm, CALC_CATEGORY);
  const calcInterest = calcTotal - calcAmount;
  const amountFillPct = ((calcAmount - CALC_AMOUNT_MIN) / (CALC_AMOUNT_MAX - CALC_AMOUNT_MIN)) * 100;
  const termFillPct = ((calcTerm - CALC_TERM_MIN) / (CALC_TERM_MAX - CALC_TERM_MIN)) * 100;
  const principalPct = (calcAmount / calcTotal) * 100;

  const heroSnapshotMonthly = estimateMonthlyPayment(HERO_SNAPSHOT_PRINCIPAL, HERO_SNAPSHOT_TERM_MONTHS, HERO_SNAPSHOT_CATEGORY);

  // The lead product row in the redesigned products section (2026-09-10) - split out to a
  // capitalized local so its icon can be used as a JSX component (`LOAN_PRODUCTS[0].icon` isn't a
  // valid JSX tag name - only simple dotted member expressions are).
  const FEATURED_PRODUCT = LOAN_PRODUCTS[0];
  const FeaturedIcon = FEATURED_PRODUCT.icon;

  return (
    <div className="landing-mockup">
      <MobileApplyBar sentinelRef={heroEndRef} />
      <Navbar />

      {/* ============================== HERO ============================== */}
      <section className="hero">
        <div className="hero__wash" aria-hidden="true" />
        <div className="hero__ring" aria-hidden="true" />
        <div className="shell">
          <motion.div className="hero__in" initial="hidden" animate="show" variants={stagger}>
            <div>
              <motion.span variants={fadeUp} className="hero__badge">
                {t.landing.badge}
              </motion.span>
              <motion.h1 variants={fadeUp} className="hero__title">
                {locale === 'fil' ? (
                  <>Pautang na kasabay ng <em>bilis ng iyong pangarap.</em></>
                ) : (
                  <>Lending that moves at the <em>speed of your ambition.</em></>
                )}
              </motion.h1>
              <motion.p variants={fadeUp} className="lede hero__lede">
                {t.landing.heroSubtitle}
              </motion.p>
              <motion.div variants={fadeUp} className="hero__actions">
                <Link to="/signup" className="btn btn--primary btn--lg">
                  {t.landing.applyToday}
                </Link>
                <Link to="/login" className="tlink">
                  {t.common.logIn}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </motion.div>
              <motion.p variants={fadeUp} className="hero__note">
                <ShieldCheck className="h-4 w-4" />
                {t.landing.disbursementNotice}
              </motion.p>
            </div>

            <motion.div
              className="stage"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            >
              <div className="stage__photo">
                <ImageWithFallback src={HERO_PHOTO_SRC} alt="" fallbackIcon={null} priority />
                <span className="stage__tag">Featured &middot; {FEATURED_PRODUCT.displayLabel}</span>
              </div>
              <div className="chip chip--amount">
                <span className="chip__label">Sample loan amount</span>
                <span className="chip__value">{peso(HERO_SNAPSHOT_PRINCIPAL)}</span>
              </div>
              <div className="chip chip--term">
                <span className="chip__label">Est. monthly &middot; {HERO_SNAPSHOT_TERM_MONTHS} mo</span>
                <span className="chip__value">{peso(heroSnapshotMonthly)}</span>
              </div>
              <div className="chip chip--status">
                <span className="chip__dot"><CheckCircle2 className="h-3.5 w-3.5" /></span>
                <b>{t.landing.trustSecRegistered}</b>
              </div>
            </motion.div>
          </motion.div>
        </div>
        <div ref={heroEndRef} aria-hidden="true" />
      </section>

      {/* ============================== STATS BAND ============================== */}
      <section className="band">
        <div className="shell band__in">
          {[
            { label: t.landing.statYearsLabel, to: 16, suffix: '' },
            { label: t.landing.statDreamsLabel, to: 7000, suffix: '+' },
            { label: t.landing.statPartnersLabel, to: 20, suffix: '' },
          ].map((stat) => (
            <div key={stat.label}>
              <b className="figure stat__n">
                <AnimatedCounter to={stat.to} suffix={stat.suffix} />
              </b>
              <span className="stat__l">{stat.label}</span>
            </div>
          ))}
          <div className="assurances">
            {[
              { icon: ShieldCheck, label: t.landing.trustSecRegistered },
              { icon: CheckCircle2, label: t.landing.trustNoAdvanceFee },
              { icon: Lock, label: t.landing.trustDataProtected },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="assurance">
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== STATEMENT ============================== */}
      <section className="section statement">
        <div className="shell statement__in">
          <Reveal>
            <h2>
              {locale === 'fil' ? (
                <>Mangarap nang Malaki, <em>Bawasan ang Takot</em></>
              ) : (
                <>Dream Big, <em>Fear Less</em></>
              )}
            </h2>
          </Reveal>
          <Reveal className="statement__body">
            <p className="lede">{t.landing.missionBody}</p>
          </Reveal>
        </div>
      </section>

      {/* ============================== CALCULATOR (immersive navy) ==============================
          Deliberately placed BEFORE the loan products section (2026-09-10 user request): a visitor
          should be able to size up "what would this cost me" before being asked to pick a product. */}
      <section className="section calc">
        <div className="shell calc__in">
          <div>
            <Reveal>
              <p className="eyebrow eyebrow--on-navy">Loan calculator</p>
              <h2>How much do you need?</h2>
              <p className="calc__sub">
                Move the sliders to see an estimate for a {getLoanProductDisplayLabel(CALC_CATEGORY)}. This is a sample
                computation only, not a loan offer - your actual approved amount, term, and rate are confirmed during
                application review.
              </p>
            </Reveal>

            <Reveal>
              <div className="ctrl">
                <div className="ctrl__top">
                  <span className="ctrl__label">Loan amount</span>
                </div>
                <span className="figure ctrl__value ctrl__value--xl">{peso(calcAmount)}</span>
                <div className="range">
                  <div className="range__track" />
                  <div className="range__fill" style={{ width: `${amountFillPct}%` }} />
                  <input
                    type="range"
                    aria-label="Loan amount"
                    min={CALC_AMOUNT_MIN}
                    max={CALC_AMOUNT_MAX}
                    step={CALC_AMOUNT_STEP}
                    value={calcAmount}
                    onChange={(e) => setCalcAmount(Number(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  <div className="range__knob" style={{ left: `${amountFillPct}%` }} />
                </div>
                <div className="range__ends">
                  <span>{peso(CALC_AMOUNT_MIN)}</span>
                  <span>{peso(CALC_AMOUNT_MAX)}</span>
                </div>
              </div>

              <div className="ctrl">
                <div className="ctrl__top">
                  <span className="ctrl__label">Loan term</span>
                  <span className="figure ctrl__value ctrl__value--md">{calcTerm} {calcTerm === 1 ? 'month' : 'months'}</span>
                </div>
                <div className="range">
                  <div className="range__track" />
                  <div className="range__fill" style={{ width: `${termFillPct}%` }} />
                  <input
                    type="range"
                    aria-label="Loan term"
                    min={CALC_TERM_MIN}
                    max={CALC_TERM_MAX}
                    step={1}
                    value={calcTerm}
                    onChange={(e) => setCalcTerm(Number(e.target.value))}
                    onWheel={(e) => e.currentTarget.blur()}
                  />
                  <div className="range__knob" style={{ left: `${termFillPct}%` }} />
                </div>
                <div className="range__ends">
                  <span>{CALC_TERM_MIN} month</span>
                  <span>{CALC_TERM_MAX} months</span>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal>
            <div className="result">
              <p className="result__label">Estimated monthly repayment</p>
              <p className="figure result__figure">
                {peso(calcMonthly)}
                <span className="result__per">/month</span>
              </p>

              <div className="split">
                <div className="split__bar">
                  <div className="split__seg split__seg--principal" style={{ width: `${principalPct}%` }} />
                  <div className="split__seg split__seg--interest" style={{ width: `${100 - principalPct}%` }} />
                </div>
                <div className="split__keys">
                  <span className="split__key">
                    <span className="split__swatch split__swatch--principal" />
                    Principal <b>{peso(calcAmount)}</b>
                  </span>
                  <span className="split__key">
                    <span className="split__swatch split__swatch--interest" />
                    Interest <b>{peso(calcInterest)}</b>
                  </span>
                </div>
              </div>

              <div className="sched">
                <p className="ctrl__label">Repayment schedule &middot; {calcTerm} equal installments</p>
                <div className="sched__ticks" aria-hidden="true">
                  {Array.from({ length: calcTerm }).map((_, i) => (
                    <div key={i} className="sched__tick" style={{ animationDelay: `${i * 14}ms` }} />
                  ))}
                </div>
              </div>

              <div className="calc__foot">
                <Link to="/signup" className="btn btn--lime btn--lg">
                  Apply for this loan
                </Link>
                <Link to="/requirements" className="tlink tlink--on-navy">
                  See requirements
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <p className="calc__fine">Sample computation only, not a loan offer - see full disclaimer below.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== LOAN PRODUCTS ============================== */}
      <section id="products" className="section products">
        <span className="section__ghost" aria-hidden="true">Loans</span>
        <div className="shell">
          <Reveal>
            <div className="products__head">
              <div>
                <p className="eyebrow">Loan options</p>
                <h2>{t.landing.productsTitle}</h2>
              </div>
              <p className="lede">{t.landing.productsSubtitle}</p>
            </div>
          </Reveal>

          {/* Featured product: the fullest editorial treatment, same row this section always used.
              Ordered first in LOAN_PRODUCTS (Business/SME) - not a claim that it's "the best loan",
              just the natural lead position for the widest-reach product category. */}
          <Reveal>
            <div className="prow prow--feature">
              <div>
                <span className="prow__index">01</span>
                <p className="prow__kicker" style={{ marginTop: 16 }}>{PRODUCT_TAGS[0]}</p>
                <h3>{FEATURED_PRODUCT.displayLabel}</h3>
                <p className="prow__blurb">{localizedProductText(FEATURED_PRODUCT.blurb, locale)}</p>
                <p className="prow__detail">{localizedProductText(FEATURED_PRODUCT.details, locale)}</p>
                <div className="prow__foot">
                  <Link to="/signup" className="btn btn--quiet btn--on-navy">
                    Explore this loan
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <span className="trust-chip trust-chip--on-navy">
                    <ShieldCheck className="h-3.5 w-3.5" /> {t.landing.trustSecRegistered}
                  </span>
                </div>
              </div>
              <div className="prow__media">
                <div className="prow__frame">
                  <ImageWithFallback src={FEATURED_PRODUCT.image} alt="" fallbackIcon={<FeaturedIcon className="h-8 w-8" />} />
                </div>
              </div>
            </div>
          </Reveal>

          {/* The remaining two products - visually connected as a pair rather than repeating the
              same full-width row twice more, so the section has real hierarchy instead of three
              identical blocks. */}
          <div className="product-pair">
            {LOAN_PRODUCTS.slice(1).map((product, pairIndex) => {
              const index = pairIndex + 1;
              return (
                <Reveal key={product.category}>
                  <Link to="/signup" className="pcard">
                    <div className="pcard__frame">
                      <ImageWithFallback src={product.image} alt="" fallbackIcon={<product.icon className="h-7 w-7" />} />
                      <span className="pcard__index">{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className="pcard__body">
                      <p className="prow__kicker">{PRODUCT_TAGS[index]}</p>
                      <h4>{product.displayLabel}</h4>
                      <p>{localizedProductText(product.blurb, locale)}</p>
                      <span className="pcard__cta">
                        Explore this loan
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================== TRANSPARENCY FLOW ============================== */}
      <section className="section">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Transparency</p>
            <h2 style={{ maxWidth: '20ch' }}>Know exactly what you&apos;re borrowing.</h2>
          </Reveal>
          <Reveal>
            <div className="flow">
              <div className="flow__step">
                <p className="flow__k">Loan amount</p>
                <p className="flow__v">{peso(calcAmount)}</p>
                <span className="flow__n">What you borrow</span>
              </div>
              <div className="flow__step">
                <p className="flow__k">Interest</p>
                <p className="flow__v">{peso(calcInterest)}</p>
                <span className="flow__n">Over {calcTerm} {calcTerm === 1 ? 'month' : 'months'}</span>
              </div>
              <div className="flow__step">
                <p className="flow__k">Monthly repayment</p>
                <p className="flow__v">{peso(calcMonthly)}</p>
                <span className="flow__n">{calcTerm} equal installments</span>
              </div>
              <div className="flow__step flow__step--total">
                <p className="flow__k">Total repayment</p>
                <p className="flow__v">{peso(calcTotal)}</p>
                <span className="flow__n">Principal + interest</span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== HOW IT WORKS ============================== */}
      <section id="how-it-works" className="section" style={{ background: 'var(--surface-2)' }}>
        <div className="shell">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 style={{ maxWidth: '30ch' }}>{t.landing.howItWorksTitle}</h2>
          </Reveal>
          <Reveal>
            <div className="steps steps--illustrated">
              {t.landing.steps.map((step, index) => (
                <div key={step.title} className="step">
                  <div className="step__img step__img--plain">
                    <img src={STEP_IMAGES[index]} alt="" className="step__img-plain" />
                    <span className="step__n">{index + 1}</span>
                  </div>
                  <h4>{step.title}</h4>
                  <p>{step.body}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================== QUALIFY ============================== */}
      <section className="section qualify">
        <div className="shell">
          <div className="qualify__grid">
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
                <ul className="reqs">
                  {[
                    '1 valid government-issued ID',
                    'Proof of income (payslip, COE, or bank statement)',
                    'Proof of billing, issued within the last 3 months',
                    '1x1 or 2x2 ID photo',
                    'Active mobile number and email address',
                  ].map((doc) => (
                    <li key={doc}>
                      <Check className="h-[15px] w-[15px]" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/requirements" className="glass-cta" style={{ marginTop: 'auto' }}>
                  See Full Requirements List
                </Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================== REASONS ============================== */}
      <section className="section section--glow-lime">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Why borrow with Easycash</p>
            <h2 style={{ maxWidth: '28ch' }}>A better borrowing experience, by design.</h2>
          </Reveal>
          <div className="steps steps--illustrated">
            {t.landing.features.map((feature, index) => (
              <Reveal key={feature.title}>
                <div className="step">
                  <div className="step__img step__img--photo">
                    <ChromaKeyImage src={REASON_IMAGES[index]} alt="" className="step__img-canvas" />
                    <span className="step__n">{index + 1}</span>
                  </div>
                  <h4>{feature.title}</h4>
                  <p>{feature.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== WAYS TO PAY ==============================
          2026-09-11 redesign (user request: "premium, modern, high-tech fintech" repayment
          section) - moved onto the same immersive navy gradient as "Documents by loan type"
          (`.repay-section`, mirrors that section's `docs-section` pattern) and built out with a
          bank/e-wallet marquee, a 3-step process, and the official account panel (restores
          `OFFICIAL_BANK_ACCOUNT` to the public page - `officialBankAccountHeading`/
          `officialBankAccountProofNote` already existed in translations.ts but had gone unused
          since the 2026-09-10 rewrite; PortalOfficialBankAccountCard.tsx's own doc comment still
          claimed parity with "the public landing page's Ways to Pay card", which this restores). */}
      <section
        className="section section--glow-navy repay-section"
        style={{ background: 'linear-gradient(165deg, var(--navy-950), var(--navy-800))' }}
      >
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Repayment</p>
            <h2>{t.landing.waysToPayTitle}</h2>
            <p className="lede" style={{ marginTop: 12 }}>{t.landing.waysToPaySubtitle}</p>
          </Reveal>
        </div>

        <Reveal>
          <p
            className="eyebrow eyebrow--on-navy"
            style={{ justifyContent: 'center', marginTop: 'clamp(1.5rem, 1rem + 1.5vw, 2.5rem)' }}
          >
            {t.landing.waysToPayMarqueeCaption}
          </p>
          <PaymentChannelsMarquee />
        </Reveal>

        <div className="shell">
          <Reveal>
            <div className="repay-grid">
              <div className="repay-steps">
                {t.landing.repaymentSteps.map((step, index) => {
                  const Icon = REPAY_STEP_ICONS[index];
                  return (
                    <div className="repay-step" key={step.title}>
                      <span className="repay-step__n">{String(index + 1).padStart(2, '0')}</span>
                      <span className="repay-step__ico">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div>
                        <h4>{step.title}</h4>
                        <p>{step.body}</p>
                      </div>
                    </div>
                  );
                })}
                <p className="repay-pdc-note">
                  <Info className="h-4 w-4" />
                  {t.landing.pdcAccountNote}
                </p>
              </div>

              <div className="repay-account">
                <div className="repay-account__top">
                  <span className="repay-account__ico">
                    <Landmark className="h-5 w-5" />
                  </span>
                  <span className="repay-account__badge">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Official channel
                  </span>
                </div>
                <h4>{t.landing.officialBankAccountHeading}</h4>
                <dl className="repay-account__list">
                  <div>
                    <dt>Account Name</dt>
                    <dd>{OFFICIAL_BANK_ACCOUNT.accountName}</dd>
                  </div>
                  <div>
                    <dt>Bank</dt>
                    <dd>
                      {OFFICIAL_BANK_ACCOUNT.bankName} &middot; {OFFICIAL_BANK_ACCOUNT.branch}
                    </dd>
                  </div>
                  <div className="repay-account__accno-row">
                    <div>
                      <dt>Account No.</dt>
                      <dd className="repay-account__accno">{OFFICIAL_BANK_ACCOUNT.accountNo}</dd>
                    </div>
                    <button
                      type="button"
                      className="repay-account__copy"
                      data-copied={accountCopied}
                      onClick={copyAccountNo}
                    >
                      {accountCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {accountCopied ? t.landing.copiedAccountNo : t.landing.copyAccountNo}
                    </button>
                  </div>
                </dl>
                <p className="repay-account__proof">
                  <Mail className="h-3.5 w-3.5" />
                  {t.landing.officialBankAccountProofNote}{' '}
                  <a href={`mailto:${OFFICIAL_BANK_ACCOUNT.proofOfPaymentEmail}`}>{OFFICIAL_BANK_ACCOUNT.proofOfPaymentEmail}</a>
                </p>
              </div>
            </div>
          </Reveal>

          <div className="pays">
            {t.landing.waysToPay.map((way, index) => {
              const Icon = index === 0 ? Banknote : CalendarClock;
              return (
                <Reveal key={way.title}>
                  <div className="pay">
                    <div className="pay__top">
                      <span className="pay__ico"><Icon className="h-5 w-5" /></span>
                      <span className="pay__tag">{index === 0 ? 'Instant' : 'Scheduled'}</span>
                    </div>
                    <h4>{way.title}</h4>
                    <p>{way.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================== VOICES ============================== */}
      <section className="section">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">{t.landing.testimonialsTitle}</p>
            <h2 style={{ maxWidth: '30ch' }}>{t.landing.testimonialsSubtitle}</h2>
            {locale === 'fil' && <p className="voices__note">{t.landing.testimonialsNote}</p>}
          </Reveal>
          <div className="voices">
            <Reveal className="voice voice--lead">
              <blockquote>&ldquo;{TESTIMONIALS[0].quote}&rdquo;</blockquote>
              <p className="voice__by">{TESTIMONIALS[0].role}</p>
            </Reveal>
            <div>
              {TESTIMONIALS.slice(1).map((testimonial, i) => (
                <Reveal key={i} className="voice voice--sm">
                  <blockquote>&ldquo;{testimonial.quote}&rdquo;</blockquote>
                  <p className="voice__by">{testimonial.role}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== FAQ ============================== */}
      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <div className="shell">
          <div className="faq__grid">
            <Reveal>
              <p className="eyebrow">FAQ</p>
              <h2>{t.landing.faqTitle}</h2>
            </Reveal>
            <Reveal>
              <div>
                {t.landing.faqs.map((faq) => (
                  <FaqAccordionItem key={faq.question} question={faq.question} answer={faq.answer} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============================== CLOSE ============================== */}
      <section className="section close">
        <div className="shell close__in">
          <Reveal>
            <h2>{t.landing.ctaTitle}</h2>
          </Reveal>
          <Reveal>
            <p>{t.landing.ctaBody}</p>
          </Reveal>
          <Reveal>
            <div className="close__actions">
              <Link to="/signup" className="btn btn--lime btn--lg">
                {t.common.createAccount}
              </Link>
              <Link to="/login" className="tlink tlink--on-navy">
                {t.common.logIn}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
