import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Lock,
  Menu,
  Phone,
  Quote,
  ShieldCheck,
  Smartphone,
  UserPlus,
  FileEdit,
  BadgeCheck,
  X,
} from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { EligibilityCheckWidget } from '@/components/EligibilityCheckWidget';
import { LoanCalculatorWidget } from '@/components/LoanCalculatorWidget';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { MobileApplyBar } from '@/components/MobileApplyBar';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SiteFooter } from '@/components/SiteFooter';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/authContext';
import { COMPANY, REGULATORY_DISCLOSURE } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';

const STEP_ICONS = [UserPlus, FileEdit, BadgeCheck];
const FEATURE_ICONS = [Smartphone, CheckCircle2, ShieldCheck];

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
    <div className="rounded-2xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold"
      >
        {question}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="px-5 pb-4 text-sm leading-relaxed text-muted-foreground">{answer}</p>}
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

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={fadeUp}
    >
      {children}
    </motion.div>
  );
}

function Navbar() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="./logo-easycash.png" alt="Easycash" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-base font-bold tracking-tight">Easycash</span>
        </Link>

        <div className="hidden items-center gap-4 md:flex">
          {/* Contact number visible in the header, not just the footer - reputable PH lending
              sites keep a call-us option one glance away for visitors hesitant to apply online.
              lg: only, since md-width already gets tight with the nav links + Login/Apply. */}
          <a
            href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`}
            className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground lg:flex"
          >
            <Phone className="h-3.5 w-3.5" />
            {COMPANY.contact.landline}
          </a>
          <Link
            to="/requirements"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t.nav.requirements}
          </Link>
          <Link to="/news" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {t.nav.news}
          </Link>
          <Link
            to="/security-tips"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t.nav.security}
          </Link>
          <LanguageToggle />
          <ThemeToggle />
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button size="sm">{t.nav.goToDashboard}</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                {t.common.logIn}
              </Link>
              <Link to="/signup">
                <Button size="sm">{t.common.applyNow}</Button>
              </Link>
            </>
          )}
        </div>

        <button className="md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-border bg-background px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            <a
              href={`tel:${COMPANY.contact.landline.replace(/[^\d+]/g, '')}`}
              className="flex items-center gap-1.5 text-sm font-medium"
            >
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              {COMPANY.contact.landline}
            </a>
            <Link to="/requirements" onClick={() => setOpen(false)} className="text-sm font-medium">
              {t.nav.requirementsFull}
            </Link>
            <Link to="/news" onClick={() => setOpen(false)} className="text-sm font-medium">
              {t.nav.newsFull}
            </Link>
            <Link to="/security-tips" onClick={() => setOpen(false)} className="text-sm font-medium">
              {t.nav.securityFull}
            </Link>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{t.nav.language}</span>
              <LanguageToggle />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{t.nav.theme}</span>
              <ThemeToggle />
            </div>
            {isAuthenticated ? (
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button className="w-full">{t.nav.goToDashboard}</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="text-sm font-medium">
                  {t.common.logIn}
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)}>
                  <Button className="w-full">{t.common.applyNow}</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

export function LandingPage() {
  const { t, locale } = useLanguage();
  // Marks where the hero ends, so MobileApplyBar knows when to slide in - see its own doc comment.
  const heroEndRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <MobileApplyBar sentinelRef={heroEndRef} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              {t.landing.badge}
            </motion.span>
            <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t.landing.heroTitle}
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t.landing.heroSubtitle}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button size="lg">{t.landing.applyToday}</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  {t.common.logIn}
                </Button>
              </Link>
            </motion.div>

            {/* Trust strip (2026-07-29) - regulatory disclosure lives in the footer, but a first-time
                visitor decides whether to trust the site before ever scrolling that far. Placed right
                under the CTA, the exact moment reassurance matters most. Values come from
                companyInfo.ts, same single source of truth as the footer - never hardcode these. */}
            <motion.div
              variants={fadeUp}
              className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                {t.landing.trustSecRegistered}
              </span>
              <Link to="/security-tips" className="inline-flex items-center gap-1.5 hover:text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                {t.landing.trustNoAdvanceFee}
              </Link>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 shrink-0 text-primary" />
                {t.landing.trustDataProtected}
              </span>
            </motion.div>
            {/* 2026-07-30 (user request, "polish like a trusted PH lending site"): the SEC Reg./CA
                numbers themselves, not just a "SEC Registered" claim - trusted PH lenders
                (Cashalo, Digido) surface these directly on the landing page, not just buried in
                the footer's regulatory disclosure. Same verified constant the footer already
                uses - never a second, divergent source of truth for these numbers. */}
            <motion.p variants={fadeUp} className="mt-2 text-[11px] text-muted-foreground/80">
              {REGULATORY_DISCLOSURE}
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="relative"
          >
            <ImageWithFallback
              src="./images/hero-seafarer.jpg"
              alt="Easycash client"
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lg"
              fallbackIcon={<ShieldCheck className="h-16 w-16" />}
            />
            <div className="absolute -bottom-6 left-1/2 w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-border bg-card p-5 shadow-xl sm:p-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t.landing.statYearsLabel, value: '14' },
                  { label: t.landing.statDreamsLabel, value: '7,000+' },
                  { label: t.landing.statPartnersLabel, value: '20' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="text-xl font-bold text-primary sm:text-2xl">{stat.value}</p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground sm:text-xs">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
        {/* Zero-height sentinel, not a visual element - MobileApplyBar watches this to know when
            the hero (and its own Apply button) has scrolled out of view. */}
        <div ref={heroEndRef} aria-hidden="true" />
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-20">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.missionTitle}</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">{t.landing.missionBody}</p>
          </Reveal>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.productsTitle}</h2>
            <p className="mt-3 text-muted-foreground">{t.landing.productsSubtitle}</p>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
          >
            {LOAN_PRODUCTS.map((product) => (
              <motion.div
                key={product.category}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div className="relative h-44 w-full overflow-hidden">
                  <ImageWithFallback
                    src={product.image}
                    alt={product.category}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    fallbackIcon={<product.icon className="h-12 w-12" />}
                  />
                  <div className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-xl bg-background/90 text-primary shadow-sm backdrop-blur">
                    <product.icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-base font-semibold">{product.category}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{product.blurb}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Link
                      to="/signup"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5"
                    >
                      {t.landing.applyForThisLoan} <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/requirements"
                      className="text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      {t.landing.seeRequirements}
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Eligibility self-check + Loan Calculator (2026-07-29, widened 2026-07-30) - placed right
          after Products, once a visitor has picked a loan type they're interested in but before
          committing to the full application form. Paired side by side (stacked on mobile) - the
          same "am I eligible" + "how much would I pay" combo near-universal on trusted PH lending
          sites (Tala, Cashalo, Digido). See each widget's own doc comment for why neither invents
          a business rule it can't back up. */}
      <section className="border-t border-border py-20 sm:py-24">
        <div className="container">
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-start">
            <Reveal>
              <EligibilityCheckWidget />
            </Reveal>
            <Reveal>
              <LoanCalculatorWidget />
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.howItWorksTitle}</h2>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="relative mt-14 grid gap-10 sm:grid-cols-3"
          >
            <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />
            {t.landing.steps.map((step, index) => {
              const Icon = STEP_ICONS[index];
              return (
                <motion.div key={step.title} variants={fadeUp} className="relative text-center">
                  <div className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </div>
                  <Icon className="mx-auto mt-4 h-6 w-6 text-primary" />
                  <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={stagger}
          className="container grid gap-8 sm:grid-cols-3"
        >
          {t.landing.features.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <motion.div key={feature.title} variants={fadeUp} className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.testimonialsTitle}</h2>
            <p className="mt-3 text-muted-foreground">{t.landing.testimonialsSubtitle}</p>
            {/* Testimonials themselves are never translated - see TESTIMONIALS' doc comment. */}
            {locale === 'fil' && (
              <p className="mt-2 text-xs italic text-muted-foreground">{t.landing.testimonialsNote}</p>
            )}
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-10 grid gap-6 sm:grid-cols-3"
          >
            {TESTIMONIALS.map((testimonial, index) => (
              <motion.div key={index} variants={fadeUp} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <Quote className="h-6 w-6 shrink-0 text-primary/40" aria-hidden="true" />
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">&ldquo;{testimonial.quote}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold">{testimonial.role}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <div className="container max-w-2xl">
          <Reveal className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.faqTitle}</h2>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-8 space-y-3"
          >
            {t.landing.faqs.map((faq) => (
              <motion.div key={faq.question} variants={fadeUp}>
                <FaqItem question={faq.question} answer={faq.answer} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-24">
        <div className="container">
          <Reveal>
            <div className="rounded-3xl bg-primary px-8 py-12 text-center text-primary-foreground sm:px-16">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.landing.ctaTitle}</h2>
              <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">{t.landing.ctaBody}</p>
              <Link to="/signup" className="mt-6 inline-block">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  {t.common.createAccount}
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
