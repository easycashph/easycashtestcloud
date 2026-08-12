import * as React from 'react';
import { Link } from 'react-router-dom';
import { Calculator } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { LOAN_PRODUCTS } from '@/lib/loanProducts';
import { estimateMonthlyPayment, estimateTotalRepayment } from '@/lib/loanEstimator';

const AMOUNT_MIN = 5_000;
const AMOUNT_MAX = 200_000;
const AMOUNT_STEP = 5_000;
const TERM_MIN = 1;
const TERM_MAX = 24;

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
 * The slider/term bounds below (₱5,000-200,000, 1-24 months) are calculator UI convenience only -
 * never presented as Easycash's official minimum/maximum loan amount or term, which aren't
 * published anywhere this codebase has verified.
 *
 * 2026-07-31 (user request/analysis): the REAL contractual rate actually used at loan booking
 * comes from the `interest_rate_chart` table (add-on rate × term -> a per-term contractual rate,
 * see backend's interest-rate-chart module) and from each `LoanProductVersion`'s own assigned
 * add-on rate - both vary per product AND per term length, unlike this widget's single flat 3%/
 * month approximation. That real chart isn't safe to fold into a public marketing widget (it needs
 * a specific product's assigned rate, which a not-yet-applying visitor hasn't chosen), so this
 * stays a simplified estimate - the disclaimer below says so explicitly.
 */
export function LoanCalculatorWidget() {
  const { t } = useLanguage();
  const [category, setCategory] = React.useState<string>(LOAN_PRODUCTS[0].category);
  const [amount, setAmount] = React.useState(50_000);
  const [termMonths, setTermMonths] = React.useState(12);

  const monthlyPayment = estimateMonthlyPayment(amount, termMonths, category);
  const totalRepayment = estimateTotalRepayment(amount, termMonths, category);

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{t.loanCalculator.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.loanCalculator.subtitle}</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="calc-category" className="text-sm font-medium">
            {t.loanCalculator.loanType}
          </label>
          <select
            id="calc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {LOAN_PRODUCTS.map((product) => (
              <option key={product.category} value={product.category}>
                {product.displayLabel}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="calc-amount" className="text-sm font-medium">
              {t.loanCalculator.amountLabel}
            </label>
            <span className="text-sm font-semibold text-primary">{peso(amount)}</span>
          </div>
          <input
            id="calc-amount"
            type="range"
            min={AMOUNT_MIN}
            max={AMOUNT_MAX}
            step={AMOUNT_STEP}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{peso(AMOUNT_MIN)}</span>
            <span>{peso(AMOUNT_MAX)}</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="calc-term" className="text-sm font-medium">
              {t.loanCalculator.termLabel}
            </label>
            <span className="text-sm font-semibold text-primary">{termMonths}</span>
          </div>
          <input
            id="calc-term"
            type="range"
            min={TERM_MIN}
            max={TERM_MAX}
            step={1}
            value={termMonths}
            onChange={(e) => setTermMonths(Number(e.target.value))}
            className="mt-2 w-full accent-primary"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{TERM_MIN} month</span>
            <span>{TERM_MAX} months</span>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl bg-secondary/50 p-4">
        <div>
          <p className="text-xs text-muted-foreground">{t.loanCalculator.monthlyPayment}</p>
          <p className="mt-1 text-lg font-bold text-primary sm:text-xl">{peso(monthlyPayment)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t.loanCalculator.totalRepayment}</p>
          <p className="mt-1 text-lg font-bold sm:text-xl">{peso(totalRepayment)}</p>
        </div>
      </div>

      <Link to="/signup" className="mt-5 block">
        <Button className="w-full">{t.landing.applyForThisLoan}</Button>
      </Link>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.loanCalculator.disclaimer}</p>
    </div>
  );
}
