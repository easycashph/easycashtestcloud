import { Link } from 'react-router-dom';
import { AlertTriangle, Check, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { FaqAccordionItem } from '@/components/FaqAccordionItem';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { Reveal } from '@/components/Reveal';
import { COMPANY, OFFICIAL_CHANNELS } from '@/lib/companyInfo';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePageMeta } from '@/lib/usePageMeta';
import './landingMockupClone.css';

/** Groups the 7 flat `t.securityTips.protect` tips into 3 thematic clusters for the redesigned
 * "How to protect yourself" section (2026-09-10 art-direction pass) - purely a presentational
 * regrouping via array indices, not a change to the underlying content; `titleIndex` points into
 * `t.securityTips.protectGroups`. Keep in sync with `protect`/`protectGroups` if either changes. */
const PROTECT_GROUPS: { titleIndex: number; indices: number[] }[] = [
  { titleIndex: 0, indices: [0, 1] },
  { titleIndex: 1, indices: [2, 3, 4] },
  { titleIndex: 2, indices: [5, 6] },
];

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
 *
 * 2026-09-10 (user request, "premium security page redesign, communicate trust immediately"):
 * rebuilt on the same editorial design system as the redesigned Requirements page - a branded
 * `.subhero` with a shield medallion, `.infolist`/`.infocard` rows (replacing the old plain
 * `rounded-2xl border` divs), and a new FAQ accordion (`.faq-item`, shared with the homepage) built
 * from `t.securityTips.faq` - composed entirely from facts already published elsewhere on this same
 * page (the no-advance-fee policy, OTP policy, SEC registration), not new claims. Previously used
 * the generic `PublicPageLayout` shell (plain Tailwind, no visual distinction from Terms/Privacy);
 * now stands on its own like the Requirements page, since a security/trust page benefits from the
 * same stronger visual treatment. Every fact, figure, and channel value is unchanged from the
 * previous version - this is a presentation change only.
 */
