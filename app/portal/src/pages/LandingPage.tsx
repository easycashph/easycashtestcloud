import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Menu,
  ShieldCheck,
  Smartphone,
  Star,
  UserPlus,
  FileEdit,
  BadgeCheck,
  X,
} from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import { useAuth } from '@/lib/authContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';

const STEPS = [
  { icon: UserPlus, title: 'Create an account', body: 'Sign up with your email in under a minute.' },
  { icon: FileEdit, title: 'Apply online', body: 'Fill out one simple form and submit your requirements.' },
  { icon: BadgeCheck, title: 'Track your status', body: 'See exactly where your application stands, anytime.' },
];

const FEATURES = [
  { icon: Smartphone, title: 'Easy & convenient', body: 'Apply anytime, anywhere, from your phone or desktop.' },
  { icon: CheckCircle2, title: 'Flexible terms', body: 'Payment schedules that work with how you actually get paid.' },
  { icon: ShieldCheck, title: 'Safe & secure', body: 'Your information is protected - we take confidentiality seriously.' },
];

const TESTIMONIALS = [
  {
    rating: 5,
    role: 'Seafarer',
    quote:
      "Being a seafarer means irregular paychecks and a constant fear of financial instability. Easycash changed the game for me. They understand the unique challenges we face, and their seafarer loans were a lifesaver. The lower rates and faster approvals were a breath of fresh air. I'm now well on my way to achieving my dream of owning a home when I retire. Smooth sailing all the way!",
  },
  {
    rating: 4,
    role: 'Seafarer',
    quote:
      "As someone who's been working at sea for over a decade, finding a reliable loan provider that caters to our needs was a constant struggle. But Easycash not only understood our financial frustrations but offered tailored solutions that worked with our income patterns. Their seafarer loans are a game-changer, and the dream of sending my children to college is becoming a reality. Thank you, Easycash!",
  },
  {
    rating: 5,
    role: 'Business Owner',
    quote:
      "As a small business owner, I'd always felt constrained by the rigid requirements and inflexible terms of traditional lenders. Easycash provided a refreshing alternative. Their business loans offer flexibility, competitive rates, and a swift approval process. With their support, I expanded my business, opened new locations, and achieved financial success beyond my wildest dreams. This is the financing partner every entrepreneur needs!",
  },
];

