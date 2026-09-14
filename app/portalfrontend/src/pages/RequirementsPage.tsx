import { Link } from 'react-router-dom';
import { Check, FileCheck2 } from 'lucide-react';
import { ChromaKeyImage } from '@/components/ChromaKeyImage';
import { Navbar } from '@/components/Navbar';
import { SiteFooter } from '@/components/SiteFooter';
import { Reveal } from '@/components/Reveal';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePageMeta } from '@/lib/usePageMeta';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { ELIGIBILITY_CRITERIA, getDocumentsForProduct } from '@/lib/loanRequirements';
import './landingMockupClone.css';

/** Decorative category labels, same pattern/reasoning as LandingPage's own PRODUCT_TAGS - paired
 * by index with LOAN_PRODUCTS, not a value from loanProducts.ts itself. */
/** Paired by index with LOAN_PRODUCTS - reordered 2026-09-10 to match that array's own reorder
 * (Seafarer first). */
const PRODUCT_TAGS = ['Overseas', 'Salary', 'Business'];

/** Same images as LandingPage's own STEP_IMAGES - see that file's doc comment. Kept in sync
 * manually since this page reuses `t.landing.steps` by reference, not by importing LandingPage's
 * constant. */
const STEP_IMAGES = ['./images/step-create-account.png', './images/step-apply-online.png', './images/step-track-status.png'];

/** Images for the "Before you apply" tips (2026-09-11 user request, "use this photos, use navy for
 * the animated photos") - paired by index with `t.requirements.prepTips` (valid ID / clear photos /
 * active contact info / loan amount+term). Replaces the earlier custom icon set (StepIcons.tsx). */
const PREP_IMAGES = ['./images/prep-valid-id.png', './images/prep-documents.png', './images/prep-contact.png', './images/prep-loan-amount.png'];

/** Only `prep-documents.png` has a genuinely flat solid-color background - keyed through
 * `ChromaKeyImage` exactly like the "Why borrow" section's REASON_IMAGES, so that background is
 * removed at runtime and the panel's own navy/lime gradient shows through instead. The other three
 * are full illustrated scenes (PH-flag/sun composition, a gradient studio backdrop, a UI
 * screenshot) rather than one flat color, so corner-sampled chroma-keying leaves visible background
 * behind - confirmed by checking the actual rendered page. Those render plain (`.step__img--plain`,
 * own background kept, full-bleed `cover`), the same treatment already used for STEP_IMAGES's
 * step-track-status.png. */
const PREP_CHROMA_KEY = [false, true, false, false];

/**
 * Public requirements page.
 *
 * The most common complaint about Philippine lending sites is spending twenty minutes on a form
 * only to discover a missing document. Publishing the checklist up front lets an applicant prepare
 * before they start, which raises completion rates and cuts support calls.
 *
 * Everything shown here is derived from `@/lib/loanRequirements` — the same definitions the
 * application form uses — so the two can never drift apart. See
 * `docs/PORTAL_WEBSITE_STRATEGY.md` §3.2.
 *
 * Page chrome (headings, notes, buttons) is translated; `ELIGIBILITY_CRITERIA`, loan product
 * names/details, and document names stay English - they're shared verbatim with the (untranslated)
 * application form, so translating them here only would make this page disagree with the form.
 *
 * 2026-09-10 (user request, "premium requirements page redesign"): rebuilt on the same editorial
 * design system the homepage's third redesign pass introduced (`.subhero`/`.reqcard`/`.doccard`/
 * `.reasons`/`.steps`/`.close` - see landingMockupClone.css §23-27), replacing the 2026-09-05
 * version's `.elig-grid`/`.doc-list`/`.mission`/`.tease` classes, which no longer exist in that
 * file after this session's homepage rewrites - this page had been silently unstyled since then.
 * New sections ("Before you apply", "Simple application process") reuse already-published content
 * (`t.requirements.prepTips`, `t.landing.steps`) rather than inventing new claims.
 */
