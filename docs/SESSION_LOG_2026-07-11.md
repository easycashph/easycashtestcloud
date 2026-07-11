# Session Log — 2026-07-11

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-10.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

## 1. Create Loan Account: Contractual Rate auto-fill + Origination Fees system

- User asked: given a real Excel table mapping Add-On Rate → Contractual Rate, could the Create
  Loan Account form auto-fill Contractual Rate from an entered Add-On Rate? Also asked to look at
  every other loan fee (Processing, Advance Interest, Outstanding Balance, Doc Stamp, Account
  Management, Others, Notarial, Web, Insurance).
- Transcribed the real `Rate_details` sheet (`BETA 1.5.83 LMSv3.xlsm`) — 139 rows across ~10
  Add-On-Rate blocks — into a new `InterestRateChart` Prisma model, seeded idempotently. Fixed one
  confirmed data typo (Add-On 1.75%/Term 3: `242` → `2.42%`, user-confirmed).
- Added a 9-field Origination Fees system to `LoanAccount` (Processing, Advance Interest,
  Outstanding Balance Payoff, Doc Stamp, Account Management, Others, Notarial, Web, Insurance) plus
  a computed `netProceeds` (LA-4-style immutable snapshot, never recomputed later). New
  `OriginationFees` domain value object, wired through the use case, DTOs, Zod schemas, presenter,
  and repository (all in lockstep). Backend test suite extended and fixed (543 tests passing).
- Frontend: new "Origination Fees" card on Create Loan Account with all 9 fields, live Total Fees /
  Net Proceeds, and `canSubmit` blocking on negative Net Proceeds.
- Real-data cross-referencing of `Loans_details` (30+ rows) found: Account Management Fee exactly
  1% of principal whenever charged (confirmed default); Notarial ₱500 / Web ₱500 flat, except
  `SL-CORP` at ₱300 / ₱0 (4/4 sampled, confirmed default); Processing Fee inconsistent (no
  confirmed formula — kept manual entry).
- Commit: `cd6b932`.

## 2. Percent-input pattern for Processing Fee and Account Management Fee

- User asked Processing Fee be entered as a percent of principal with the peso amount
  auto-computed, then asked for the same pattern on Account Management Fee.
- Established pattern: a `%` state field drives a derived (non-stored) peso amount. Account
  Management Fee defaults to 1% (the one confirmed rate).
- Commit: `73ad678`.

## 3. Insurance Fee — real VBA macro, verified exact against 4 loans

- User asked if Insurance Fee had a known formula. Initial exhaustive search of
  `BETA 1.5.83 LMSv3.xlsm` (all 18 sheets, text search for "insurance") found nothing — reported
  this honestly rather than guessing.
- User then supplied the actual `CalculateInsurance()` VBA macro source directly. Verified it
  exactly against 4 real disbursed loans (`SML-REG_00365`, `SML-REG_00364`, `SL-REG_00109`,
  `SML-REG_00350`) before trusting it — all exact matches.
- Implemented `computeInsuranceFee()`: `TotalContract = MonthlyAmortization × Term`;
  `Insurance = (TotalContract/1000) × Term`, `+20` if `TotalContract < 50,000`, ceiling to whole
  peso. Documented as `CALCULATION_ENGINE_SPEC.md` §13, CONFIRMED.
- Commit: `70a6c39`.

## 4. Advance Interest Fee — implemented, then challenged, then re-confirmed

- Implemented `computeAdvanceInterestFee()` per the already-`ACCEPTED` `ADR-046` (62.6% exact
  match / 74.6% within 5% across 449 real historical loans): `ceil(Principal × (AddOnRate/100) ×
  (excessDays/30))` when the disbursement→first-repayment gap exceeds 30 days, ceiling-rounded to
  the nearest whole peso. Added an "Anticipated Disbursement Date" field to the form (distinct from
  First Repayment Date) to drive this. Commit: `7f6e04a`.
- User then reported the computation looked wrong and pointed at a newer, actively-used live Excel
  calculator, `Net Amount Auto Computation v3 with Account Management Fee.xlsx` (`AutoV2` sheet).
  Read that sheet's formula directly from 4+ structurally-identical per-quote blocks (`D20`, `D45`,
  `D70`, `D95`) — found it **algebraically identical** to what was already implemented, confirming
  the rate basis (a cell labeled "Interest Rate," distinct from "Contractual Rate," used only for
  the PMT amortization line — i.e. genuinely the Add-On Rate) and the ceiling-to-whole-peso
  rounding a second, independent way. Also found a manual per-quote "With Advance Interest?"
  YES/NO toggle in that sheet — a plausible real mechanism behind `ADR-046`'s still-unresolved
  per-product eligibility question, not itself a confirmed rule.
