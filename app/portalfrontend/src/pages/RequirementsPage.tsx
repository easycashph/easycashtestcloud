import { Link } from 'react-router-dom';
import { FileCheck2 } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { ADDITIONAL_REQUIREMENTS_NOTES, ELIGIBILITY_CRITERIA, getDocumentsForProduct } from '@/lib/loanRequirements';

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
 */
export function RequirementsPage() {
  const { t } = useLanguage();

  return (
    <PublicPageLayout title={t.requirements.title} intro={t.requirements.intro}>
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.requirements.whoCanApply}</h2>
          <ul className="mt-4 space-y-2.5">
            {ELIGIBILITY_CRITERIA.map((criterion) => (
              <li key={criterion} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <FileCheck2 className="h-3 w-3" />
                </div>
                <span className="text-sm leading-relaxed text-muted-foreground">{criterion}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.requirements.eligibilityNote}</p>
        </section>

        <section>
          <h2 className="text-lg font-bold tracking-tight">{t.requirements.documentsHeading}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.requirements.documentsIntro}</p>

          <div className="mt-4 space-y-4">
            {LOAN_PRODUCTS.map((product) => {
              const { always, productSpecific } = getDocumentsForProduct(product.category);
              const additionalNotes = ADDITIONAL_REQUIREMENTS_NOTES[product.category] ?? [];
              return (
                <div key={product.category} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <product.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold">{product.displayLabel}</h3>
                  </div>
                  {/* Deliberately .en - see this page's own doc comment: kept in sync with the
                      untranslated application form, not translated independently. */}
                  <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                    {product.details.en}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {[...always, ...productSpecific, ...additionalNotes].map((document) => (
                      <li key={document} className="flex items-start gap-3">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        <span className="text-sm text-muted-foreground">{document}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t.requirements.coBorrowerNote}</p>
        </section>

        <section className="rounded-2xl border border-border bg-secondary/40 p-5">
          <h2 className="text-sm font-bold">{t.requirements.readyHeading}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.requirements.readyBody}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to="/signup">
              <Button size="sm">{t.common.applyNow}</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" variant="outline">
                {t.common.logIn}
              </Button>
            </Link>
          </div>
        </section>
      </div>
    </PublicPageLayout>
  );
}