export function SecurityTipsPage() {
  const { t } = useLanguage();
  usePageMeta(t.securityTips.title, t.securityTips.intro);

  return (
    <div className="landing-mockup">
      <Navbar />
      <section className="subhero">
        <div className="subhero__wash" aria-hidden="true" />
        <div className="shell subhero__in">
          <div className="medallion">
            <ShieldCheck className="h-9 w-9" />
          </div>

          <p className="eyebrow">Security &amp; Anti-Scam</p>
          <h1>{t.securityTips.title}</h1>
          <p className="lede">{t.securityTips.intro}</p>

          <div className="subhero__trust">
            <span className="trust-chip">
              <ShieldCheck className="h-3.5 w-3.5" /> SEC-registered lending company
            </span>
            <span className="trust-chip">
              <CheckCircle2 className="h-3.5 w-3.5" /> Never asks for a fee before releasing your loan
            </span>
          </div>
        </div>
      </section>

      {/* The single most important message on the page - given its own dramatic banner treatment. */}
      <section className="section section--flush-top">
        <div className="shell">
          <Reveal>
            <div className="alert-banner">
              <span className="alert-banner__ico">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div>
                <h2>{t.securityTips.alertTitle}</h2>
                <p>{t.securityTips.alertBody}</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* What Easycash will never do */}
      <section className="section section--glow-navy" style={{ background: 'var(--surface-2)' }}>
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Know the red flags</p>
            <h2 style={{ maxWidth: '28ch' }}>{t.securityTips.neverDoesHeading}</h2>
          </Reveal>
          <div className="infolist infolist--severity">
            <Reveal>
              <div className="infocard infocard--spotlight">
                <span className="infocard__ico infocard__ico--bad">
                  <X className="h-6 w-6" />
                </span>
                <div>
                  <h3>{t.securityTips.neverDoes[0].title}</h3>
                  <p>{t.securityTips.neverDoes[0].body}</p>
                </div>
              </div>
            </Reveal>
            <div className="infogrid">
              {t.securityTips.neverDoes.slice(1).map((item) => (
                <Reveal key={item.title}>
                  <div className="infocard">
                    <span className="infocard__ico infocard__ico--bad">
                      <X className="h-4 w-4" />
                    </span>
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Official channels */}
      <section className="section">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Verified contact</p>
            <h2>{t.securityTips.channelsHeading}</h2>
            <p className="lede" style={{ marginTop: 12 }}>{t.securityTips.channelsIntro}</p>
          </Reveal>
          <Reveal>
            <div className="widget-card" style={{ maxWidth: 640, marginTop: 32 }}>
              <dl style={{ display: 'grid', gap: 14, margin: 0 }}>
                {OFFICIAL_CHANNELS.map((channel) => (
                  <div key={channel.label} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <dt style={{ fontSize: '0.86rem', color: 'var(--ink-3)' }}>{channel.label}</dt>
                    <dd style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700 }}>{channel.value}</dd>
                  </div>
                ))}
              </dl>
              <p style={{ marginTop: 20, borderTop: '1px solid var(--hairline)', paddingTop: 16, fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--ink-3)' }}>
                {t.securityTips.registeredOffice}: {COMPANY.address.line1}, {COMPANY.address.line2}, {COMPANY.address.city}.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How to protect yourself */}
      <section className="section section--glow-lime" style={{ background: 'var(--surface-2)' }}>
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Stay protected</p>
            <h2 style={{ maxWidth: '26ch' }}>{t.securityTips.protectHeading}</h2>
          </Reveal>
          <div className="infoclusters">
            {PROTECT_GROUPS.map((group, groupIndex) => (
              <Reveal key={group.titleIndex}>
                <div className="infocluster">
                  <div className="infocluster__head">
                    <span className="infocluster__n">{String(groupIndex + 1).padStart(2, '0')}</span>
                    <p className="infocluster__title">{t.securityTips.protectGroups[group.titleIndex]}</p>
                  </div>
                  <div className="infocluster__list">
                    {group.indices.map((tipIndex) => {
                      const tip = t.securityTips.protect[tipIndex];
                      return (
                        <div key={tip} className="infocluster__item">
                          <Check className="h-[13px] w-[13px]" />
                          <span>
                            {tip}
                            {/* The "check our registration" tip (index 1 in the full protect
                                array) is the one place on the whole site that tells a visitor to
                                independently verify Easycash with the SEC - giving it an actual
                                link, not just prose, is what makes it actionable. */}
                            {tipIndex === 1 && (
                              <>
                                {' '}
                                <a
                                  href="https://www.sec.gov.ph"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontWeight: 700, color: 'var(--navy)' }}
                                >
                                  sec.gov.ph
                                </a>
                                .
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="shell">
          <div className="faq__grid">
            <Reveal>
              <p className="eyebrow">FAQ</p>
              <h2>{t.securityTips.faqHeading}</h2>
            </Reveal>
            <Reveal>
              <div>
                {t.securityTips.faq.map((item) => (
                  <FaqAccordionItem key={item.question} question={item.question} answer={item.answer} />
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Targeted? report it. */}
      <section className="section section--flush-top" style={{ paddingBottom: 'clamp(3rem, 1rem + 5vw, 6rem)' }}>
        <div className="shell">
          <Reveal>
            <div className="widget-card" style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
              <span className="icon-sq" style={{ background: 'linear-gradient(135deg, var(--navy), var(--lime))' }}>
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <h3 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>{t.securityTips.targetedHeading}</h3>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--ink-2)' }}>
                  {t.securityTips.targetedBody.split('{complaintsLink}')[0]}
                  <Link to="/complaints" style={{ fontWeight: 700, color: 'var(--navy)' }}>
                    {t.securityTips.targetedLinkText}
                  </Link>
                  {t.securityTips.targetedBody.split('{complaintsLink}')[1]}
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