- To settle whether the *implementation* (not just the spreadsheet reading) was correct, the user
  supplied two more real artifacts for the same live account (`SML-REG_00373`): the company's
  official Disclosure Statement (R.A. 3765 Truth-in-Lending form) and a screenshot of the legacy
  SDevTech production system's own stored values. Hand-computed the fee using the already-
  implemented formula against that account's real inputs (Gross ₱115,926.97, Add-On Rate 3%,
  disbursed 2026-07-03, 1st due 2026-08-15 → 43-day gap, 13 excess days) and got **₱1,508.00** —
  matching both the Disclosure Statement and the SDevTech system exactly. Account Management Fee
  (1%) and Insurance Fee (the §13 macro formula) were also independently reconfirmed exact on the
  same account.
- **Conclusion: the formula was correct all along; no code change was needed.** Updated
  `ADR-046` (new §3.5, Status header, confidence table) and added a new, previously-missing
  `CALCULATION_ENGINE_SPEC.md` §14 "Advance Interest Fee" documenting the formula with this
  live-account evidence. Also flagged (not acted on) a discrepancy: the `AutoV2` Insurance formula
  lacks the macro's "+20 if TotalContract < 50,000" term — noted in both docs for future
  investigation. Commit: `bb6ee21`.

## 5. "Record Payment" button — explained, no changes

- User asked what the Record Payment button on the Loan Detail page does. Explained: navigates to
  Payment Recording scoped to that loan; only visible when the loan is ACTIVE / ACTIVE_IN_ARREARS.
  No code changes.

## 6. Penalty Due / Fees Due columns on Repayment Schedule — deferred by user

- User asked about adding Penalty Due / Fees Due columns to the Repayment Schedule table. Found
  the underlying `feesDue`/`penaltyDue` columns already exist end-to-end in the schema and API
  (`RepaymentSchedule` model → DTO → `InstallmentAmounts` type) — only the UI table doesn't render
  them yet. Flagged the real caveat: `AmortizationScheduleGenerator` never populates either field
  (always 0), since Penalty Calculation is `CALCULATION_ENGINE_SPEC.md` §12, still UNRESOLVED
  (gated on `ADR-008`, not yet produced) and there's no recurring per-installment Fees rule either.
  Presented two options (add the columns now, showing ₱0.00 until the engine exists; or design the
  Penalty engine first). **User chose to defer both — wants to think through the penalty
  computation itself first.** No code changes; nothing implemented this session.

## 7. Desired Net Amount entry mode (reverse-solved Gross) + a rounding bug found and fixed

- User asked: when a client requests an exact Net Amount (e.g. "gusto niya makuha ₱20,000 net"),
  how can staff enter that directly instead of guessing a Gross Amount? Noted this mirrors the
  legacy Excel's own "Net Amount Auto Computation" workbook, which does exactly this via a
  goal-seek chain. Asked the user to choose a UX shape (toggle mode vs. separate calculator
  helper) — user chose the toggle (Recommended).
- Implemented: a new "Amount Entry Mode" toggle (Gross Amount / Desired Net Amount) on Create Loan
  Account. In Net mode, a new `solveGrossForDesiredNet()` iteratively reverse-solves the required
  Principal Amount (12-iteration fixed-point goal-seek, reusing the exact same fee formulas already
  in the form — `computeAdvanceInterestFee`, `computeInsuranceFee`, percent-based fees — no new
  business rules). Principal Amount stays visible/editable in both modes. Commit `53094fe`
  (initial), refined in the same commit after user testing.
