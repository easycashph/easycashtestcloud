import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Basic Eligibility Self-Check.
 *
 * Deliberately narrower than a full "pre-qualification" tool: it only checks the 4 eligibility
 * facts Easycash has actually published (`ELIGIBILITY_CRITERIA` in loanRequirements.ts - same
 * source the Requirements page reads from). It does NOT estimate a loan amount or approval odds -
 * that would need a real income-to-amount formula, which is not confirmed anywhere and would be
 * fabricating a business rule (see CLAUDE.md: "Never invent business rules"). If/when management
 * confirms a formula, this can grow into that; until then, a narrower-but-honest tool beats a
 * wider-but-invented one.
 *
 * Entirely client-side - no network request, nothing stored or transmitted anywhere. This is a
 * deliberate privacy choice, not just a shortcut: a visitor answering "am I even eligible" hasn't
 * decided to apply yet and shouldn't have to hand over data to find out.
 */
type Answer = boolean | null;

export function EligibilityCheckWidget() {
  const { t } = useLanguage();
  const questions = t.eligibilityCheck.questions;

  const [answers, setAnswers] = React.useState<Answer[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = React.useState(false);

  const allAnswered = answers.every((a) => a !== null);
  const allYes = answers.every((a) => a === true);

  const setAnswer = (index: number, value: boolean) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
    // Answering after already seeing a result starts a fresh check, rather than leaving a stale
    // pass/fail banner showing above changed answers.
    if (submitted) setSubmitted(false);
  };

  const reset = () => {
    setAnswers(questions.map(() => null));
    setSubmitted(false);
  };

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HelpCircle className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{t.eligibilityCheck.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t.eligibilityCheck.subtitle}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {questions.map((question, index) => (
          <div key={question} className="flex items-center justify-between gap-4">
            <span className="text-sm">{question}</span>
            <div className="flex shrink-0 gap-1.5" role="group" aria-label={question}>
              <button
                type="button"
                onClick={() => setAnswer(index, true)}
                aria-pressed={answers[index] === true}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  answers[index] === true
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.eligibilityCheck.yes}
              </button>
              <button
                type="button"
                onClick={() => setAnswer(index, false)}
                aria-pressed={answers[index] === false}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  answers[index] === false
                    ? 'bg-secondary text-foreground'
                    : 'border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.eligibilityCheck.no}
              </button>
            </div>
          </div>
        ))}
      </div>

      {!submitted && (
        <Button className="mt-6 w-full" disabled={!allAnswered} onClick={() => setSubmitted(true)}>
          {t.eligibilityCheck.checkButton}
        </Button>
      )}

      {submitted && (
        <div
          role="status"
          className={`mt-6 rounded-xl border p-4 ${
            allYes
              ? 'border-success/40 bg-success/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <div className="flex items-start gap-3">
            {allYes ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            )}
            <div>
              <p className={`text-sm font-semibold ${allYes ? 'text-success' : 'text-amber-900 dark:text-amber-200'}`}>
                {allYes ? t.eligibilityCheck.resultPassTitle : t.eligibilityCheck.resultFailTitle}
              </p>
              <p className={`mt-1 text-sm leading-relaxed ${allYes ? 'text-success/90' : 'text-amber-900/80 dark:text-amber-200/80'}`}>
                {allYes ? t.eligibilityCheck.resultPassBody : t.eligibilityCheck.resultFailBody}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {allYes ? (
                  <Link to="/signup">
                    <Button size="sm">{t.common.applyNow}</Button>
                  </Link>
                ) : (
                  <Link to="/contact">
                    <Button size="sm" variant="outline">
                      {t.footer.contactPageLink}
                    </Button>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  {t.eligibilityCheck.startOver}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.eligibilityCheck.disclaimer}</p>
    </div>
  );
}