const FAQS = [
  {
    question: 'What is Easycash?',
    answer: 'Easycash is a financial service that provides fast and convenient cash solutions to qualified applicants in the Philippines.',
  },
  {
    question: 'Is Easycash a registered company?',
    answer: 'Yes. Easycash operates in compliance with applicable Philippine laws and regulations.',
  },
  {
    question: 'Who can apply for Easycash services?',
    answer: 'Eligible applicants are Filipino citizens who meet the minimum age, income, and identification requirements.',
  },
  {
    question: 'Who is eligible to apply for a loan?',
    answer: 'Applicants must be at least 18 years old, be a Filipino citizen or resident, have a valid government-issued ID, and have a stable source of income.',
  },
  {
    question: 'Do I need collateral to apply?',
    answer: 'No. Easycash loans are unsecured and do not require collateral.',
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
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="./logo-easycash.png" alt="Easycash" className="h-9 w-9 rounded-lg object-contain" />
          <span className="text-base font-bold tracking-tight">Easycash</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <a href="#products" className="hover:text-foreground">
            Loan Products
          </a>
          <a href="#how-it-works" className="hover:text-foreground">
            How It Works
          </a>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button size="sm">Go to Dashboard</Button>
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground">
                Log In
              </Link>
              <Link to="/signup">
                <Button size="sm">Apply Now</Button>
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
            <a href="#products" onClick={() => setOpen(false)} className="text-sm font-medium">
              Loan Products
            </a>
            <a href="#how-it-works" onClick={() => setOpen(false)} className="text-sm font-medium">
              How It Works
            </a>
            {isAuthenticated ? (
              <Link to="/dashboard" onClick={() => setOpen(false)}>
                <Button className="w-full">Go to Dashboard</Button>
              </Link>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)} className="text-sm font-medium">
                  Log In
                </Link>
                <Link to="/signup" onClick={() => setOpen(false)}>
                  <Button className="w-full">Apply Now</Button>
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
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-24">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.span
              variants={fadeUp}
              className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              Easycash Lending Company Inc.
            </motion.span>
            <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              We&apos;re here to empower your financial voyage
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Apply for a loan online in minutes, track your application status in real time, and manage your account -
              all from one place.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button size="lg">Apply for a Loan Today</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Log In
                </Button>
              </Link>
            </motion.div>
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
                  { label: 'Years in Business', value: '14' },
                  { label: 'Dreams Reached', value: '7,000+' },
                  { label: 'Corporate Partners', value: '20' },
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
      </section>

      {/* Mission */}
      <section className="py-16 sm:py-20">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Dream Big, Fear Less</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              We understand the fears - debt traps, loan rejections, and financial uncertainties. Your dreams are worth
              pursuing, and we&apos;re here to minimize your fears. Our commitment is to provide not just fast loans but
              pathways to a brighter future. Your dreams, your financial security - it&apos;s what we live for.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">A loan for every dream</h2>
            <p className="mt-3 text-muted-foreground">Whatever you're working toward, there's an Easycash product built for it.</p>
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
                  <Link
                    to="/signup"
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary transition-transform group-hover:translate-x-0.5"
                  >
                    Apply for this loan <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">No nonsense. Just a better borrowing experience.</h2>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="relative mt-14 grid gap-10 sm:grid-cols-3"
          >
            <div className="pointer-events-none absolute left-0 right-0 top-5 hidden h-px bg-border sm:block" />
            {STEPS.map((step, index) => (
              <motion.div key={step.title} variants={fadeUp} className="relative text-center">
                <div className="relative mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <step.icon className="mx-auto mt-4 h-6 w-6 text-primary" />
                <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </motion.div>
            ))}
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
          {FEATURES.map((feature) => (
            <motion.div key={feature.title} variants={fadeUp} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">People say the nicest things</h2>
            <p className="mt-3 text-muted-foreground">
              Here&apos;s the compelling reason why thousands of businesses and individuals have opted for our expertise to
              drive their financial growth.
            </p>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-10 grid gap-6 sm:grid-cols-3"
          >
            {TESTIMONIALS.map((t, index) => (
              <motion.div key={index} variants={fadeUp} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex gap-0.5 text-amber-500">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4" fill={i < t.rating ? 'currentColor' : 'none'} />
                  ))}
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-4 text-sm font-semibold">{t.role}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FAQs */}
      <section className="border-t border-border bg-secondary/30 py-20 sm:py-24">
        <div className="container max-w-2xl">
          <Reveal className="text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Frequently asked questions</h2>
          </Reveal>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={stagger}
            className="mt-8 space-y-3"
          >
            {FAQS.map((faq) => (
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
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to get started?</h2>
              <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
                Create your free Easycash account and apply for a loan in minutes.
              </p>
              <Link to="/signup" className="mt-6 inline-block">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                >
                  Create Your Account
                </Button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border py-12">
        <div className="container grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
              <span className="text-sm font-bold tracking-tight">Easycash Lending Company, Inc.</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Unit 9 G/F The Midland Plaza, M Adriatico, Barangay 669, Ermita, Manila.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">SEC Reg No. CS201001882 &middot; COA No. 640</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Contact</p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>(02) 5 310-3708</li>
              <li>SMART: 0947 595 6151</li>
              <li>GLOBE: 0927 784 7091</li>
              <li>
                <a href="mailto:dataprivacyofficer@easycash.ph" className="hover:text-foreground">
                  dataprivacyofficer@easycash.ph
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Quick Links</p>
            <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
              <li>
                <Link to="/privacy-policy" className="hover:text-foreground">
                  Data Privacy Statement &amp; Consent
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-foreground">
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <a href="#products" className="hover:text-foreground">
                  Loan Products
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="container mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Easycash Lending Company, Inc. All rights reserved.</p>
          <p>Internal preview build - not yet live.</p>
        </div>
      </footer>
    </div>
  );
}
