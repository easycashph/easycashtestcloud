# Session Log — 2026-09-12 — Loan Application DTI/Risk Backfill

**Machine:** Office Server PC
**Requested by:** Nomer Perez

## Summary

Follow-up to pulling in the Loan Application Risk Assessment feature (DTI/risk tier,
`docs/INTERNAL_CREDIT_SCORE.md`) from another machine earlier the same day. User asked to apply
DTI and Risk to the existing test accounts under Loan Applications, plus asked about Decision
Status and whether the Internal Credit Score is properly aligned.

## Why a backfill was needed

`dtiPercent`/`riskTier` only get computed at two points in normal flow:
`CreateLoanApplicationUseCase` (new applications) and
`RecheckLoanApplicationDocumentCompletenessUseCase` (INCOMPLETE → PREAPPROVED/PREDECLINED once
required documents are all uploaded). Every application that existed before the feature shipped,
or that had already moved past INCOMPLETE, had no path to ever get these two fields populated —
neither of the domain's transition methods that touch these fields
(`applySystemClassification`, `completeDocuments`) fit a pure backfill without also changing
`status`.

## What was built and applied

`scripts/scratch-backfill-loan-application-risk.ts` (committed `090f93b2`) — reuses the feature's
own pure functions (`computeFlatRateAmortization` + `assessLoanApplicationRisk`), writes only
`dtiPercent`/`riskTier`, never touches `status`. Applied against the 5 existing test loan
applications:

| Applicant | Status | Result |
|---|---|---|
| Test DELA CRUZ Applicant | UNDER_REVIEW | DTI 11.3%, LOW |
| TEST6NOMER... | INCOMPLETE | DTI 7.9%, LOW |
| TEST2NOMER... | INCOMPLETE | DTI 19.7%, LOW |
| NOMER DELA CRUZ PEREZ | UNDER_REVIEW | Skipped — no `monthlyIncome` on record, can't compute (not defaulted to anything, per CLAUDE.md's "never fabricate financial logic") |
| ALDWIN JALA MANIWANG | PREDECLINED | Skipped — same reason |

**Scope confirmed with the user before running**: asked explicitly whether "Decision Status"
(PREAPPROVED/PREDECLINED) should also be backfilled. User chose the safe option — only recompute
it for applications currently INCOMPLETE, matching real production behavior, rather than force-
resetting UNDER_REVIEW/PREDECLINED/APPROVED applications' already-made decisions. In the end
**no Decision Status changes were applied at all**: both INCOMPLETE test applications (TEST6NOMER,
TEST2NOMER) genuinely lack complete categorized required documents (TEST6NOMER has zero
attachments; TEST2NOMER has one attachment but with no `documentCategory` set), so the real
`isDocumentComplete` check would correctly still return false for either — nothing to compute yet.

## A red herring mid-task (not a bug)

TEST2NOMER's status was seen as `APPROVED` in an earlier query, then `INCOMPLETE` moments later —
looked like a bug at first. Traced via `audit_logs` (`REVERT_LOAN_APPLICATION_DECISION` action,
`previousValue.status: "APPROVED"` → `newValue.status: "INCOMPLETE"`, timestamped 13:04:08): the
user had used the also-newly-pulled "Revert Decision" feature on this same test application
concurrently, in the LMS UI, while this backfill was being investigated. Confirmed with the user
directly ("ni-revert ko kasi kaya naging incomplete"). Worth remembering that concurrent human
activity on a live system can look like a data bug mid-investigation — audit_logs
(`previousValue`/`newValue` jsonb columns) resolved it in under a minute.

## Other questions answered this session

- **"pareho na ba sila ng Macbook Nomer?"** — code: not yet fully in sync (Office Server PC was 3
  commits ahead of what Macbook Nomer last pulled, all docs/build-info); DB: never in sync by
  design — each machine has its own separate Postgres database, so this backfill only affects
  Office Server PC's own test data. Macbook Nomer would need the same script run there separately
  if they want their own test data backfilled too.
