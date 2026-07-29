import { Link } from 'react-router-dom';
import { Info, Mail, Phone } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { COMPANY, FORMATTED_ADDRESS } from '@/lib/companyInfo';

/**
 * Complaints & escalation page.
 *
 * A published complaints channel is expected of an SEC-registered lending company, and the legacy
 * Easycash site carried a "File Complaint" page that this restores. It also gives borrowers the
 * lawful escalation path (the SEC) rather than leaving a dissatisfied client with nowhere to go.
 *
 * DELIBERATELY NOT STATED HERE: a response-time SLA (e.g. "we respond within X business days").
 * Management has not committed to one, and publishing an SLA the operations team cannot meet
 * creates an obligation Easycash would then be breaching. Add it here once it is formally
 * approved - see `docs/PORTAL_WEBSITE_STRATEGY.md` §7, open question 9.
 */

const WHAT_TO_INCLUDE = [
  'Your full name and the mobile number or email registered with your Easycash account',
  'Your loan or application reference number, if you have one',
  'A clear description of what happened, including dates',
  'The names or numbers of anyone you dealt with, if relevant',
  'Any screenshots, receipts, or documents that support your complaint',
  'What outcome you are asking for',
];

export function ComplaintsPage() {
  return (
    <PublicPageLayout
      title="File a Complaint"
      intro={`If something went wrong, we want to hear about it directly. ${COMPANY.shortName} takes every complaint seriously, and raising one will never affect how your loan is handled.`}
    >
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold tracking-tight">How to reach us</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">By phone</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li>{COMPANY.contact.landline}</li>
                <li>SMART: {COMPANY.contact.mobileSmart}</li>
                <li>GLOBE: {COMPANY.contact.mobileGlobe}</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5">
              <Mail className="h-5 w-5 text-primary" />
              <h3 className="mt-3 text-sm font-semibold">In writing</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <a href={`mailto:${COMPANY.contact.dpoEmail}`} className="hover:text-foreground">
                  {COMPANY.contact.dpoEmail}
                </a>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Or by mail to: {COMPANY.legalName}, {FORMATTED_ADDRESS}.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">What to include</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The more complete your complaint, the faster we can investigate it.
          </p>
          <ul className="mt-4 space-y-2.5">
            {WHAT_TO_INCLUDE.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <span className="text-sm leading-relaxed text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">Data privacy concerns</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If your concern is about how your personal information was collected, used, or shared,
            address it to our Data Protection Officer at{' '}
            <a
              href={`mailto:${COMPANY.contact.dpoEmail}`}
              className="font-semibold text-primary hover:underline"
            >
              {COMPANY.contact.dpoEmail}
            </a>
            . Your rights as a data subject are described in our{' '}
            <Link to="/privacy-policy" className="font-semibold text-primary hover:underline">
              Data Privacy Statement
            </Link>
            . You may also raise the matter with the National Privacy Commission.
          </p>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-bold">If we cannot resolve it</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {COMPANY.shortName} operates under a Certificate of Authority from the Securities
                and Exchange Commission. If your complaint remains unresolved after raising it with
                us, you may escalate it to the SEC, which supervises lending companies in the
                Philippines and maintains its own consumer assistance channel.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">Reporting a scam</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            If someone impersonating Easycash asked you for an advance fee, an OTP, or a payment to
            a personal account, report it through any channel above and read our{' '}
            <Link to="/security-tips" className="font-semibold text-primary hover:underline">
              Security &amp; Anti-Scam guide
            </Link>{' '}
            to confirm which channels are genuinely ours.
          </p>
        </section>
      </div>
    </PublicPageLayout>
  );
}
