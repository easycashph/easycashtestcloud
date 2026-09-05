import * as React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, HelpCircle, RotateCcw, XCircle } from 'lucide-react';
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
 *
 * 2026-09-05: restyled to the approved landing-page mockup's `.widget-card` look (only used on
 * LandingPage, inside its `.landing-mockup` scope - see landingMockupClone.css). Plain inline
 * styles/`.yn`/result-state classes here instead of Tailwind, matching the mockup's own markup.
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
    <div className="widget-card">
      <div className="widget-head">
        <span className="icon-sq">
          <HelpCircle className="h-4 w-4" />
        </span>
        <h3>{t.eligibilityCheck.title}</h3>
      </div>
      <p className="sub">{t.eligibilityCheck.subtitle}</p>

      {questions.map((question, index) => (
        <div key={question} className="q-row">
          <span>{question}</span>
          <div className="yn" role="group" aria-label={question}>
            <button type="button" onClick={() => setAnswer(index, true)} aria-pressed={answers[index] === true} className={answers[index] === true ? 'active' : ''}>
              {t.eligibilityCheck.yes}
            </button>
            <button type="button" onClick={() => setAnswer(index, false)} aria-pressed={answers[index] === false} className={answers[index] === false ? 'active' : ''}>
              {t.eligibilityCheck.no}
            </button>
          </div>
        </div>
      ))}

      {!submitted && (
        <button type="button" className="glass-cta" disabled={!allAnswered} style={{ cursor: allAnswered ? 'pointer' : 'not-allowed', marginTop: 'auto' }} onClick={() => setSubmitted(true)}>
          {t.eligibilityCheck.checkButton}
        </button>
      )}

      {submitted && (
        <div
          role="status"
          style={{
            marginTop: 18,
            borderRadius: 14,
            border: `1px solid ${allYes ? 'rgba(76,175,80,0.4)' : 'rgba(245,158,11,0.4)'}`,
            background: allYes ? 'rgba(76,175,80,0.1)' : 'rgba(245,158,11,0.1)',
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {allYes ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#4caf50' }} />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" style={{ color: '#b45309' }} />
            )}
            <div>
              <p style={{ fontSize: '0.86rem', fontWeight: 700, margin: 0, color: allYes ? '#2e7d32' : '#92400e' }}>
                {allYes ? t.eligibilityCheck.resultPassTitle : t.eligibilityCheck.resultFailTitle}
              </p>
              <p style={{ marginTop: 4, fontSize: '0.86rem', lineHeight: 1.5, color: allYes ? '#2e7d32' : '#92400e' }}>
                {allYes ? t.eligibilityCheck.resultPassBody : t.eligibilityCheck.resultFailBody}
              </p>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
                {allYes ? (
                  <Link to="/signup" className="btn-solid" style={{ padding: '8px 16px', fontSize: '0.78rem' }}>
                    {t.common.applyNow}
                  </Link>
                ) : (
                  <Link to="/contact" className="btn-ghost" style={{ padding: '8px 16px', fontSize: '0.78rem' }}>
                    {t.footer.contactPageLink}
                  </Link>
                )}
                <button type="button" onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 600, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <RotateCcw className="h-3 w-3" />
                  {t.eligibilityCheck.startOver}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p style={{ marginTop: 16, fontSize: '0.74rem', lineHeight: 1.5, color: 'var(--ink-soft)' }}>{t.eligibilityCheck.disclaimer}</p>
    </div>
  );
}