- **User tested it live and found a real bug**: Net Proceeds showed ₱99,999.99 instead of exactly
  ₱100,000.00 for a Desired Net Amount of ₱100,000. Root cause: the solver targeted *unrounded*
  fractional-peso fee values during iteration, while the real form rounds Processing Fee and
  Account Management Fee to centavos (`.toFixed(2)`) *before* summing — a classic "round each then
  sum" vs. "sum then round" mismatch, off by exactly ₱0.01. Fixed by rounding those two fees to
  centavos inside the solver too, so it targets the same value the real form will actually produce.
  Verified via a standalone Node simulation reproducing both the bug (₱99,999.99) and the fix
  (₱100,000.00) — and the fixed solver's output Gross Amount (₱115,926.97) matched the real
  `SML-REG_00373` Disclosure Statement's Gross Amount exactly, a second independent confirmation.
  User asked to also check `BETA 1.5.83 LMSv3.xlsm` for their own reverse-solve — searched all 17
  sheets (cell values and formulas) for "net amount"/"gross amount"/"solve," found nothing (likely
  a VBA macro not extractable by this session's tooling, same situation as Insurance Fee earlier);
  not pursued further since the math fix was already independently verified against real data.
  Commit: `53094fe` (fix folded into the same commit, per user's "i-commit mo na" after
  confirming the retest looked correct).

## 8. Real bug found and fixed: blank "New Loan Account" page, React Query cache-key collision

- User supplied a screen recording (couldn't be read directly — no video tooling available) showing:
  click "New Loan Account" → page goes blank → refresh → bounced to Login. Asked the user for a
  browser DevTools Console screenshot instead (the same diagnostic approach that resolved a
  look-alike issue in an earlier session) — got back the exact error:
  `Uncaught TypeError: (productsQuery.data ?? []).filter is not a function` at
  `LoanAccountCreatePage.tsx:196`.
- Root cause: **7 pages share the React Query cache key `['loan-products', 'all']`, but 3 of them
  resolve it to a `Map` instead of a plain `LoanProduct[]`** (`DashboardPage`, `ClientProfilePage`:
  `Map<string,string>`; `LoanListPage`: `Map<string,{name,isActive}>`), while the other 4
  (`LoanAccountCreatePage`, `LoanApplicationDetailPage`, `LoanProductsPage`,
  `StatementOfAccountPage`) expect the flat array. Navigating from a Map-returning page into New
  Loan Account let React Query serve the stale cached Map on first render before the fresh fetch
  resolved — `.filter()` doesn't exist on a `Map`, threw uncaught, and with **no error boundary
  anywhere in the app**, React unmounted the entire tree to a blank page. (The subsequent
  "refresh → Login" is very likely a separate, expected consequence of this app's access-token
  design — access tokens are memory-only and always re-derive via the refresh-token cookie on
  reload; if enough real time had passed or the backend had restarted mid-session, that refresh can
  legitimately fail. Not chased further since the user didn't report it recurring after the fix.)
- Fix: gave the three Map-returning queries their own distinct keys
  (`['loan-products', 'version-to-name']`, `['loan-products', 'version-to-product']`) so they can
  never collide with the array-returning ones. Audited every other cross-file query key in the app
  (`borrower`, `loan-account`, `loan-accounts`, `repayment-schedule`, etc.) for the same
  same-key-different-shape pattern — no other instances found. Commit: `bb08092`.
- User confirmed fixed after retesting.

---

## Current state / known follow-up

- All work today is committed locally (`cd6b932` → `bb08092`, 9 commits) but **not pushed** —
  `origin/main` has diverged (local is ~22 commits ahead, 13 behind, as of the last check this
  session). Nothing was pushed today; push has not been requested.
- Advance Interest Fee: formula/rate-basis/rounding are now `CONFIRMED` by three independent
  real-world sources on top of the original 449-loan statistical fit. **Per-product eligibility is
  still the one open item** — `ADR-046` §7 still calls for a business decision on which
  `LoanProductVersion`s should charge this fee; the newly-found `AutoV2` "With Advance Interest?"
  toggle is a plausible mechanism behind that gap but isn't itself a confirmed rule.
- Penalty Calculation (`CALCULATION_ENGINE_SPEC.md` §12) remains UNRESOLVED and explicitly
  deferred by the user this session — they want to think through the real computation before any
  implementation or even the Repayment Schedule UI columns. Do not add Penalty Due / Fees Due
  display, and do not guess at a penalty formula, until the user brings this back.
  `RepaymentSchedule.feesDue`/`penaltyDue` already exist end-to-end in schema/API/DTO and need no
  further plumbing once a real formula exists — only the generator logic and the UI table are
  outstanding.
- A flagged-but-unconfirmed discrepancy remains open: the `AutoV2` Excel's Insurance Fee formula
  omits the macro's "+20 if TotalContract < 50,000" term. Noted in `CALCULATION_ENGINE_SPEC.md` §13
  and not yet investigated further.
- The user's own reverse-solve attempt inside `BETA 1.5.83 LMSv3.xlsm` (referenced but not located
  by automated search — likely VBA, not a cell formula) was never found or cross-checked; not
  currently blocking anything since the Desired Net Amount fix is independently verified against
  real disclosure data, but worth asking the user directly (sheet/cell, or paste the macro) if it
  comes up again.