- **"tama na rin ba ang Internal credit score? align na ba ito?"** — confirmed via
  `docs/INTERNAL_CREDIT_SCORE.md` and `LoanApplicationDetailPage.tsx` (line ~989,
  `application.dtiPercent ?? undefined` with no separate `status === 'INCOMPLETE'` gate in code):
  yes, the Internal Credit Score's DTI factor reads the same persisted `dtiPercent` the Risk badge
  shows — fixed 2026-09-12 per the doc's own changelog note, no independent re-derivation anymore.

## Follow-up: Maniwang edit, and a real product gap found

User edited ALDWIN JALA MANIWANG's application directly in the LMS (added `monthlyIncome`) via
"Edit Application" — confirmed the backend already recomputes `dtiPercent`/`riskTier` (and even
`status`, PREDECLINED → PREAPPROVED) automatically on that kind of edit, no script needed. DTI
changed twice as the user kept editing during the conversation (43.6% HIGH → 33.5% MEDIUM) -
expected live behavior, not a bug.

User then asked why Maniwang's DTI didn't include his existing ACTIVE loan account (SML-REG_00382,
from earlier in this session) — confirmed this is v1's documented scope: DTI covers only the new
application's own estimated amortization, not other active Easycash loans (see
`LoanApplicationRiskAssessmentService.ts`'s own doc comment for why - no clean mapping from a
LoanAccount's product to the application's free-text category). Real DTI is understated for any
renewal applicant with existing debt - flagged to the user, not actioned (out of scope, would need
its own design decision).

**Investigated why "Test DELA CRUZ Applicant" stayed INCOMPLETE despite having 8 attachments** —
first suspected a bug (`RevertLoanApplicationDecisionUseCase` is supposed to check document
completeness and skip landing on INCOMPLETE if already complete), but the real cause was simpler:
this application has a co-borrower (TESTCOB) that I'd overlooked, so `VALID_ID_CO_BORROWER` was
correctly in its required-categories list and genuinely missing - the other 7 categories were all
present. Not a bug; own mistake in reading the data.

**Found a real product gap while fixing it**: the LMS Attachments panel (`AttachmentsPanel.tsx`)
has no document-category picker once an application already exists - category-aware upload only
exists in `LoanApplicationCreatePage.tsx`'s initial creation flow. Staff have no UI path to add a
correctly-tagged document to an existing application, which silently blocks the INCOMPLETE →
PREAPPROVED/PREDECLINED auto-transition for anything missing just one category post-creation.
Flagged as a spawned background task (`task_79fa0d02`) rather than fixed inline, since it's a
UI/UX decision (which categories to expose) that needs its own confirmation, not a quick patch.

For this specific test record, worked around it with `scripts/scratch-attach-cob-valid-id-
811d7768.ts` (committed `f91f3788`) - reuses the application's own existing `VALID_ID_BORROWER`
bytes as a placeholder (test/dummy data only), then reruns the exact classification logic
(`LoanApplicationPreQualificationService.evaluateCriteria()`, called directly rather than
reimplemented, to avoid any drift from the real rules) that a real upload would trigger. Result:
PREAPPROVED, DTI 11.3%, LOW.

## Current state

- All DB changes are local to Office Server PC's database (test data only, no production
  applicants affected).
- Final state of all 5 test applications:

  | Applicant | Status | DTI | Risk |
  |---|---|---|---|
  | Test DELA CRUZ Applicant | PREAPPROVED | 11.3% | LOW |
  | ALDWIN JALA MANIWANG | PREAPPROVED | 33.5% | MEDIUM |
  | TEST6NOMER... | INCOMPLETE | 7.9% | LOW |
  | TEST2NOMER... | INCOMPLETE | 19.7% | LOW |
  | NOMER DELA CRUZ PEREZ | INCOMPLETE | — | — (no monthlyIncome, no attachments at all) |

- Scripts committed and pushed (`090f93b2`, `f91f3788`) so they're available to run on other
  machines if needed.
- Outstanding: `task_79fa0d02` (category picker for existing applications' Attachments panel) -
  spawned, not started. NOMER DELA CRUZ PEREZ remains INCOMPLETE with zero attachments and no
  income on record - genuinely incomplete test data, not something to fix without knowing what the
  user actually wants that record to represent.
