import * as React from 'react';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { estimateMonthlyPayment, estimateTotalRepayment } from '@/lib/loanEstimator';

const AMOUNT_MIN = 5_000;
const AMOUNT_STEP = 5_000;
const TERM_MIN = 1;
/** 2026-09-10 (user-confirmed business rule): Easycash does not offer installment terms beyond 12
 * months on any product - capped here (was 24) so the marketing calculator can never suggest a
 * term the company doesn't actually offer. */
const TERM_MAX = 12;

function peso(value: number): string {
  return `₱${Math.round(value).toLocaleString()}`;
}

/**
 * Loan Calculator (2026-07-30 user request, "polish like a trusted PH lending site" - Tala/
 * Cashalo/Digido-style amount+term slider are near-universal on this class of site, and this one
 * was conspicuously absent). Deliberately reuses the SAME real, verified flat-rate formula the
 * backend's pre-qualification service uses (see loanEstimator.ts's own doc comment) rather than
 * inventing a number - the eligibility widget next to this one drew that exact line for the same
 * reason (see EligibilityCheckWidget's doc comment: never fabricate a business rule).
 *
 * The amount slider's floor (₱5,000) is calculator UI convenience only - never presented as
 * Easycash's official minimum, which isn't published anywhere this codebase has verified. The
 * ceiling, though, now tracks each product's own real `maxAmount` (see loanProducts.ts's own doc
 * comment - CONFIRMED figures read off the live easycash.ph product pages, 2026-09-10), so
 * switching the loan type changes what the slider can reach. The term bound (max 12 months) IS a
 * confirmed real business rule (2026-09-10 user confirmation) - Easycash does not offer longer
 * installment terms.
 *
 * 2026-07-31 (user request/analysis): the REAL contractual rate actually used at loan booking
 * comes from the `interest_rate_chart` table (add-on rate × term -> a per-term contractual rate,
 * see backend's interest-rate-chart module) and from each `LoanProductVersion`'s own assigned
 * add-on rate - both vary per product AND per term length, unlike this widget's single flat 3%/
 * month approximation. That real chart isn't safe to fold into a public marketing widget (it needs
 * a specific product's assigned rate, which a not-yet-applying visitor hasn't chosen), so this
 * stays a simplified estimate - the disclaimer below says so explicitly.
 *
 * 2026-09-05: restyled to the approved landing-page mockup's `.widget-card`/`.calc-row`/`.calc-out`
 * look (only used on LandingPage, inside its `.landing-mockup` scope - see landingMockupClone.css).
 */
export function LoanCalculatorWidget() {
  const { t } = useLanguage();
  const [category, setCategory] = React.useState<string>(LOAN_PRODUCTS[0].category);
  const [amount, setAmount] = React.useState(50_000);
  const [termMonths, setTermMonths] = React.useState(12);

  const selectedProduct = LOAN_PRODUCTS.find((p) => p.category === category) ?? LOAN_PRODUCTS[0];
  const amountMax = selectedProduct.maxAmount;

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    // Switching to a product with a lower real ceiling than the current amount - pull the slider
    // back in rather than silently letting it sit past what that product actually offers.
    const nextMax = LOAN_PRODUCTS.find((p) => p.category === nextCategory)?.maxAmount ?? amountMax;
    setAmount((current) => Math.min(current, nextMax));
  };

  const monthlyPayment = estimateMonthlyPayment(amount, termMonths, category);
  const totalRepayment = estimateTotalRepayment(amount, termMonths, category);

  return (
    <div className="widget-card">
      <div className="widget-head">
        <span className="icon-sq">
          <Calculator className="h-4 w-4" />
        </span>
        <h3>{t.loanCalculator.title}</h3>
      </div>
      <p className="sub">{t.loanCalculator.subtitle}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <label htmlFor="calc-category" style={{ fontSize: '0.86rem', fontWeight: 600 }}>
            {t.loanCalculator.loanType}
          </label>
          <select
            id="calc-category"
            value={category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            style={{ marginTop: 6, width: '100%', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', padding: '8px 12px', fontSize: '0.86rem' }}
          >
            {LOAN_PRODUCTS.map((product) => (
              <option key={product.category} value={product.category}>
                {product.displayLabel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="calc-row">
            <label htmlFor="calc-amount">{t.loanCalculator.amountLabel}</label>
            <b style={{ color: 'var(--brand-navy)' }}>{peso(amount)}</b>
          </div>
          <input
            id="calc-amount"
            type="range"
            min={AMOUNT_MIN}
            max={amountMax}
            step={AMOUNT_STEP}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            style={{ marginTop: 8, width: '100%', accentColor: 'var(--brand-green)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
            <span>{peso(AMOUNT_MIN)}</span>
            <span>{peso(amountMax)}</span>
          </div>
        </div>

        <div>
          <div className="calc-row">
            <label htmlFor="calc-term">{t.loanCalculator.termLabel}</label>
            <b style={{ color: 'var(--brand-navy)' }}>{termMonths}</b>
          </div>
          <input
            id="calc-term"
            type="range"
            min={TERM_MIN}
            max={TERM_MAX}
            step={1}
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            style={{ marginTop: 8, width: '100%', accentColor: 'var(--brand-green)' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--ink-soft)' }}>
            <span>{TERM_MIN} month</span>
            <span>{TERM_MAX} months</span>
          </div>
        </div>
      </div>

      <div className="calc-out">
        <div>
          <span>{t.loanCalculator.monthlyPayment}</span>
          <b>{peso(monthlyPayment)}</b>
        </div>
        <div>
          <span>{t.loanCalculator.totalRepayment}</span>
          <b>{peso(totalRepayment)}</b>
        </div>
      </div>

      <Link to="/signup" className="glass-cta" style={{ marginTop: 20, display: 'block' }}>
        {t.landing.applyForThisLoan}
      </Link>

      <p style={{ marginTop: 16, fontSize: '0.74rem', lineHeight: 1.5, color: 'var(--ink-soft)' }}>{t.loanCalculator.disclaimer}</p>
    </div>
  );
}
