import { Link } from 'react-router-dom';
import { AlertTriangle, Check, ShieldCheck, X } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { COMPANY, OFFICIAL_CHANNELS } from '@/lib/companyInfo';

/**
 * Security & Anti-Scam page.
 *
 * Purpose is protective, not promotional. Online lending scams in the Philippines routinely
 * impersonate SEC-registered lenders: the fraudster asks for an "advance processing fee" before
 * release, or phishes an OTP. Publishing an unambiguous list of what Easycash will never do, plus
 * the definitive list of official channels, gives a borrower a way to check a suspicious message
 * against the real thing.
 *
 * Every claim here must stay true operationally. If Easycash ever legitimately needs to do one of
 * the things listed under "never", this page must change first.
 */

const NEVER_DOES = [
  {
    title: 'Ask for a fee before releasing your loan',
    body: 'Easycash never requires an advance payment, "processing fee", "insurance fee", or "release fee" sent to a personal GCash, Maya, or bank account before your loan proceeds are released. Any deductible fees are disclosed in your loan documents and taken from the proceeds - never collected separately in advance.',
  },
  {
    title: 'Ask for your OTP, password, or PIN',
    body: 'No Easycash employee will ever ask for your one-time PIN, your portal password, your card PIN, or your online banking credentials - not by call, text, email, or chat. An OTP is for you alone to enter.',
  },
  {
    title: 'Ask you to pay through a personal account',
    body: 'Payments are only accepted through official Easycash channels under the company name. Never send money to an individual person\'s account, even if they claim to be an Easycash agent or collector.',
  },
  {
    title: 'Access your phone contacts or photo gallery',
    body: 'Easycash does not harvest your contact list or your photos, and does not contact your family, friends, or employer to shame you over a debt. Any lender doing this is violating the Data Privacy Act of 2012 and SEC rules on unfair debt collection.',
  },
  {
    title: 'Threaten, harass, or publicly shame you',
    body: 'Collection is conducted lawfully and respectfully. Threats of arrest, public exposure, or messages to your contacts are not Easycash practices - report them to us immediately.',
  },
];

const PROTECT_YOURSELF = [
  'Verify the sender. Compare any number or email against our official channels listed above before you reply.',
  'Check our registration. Easycash is registered with the SEC - you can verify our company name and registration on the SEC\'s official website.',
  'Never share an OTP. Treat it like cash: once it is out, it is gone.',
  'Use a strong, unique password for your Easycash Portal account, and never reuse it on other sites.',
  'Log in only through this portal. Do not enter your credentials into a link sent by text or chat - open the site yourself.',
  'Keep your contact details current so we can reach you through the right channel.',
  'Read before you sign. Your disclosure statement shows the full cost of your loan.',
];

export function SecurityTipsPage() {
  return (
    <PublicPageLayout
      title="Security & Anti-Scam"
      intro={`Scammers impersonate legitimate lending companies, including ${COMPANY.shortName}. This page tells you exactly what we will never do, so you can recognise a fake immediately.`}
    >
      <div className="space-y-8">
        {/* The single most important message on the page - given visual priority. */}
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                If someone asks you to pay a fee before your loan is released, it is a scam.
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                This is the most common scam used against borrowers in the Philippines. Stop, do not
                send money, and report it to us using the channels below.
              </p>
            </div>
          </div>
        </div>

        <section>
          <h2 className="text-lg font-bold tracking-tight">What Easycash will never do</h2>
          <div className="mt-4 space-y-3">
            {NEVER_DOES.map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                    <X className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">Our official channels</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            These are the only channels Easycash uses. If a message comes from anywhere else, treat
            it as suspicious.
          </p>
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <dl className="space-y-3">
              {OFFICIAL_CHANNELS.map((channel) => (
                <div key={channel.label} className="flex flex-wrap items-baseline justify-between gap-2">
                  <dt className="text-sm text-muted-foreground">{channel.label}</dt>
                  <dd className="text-sm font-semibold">{channel.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              Registered office: {COMPANY.address.line1}, {COMPANY.address.line2},{' '}
              {COMPANY.address.city}.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">How to protect yourself</h2>
          <ul className="mt-4 space-y-2.5">
            {PROTECT_YOURSELF.map((tip) => (
              <li key={tip} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Check className="h-3 w-3" />
                </div>
                <span className="text-sm leading-relaxed text-muted-foreground">{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">Think you have been targeted?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Report it to us right away so we can warn other borrowers - even if you did not lose
                money. Contact us through any official channel above, or{' '}
                <Link to="/complaints" className="font-semibold text-primary hover:underline">
                  file a formal complaint
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </PublicPageLayout>
  );
}