export function RequirementsPage() {
  const { t, locale } = useLanguage();
  usePageMeta(t.requirements.title, t.requirements.intro);

  return (
    <div className="landing-mockup">
      <Navbar />
      <section className="subhero">
        <div className="subhero__wash" aria-hidden="true" />
        <div className="shell subhero__in">
          <div className="medallion">
            <FileCheck2 className="h-9 w-9" />
          </div>

          <p className="eyebrow">Application checklist</p>
          <h1>
            {locale === 'fil' ? (
              <>Alamin nang eksakto <em>kung ano ang ihahanda.</em></>
            ) : (
              <>Know exactly <em>what to prepare.</em></>
            )}
          </h1>
          <p className="lede">{t.requirements.intro}</p>
        </div>
      </section>

      {/* Who can apply */}
      <section className="section section--flush-top">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Eligibility</p>
            <h2>{t.requirements.whoCanApply}</h2>
            <p className="lede" style={{ marginTop: 12 }}>{t.requirements.eligibilityNote}</p>
          </Reveal>
          <Reveal>
            <div className="reqgrid">
              {ELIGIBILITY_CRITERIA.map((criterion) => (
                <div key={criterion} className="reqcard">
                  <span className="reqcard__ico">
                    <Check className="h-4 w-4" />
                  </span>
                  <p>{criterion}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Documents by loan type - 2026-09-11 (user request, "make this navy dominant"): the
          `docs-section` class scopes the on-navy text-color overrides in landingMockupClone.css;
          the doccards themselves deliberately stay on their own light surface (untouched) - light
          cards floating on a dark section, the same pattern the homepage's Loan Options section
          and "How it works" panels already use, rather than making every element uniformly dark. */}
      <section className="section section--glow-navy docs-section" style={{ background: 'linear-gradient(165deg, var(--navy-950), var(--navy-800))' }}>
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Requirements</p>
            <h2>{t.requirements.documentsHeading}</h2>
            <p className="lede" style={{ marginTop: 12 }}>{t.requirements.documentsIntro}</p>
          </Reveal>
          <Reveal>
            <div className="doccards">
              {LOAN_PRODUCTS.map((product, index) => {
                const { always, productSpecific } = getDocumentsForProduct(product.category);
                const totalCount = always.length + productSpecific.length;
                return (
                  <div key={product.category} className="doccard">
                    <span className="doccard__ghost" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div className="doccard__glow" aria-hidden="true" />
                    <div className="doccard__top">
                      <span className="doccard__ico">
                        <product.icon className="h-5 w-5" />
                      </span>
                      <span className="doccard__count">
                        <FileCheck2 className="h-3 w-3" /> {totalCount} documents
                      </span>
                    </div>
                    <span className="doccard__tag">{PRODUCT_TAGS[index]}</span>
                    <h3>{product.displayLabel}</h3>
                    {/* Deliberately .en - see this page's own doc comment: kept in sync with the
                        untranslated application form, not translated independently. */}
                    <p className="doccard__detail">{product.details.en}</p>
                    {/* maxAmount/ageRange: real published figures, not UI-convenience numbers - see
                        loanProducts.ts's own doc comment for the easycash.ph source. */}
                    <div className="doccard__meta">
                      <div>
                        <span className="doccard__meta-label">Up to</span>
                        <span className="doccard__meta-value">₱{product.maxAmount.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="doccard__meta-label">Ages</span>
                        <span className="doccard__meta-value">{product.ageRange}</span>
                      </div>
                    </div>
                    <div className="doccard__group">
                      <span className="doccard__group-label">{t.requirements.alwaysRequiredLabel}</span>
                      <div className="doccard__list">
                        {always.map((doc) => (
                          <div key={doc} className="doccard__item">
                            <Check className="h-[15px] w-[15px]" />
                            <span>{doc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {productSpecific.length > 0 && (
                      <div className="doccard__group">
                        <span className="doccard__group-label">{t.requirements.productSpecificLabel}</span>
                        <div className="doccard__list">
                          {productSpecific.map((doc) => (
                            <div key={doc} className="doccard__item">
                              <Check className="h-[15px] w-[15px]" />
                              <span>{doc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Reveal>
          <p style={{ marginTop: 28, textAlign: 'center', fontSize: '0.86rem', color: 'var(--on-navy-3)' }}>
            {t.requirements.coBorrowerNote}
          </p>
        </div>
      </section>

      {/* Before you apply */}
      <section className="section">
        <div className="shell">
          <Reveal>
            <p className="eyebrow">Preparation</p>
            <h2 style={{ maxWidth: '26ch' }}>{t.requirements.prepHeading}</h2>
            <p className="lede" style={{ marginTop: 12 }}>{t.requirements.prepIntro}</p>
          </Reveal>
          <div className="steps steps--illustrated steps--four">
            {t.requirements.prepTips.map((tip, index) => {
              const useChromaKey = PREP_CHROMA_KEY[index];
              return (
                <Reveal key={tip}>
                  <div className="step">
                    <div className={`step__img ${useChromaKey ? 'step__img--photo' : 'step__img--plain'}`}>
                      {useChromaKey ? (
                        <ChromaKeyImage src={PREP_IMAGES[index]} alt="" className="step__img-canvas" />
                      ) : (
                        <img src={PREP_IMAGES[index]} alt="" className="step__img-plain" />
                      )}
                      <span className="step__n">{index + 1}</span>
                    </div>
                    <p style={{ marginTop: 0 }}>{tip}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Simple application process - reuses the same steps already published on the homepage. */}
      <section className="section" style={{ background: 'var(--surface-2)' }}>
        <div className="shell">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2 style={{ maxWidth: '26ch' }}>{t.requirements.processHeading}</h2>
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

      {/* Close */}
      <section className="section close">
        <div className="shell close__in">
          <Reveal>
            <h2>{t.requirements.readyHeading}</h2>
          </Reveal>
          <Reveal>
            <p>{t.requirements.readyBody}</p>
          </Reveal>
          <Reveal>
            <div className="close__actions">
              <Link to="/signup" className="btn btn--lime btn--lg">
                {t.common.applyNow}
              </Link>
              <Link to="/login" className="tlink tlink--on-navy">
                {t.common.logIn}
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
