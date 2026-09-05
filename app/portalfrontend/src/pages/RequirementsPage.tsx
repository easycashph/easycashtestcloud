import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePageMeta } from '@/lib/usePageMeta';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { ADDITIONAL_REQUIREMENTS_NOTES, ELIGIBILITY_CRITERIA, getDocumentsForProduct } from '@/lib/loanRequirements';
import '@/pages/landingMockupClone.css';

/** Decorative category labels, same pattern/reasoning as LandingPage's own PRODUCT_TAGS - paired
 * by index with LOAN_PRODUCTS, not a value from loanProducts.ts itself. */
const PRODUCT_TAGS = ['Business', 'Everyday', 'Overseas'];

/**
 * Public requirements page.
 *
 * The most common complaint about Philippine lending sites is spending twenty minutes on a form
 * only to discover a missing document. Publishing the checklist up front lets an applicant prepare
 * before they start, which raises completion rates and cuts support calls.
 *
 * Everything shown here is derived from `@/lib/loanRequirements` — the same definitions the
 * application form uses — so the two can never drift apart (except `ADDITIONAL_REQUIREMENTS_NOTES`,
 * deliberately kept separate - see that constant's own doc comment). See
 * `docs/PORTAL_WEBSITE_STRATEGY.md` §3.2.
 *
 * Page chrome (headings, notes, buttons) is translated; `ELIGIBILITY_CRITERIA`, loan product
 * names/details, and document names stay English - they're shared verbatim with the (untranslated)
 * application form, so translating them here only would make this page disagree with the form.
 *
 * 2026-09-05 (user request, "high end, advance layout design", mockup-approved): redesigned from
 * the plain `PublicPageLayout` shell (which every other standalone page - Privacy, Terms,
 * Complaints - still uses) to the landing page's own glassmorphism look, since this page benefits
 * from the same "browse products" visual treatment the landing page's Products section already
 * established. Not using `PublicPageLayout` here, but keeping its two real obligations: the "back
 * to home" link and the real `SiteFooter` (required on every public page - see that component's
 * own doc comment).
 */
export function RequirementsPage() {
  const { t } = useLanguage();
  usePageMeta(t.requirements.title, t.requirements.intro);

  return (
    <div className="landing-mockup">
      <div className="page">
        <div className="mesh" />
        <div className="wrap">
          <div style={{ paddingTop: 24 }}>
            <Link
              to="/"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', fontWeight: 600, color: 'var(--ink-soft)', textDecoration: 'none' }}
            >
              <ArrowLeft className="h-4 w-4" /> {t.common.backToHome}
            </Link>
          </div>

          <div style={{ padding: '40px 0 20px', textAlign: 'center' }}>
            <span className="eyebrow">Application checklist</span>
            <h1 className="display" style={{ margin: '20px auto 14px', maxWidth: '20ch', fontSize: 'clamp(2rem, 3.6vw, 2.9rem)' }}>
              {t.requirements.title}
            </h1>
            <p className="lede" style={{ margin: '0 auto' }}>
              {t.requirements.intro}
            </p>
          </div>
        </div>
      </div>

      <section className="mission" style={{ padding: '10px 0 40px' }}>
        <div className="wrap">
          <h2 style={{ fontSize: '1.9rem' }}>{t.requirements.whoCanApply}</h2>
          <p style={{ maxWidth: '52ch' }}>{t.requirements.eligibilityNote}</p>
          <div className="elig-grid" style={{ marginTop: 28, textAlign: 'left' }}>
            {ELIGIBILITY_CRITERIA.map((criterion) => (
              <div key={criterion} className="elig-card">
                <div className="ico">
                  <Check className="h-4 w-4" />
                </div>
                <p>{criterion}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="products" style={{ padding: '0 0 60px' }}>
        <div className="wrap">
          <div className="section-head" style={{ alignItems: 'center', textAlign: 'center', flexDirection: 'column' }}>
            <h2>{t.requirements.documentsHeading}</h2>
            <p style={{ margin: '8px auto 0' }}>{t.requirements.documentsIntro}</p>
          </div>
          <div className="product-row" style={{ marginTop: 34 }}>
            {LOAN_PRODUCTS.map((product, index) => {
              const { always, productSpecific } = getDocumentsForProduct(product.category);
              const additionalNotes = ADDITIONAL_REQUIREMENTS_NOTES[product.category] ?? [];
              return (
                <div key={product.category} className={`product-card ${index === 1 ? 'navy' : ''}`}>
                  <div className="glow" />
                  <div className="product-tag">{PRODUCT_TAGS[index]}</div>
                  <h3>{product.displayLabel}</h3>
                  {/* Deliberately .en - see this page's own doc comment: kept in sync with the
                      untranslated application form, not translated independently. */}
                  <p style={{ marginBottom: 18 }}>{product.details.en}</p>
                  <div className="doc-list">
                    {always.map((doc) => (
                      <div key={doc} className="doc-item">
                        <Check className="h-[15px] w-[15px]" />
                        <span>{doc}</span>
                      </div>
                    ))}
                    {productSpecific.map((doc) => (
                      <div key={doc} className="doc-item">
                        <Check className="h-[15px] w-[15px]" />
                        <span>{doc}</span>
                      </div>
                    ))}
                    {additionalNotes.map((doc) => (
                      <div key={doc} className="doc-item new">
                        <Check className="h-[15px] w-[15px]" />
                        <span>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: 24, textAlign: 'center', fontSize: '0.86rem', color: 'var(--ink-soft)' }}>{t.requirements.coBorrowerNote}</p>
        </div>
      </section>

      <footer className="tease">
        <div className="wrap">
          <div className="footer-card">
            <h3 style={{ position: 'relative', zIndex: 1 }}>{t.requirements.readyHeading}</h3>
            <p style={{ position: 'relative', zIndex: 1 }}>{t.requirements.readyBody}</p>
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
              <Link to="/signup" className="btn-solid">
                {t.common.applyNow}
              </Link>
              <Link to="/login" className="btn-ghost" style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', borderColor: 'rgba(255,255,255,0.25)' }}>
                {t.common.logIn}
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <SiteFooter />
    </div>
  );
}
