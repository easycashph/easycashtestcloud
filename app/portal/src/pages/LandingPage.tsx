import { Link } from 'react-router-dom';
import { CheckCircle2, Menu, ShieldCheck, Smartphone, X } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/authContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';

const STEPS = [
  { title: 'Create an account', body: 'Sign up with your email in under a minute.' },
  { title: 'Apply online', body: 'Fill out one simple form and submit your requirements.' },
  { title: 'Track your status', body: 'See exactly where your application stands, anytime.' },
];

const FEATURES = [
  { icon: Smartphone, title: 'Easy & convenient', body: 'Apply anytime, anywhere, from your phone or desktop.' },
  { icon: CheckCircle2, title: 'Flexible terms', body: 'Payment schedules that work with how you actually get paid.' },
  { icon: ShieldCheck, title: 'Safe & secure', body: 'Your information is protected - we take confidentiality seriously.' },
];

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
          <div>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              Easycash Lending Company Inc.
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              We&apos;re here to empower your financial voyage
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Apply for a loan online in minutes, track your application status in real time, and manage your account -
              all from one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup">
                <Button size="lg">Apply for a Loan Today</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Log In
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="grid grid-cols-3 gap-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
              {[
                { label: 'Years in Business', value: '14' },
                { label: 'Dreams Reached', value: '7,000+' },
                { label: 'Corporate Partners', value: '20' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-2xl font-bold text-primary sm:text-3xl">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="border-t border-border bg-secondary/30 py-16 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">A loan for every dream</h2>
            <p className="mt-3 text-muted-foreground">Whatever you're working toward, there's an Easycash product built for it.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LOAN_PRODUCTS.map((product) => (
              <div key={product.category} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <product.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{product.category}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{product.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-16 sm:py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">No nonsense. Just a better borrowing experience.</h2>
          </div>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title} className="text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {index + 1}
                </div>
                <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-secondary/30 py-16 sm:py-20">
        <div className="container grid gap-8 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="container">
          <div className="rounded-3xl bg-primary px-8 py-12 text-center text-primary-foreground sm:px-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Ready to get started?</h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-foreground/80">
              Create your free Easycash account and apply for a loan in minutes.
            </p>
            <Link to="/signup" className="mt-6 inline-block">
              <Button size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                Create Your Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Easycash Lending Company Inc. All rights reserved.</p>
          <p>Internal preview build - not yet live.</p>
        </div>
      </footer>
    </div>
  );
}
