# Session Log — 2026-07-11

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-10.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

> Two independent work streams landed this same day and are recorded here as separate sections:
> §1–§N below (Nomer/this assistant's session) and the "AI document auto-fill..." section that
> follows (Jomer/MIS's session), merged together when the two branches were reconciled 2026-07-13.

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

---

## Jomer/MIS's session (same day, separate branch)

## 1. AI document auto-fill, categorized attachments, attachment preview (`3bc5435`)

- New `ai-extraction` backend module: a local Ollama vision model (`moondream`) reads an uploaded
  ID/payslip/PDF/DOCX and suggests values for the Loan Application intake form. Deliberately
  ephemeral — the file is never persisted by this endpoint, per its own router doc comment.
- Attachments gained a `documentCategory` enum (profile picture, valid ID borrower/co-borrower,
  proof of billing, employee ID, business clearance, corporate payslip, seaman's book, OEC) —
  migration `add_attachment_document_category`.
- Loan Application intake form gained named, conditional upload slots per document category
  (shown/hidden based on loan type and whether there's a co-borrower) — uploaded during creation,
  auto-saved as real attachments once the application exists (best-effort, never blocks/rolls back
  application creation).
- New `AttachmentPreviewModal` (image/PDF, fetched as an authenticated blob since the download
  endpoint needs a Bearer header a plain `<img src>` can't send) so reviewing an attachment no
  longer requires downloading it first.
- Bug found and fixed mid-session: the AI Auto-fill card was wired into the wrong component
  (`LoanDetailPage`'s hand-authored-mock branch, not `RealLoanDetailView`, which is what every real
  loan actually renders) — the card was silently absent for every real loan until fixed (`8133909`).

## 2. Formatting fixes, ErrorBoundary, a real "logout" bug (`b2dc492`)

- Added `formatMobileNumber`/`toProperCase` display-only formatters — PH mobile numbers and
  cascading PSGC addresses had been rendering as a mix of raw digit strings and inconsistent
  ALL CAPS/lowercase.
- User reported what looked like a random logout when clicking into a loan application row.
  Root cause: `formatMobileNumber`/`toProperCase` called `.toLowerCase()`/`.replace()` without
  guarding against non-string runtime values (the `string | null` type is compile-time only), and
  with **no top-level React error boundary**, that render crash unmounted `RoleProvider` — which
  looks identical to a session expiring, even though the session was never touched. Fixed both:
  made the formatters defensive, and added `ErrorBoundary` around the whole app so a future render
  crash shows a "something went wrong, you're still signed in" screen instead of masquerading as a
  logout.

## 3. System-computed PREAPPROVED/PREDECLINED pre-qualification (`f1fe397`)

- Replaced `PENDING_REVIEW` and the separate manual "reviewed" inbox flag with an automatic,
  deterministic, rule-based classification (`LoanApplicationPreQualificationService`) — advisory
  only, the officer's `APPROVED`/`DECLINED` decision still overrides it. Three rules, all
  business-confirmed numbers (not invented — see the conversation's clarifying questions):
  - Age 18–55.
  - Monthly income above a flat-rate amortization estimate — **3.0%/month**, confirmed as the
    dominant/most-common rate across all three real product classes (SL/SML/BL-Regular) by reading
    the actual production ledger (`legacy/reports/OFFICIAL CALCULATOR OF EASYCASH...xlsm`) and the
    real computation-sheet formula (`legacy/reports/201 Loan Docs Generator/Sample Computation
    Sheet updated.xlsx`) — a simplified screening approximation, not the real PMT-based
    contractual-rate formula used at actual booking.
  - Home address within **50 km** of the one real branch (Unit 9 G/F The Midland Plaza, Ermita,
    Manila — address confirmed by the user), measured via OpenStreetMap Nominatim geocoding (free,
    open-source, no API key — CLAUDE.md's cost-minimization preference). Fails **open** (treated as
    passing) if geocoding can't resolve an address, since granular PH barangay addresses are often
    unresolvable by free geocoding data.
- New `PATCH /loan-applications/:id` — the "AI Risk Management Summary" (later renamed, see §6)
  card on the Detail page — moved monthly income/credit score/properties-owned off the intake form,
  since a fresh application has no income yet at creation and needs re-classifying once the officer
  records it.
- `LoanApplicationsPage`'s "Review" column and mark-reviewed bulk action removed entirely — no
  longer meaningful once every application is system-classified.
- New `app/backend/src/shared/geo/` module: `IGeocodingService`, `NominatimGeocodingService`,
  `haversineDistanceKm`. New `Branch.address/latitude/longitude` columns (geocoded lazily, no
  network call at seed/migrate time). New `LoanApplication.distanceFromBranchKm` (cached).
- Verified end-to-end via real API calls (not just the UI): a new application with no income
  landed `PREDECLINED`; recording income via the PATCH endpoint flipped it to `PREAPPROVED`;
  `approve()`'s precondition correctly accepted the new statuses through to the
  product-assignment gate.

## 4. Real, rule-based Risk Assessment for Loan Accounts and Clients (`87085a9`, `4907f39`)

- Replaced the mock "AI Risk Assessment" card on the Loan Account detail page with a real
  computation (`LoanRiskAssessmentService`): days-past-due and late-installment count, derived by
  comparing `lastPaidAt` to `dueDate` since `RepaymentInstallment.status` is a live-derived getter
  that loses the "was ever late" signal once an installment is fully paid.
- New "Risk & Payment Summary" card on the Client Profile page (`BorrowerRiskSummaryService`),
  combining the worst risk among a borrower's currently-active loans with their lifetime
  on-time-payment track record across every loan they've ever had (closed included).
- Both were built from **proposed default thresholds** (DPD/late-count/on-time-rate buckets),
  explicitly flagged to the user as pending business confirmation, same posture as the
  pre-qualification flat rate before it was confirmed.
- Follow-up request: show *which* installments were the "2 late" ones the summary counted. Added a
  Payment History tab (`GET /loan-accounts/:id/transactions` — already existed backend-side, just
  needed frontend wiring) alongside Repayment Schedule in one compact tabbed card, with late
  installments visually flagged (a "Paid late" badge using the identical late-detection logic as
  the Risk Assessment card, so the two always agree). The three separate bordered Balance/Terms
  cards were condensed into one dense stat-tile grid per the same request to make the page compact.
  Verified against the user's own example loan (`SML-REG_00335`) — both installments correctly
  showed "Paid late", matching the card's "2 late" count.

## 5. A real bug found while testing: React Query cache-key collision (`9c2f1d2`)

- While verifying the new avatar feature (below), reproduced the user's earlier vague "Something
  went wrong loading this page" report on demand: visiting Client Profile, then a Loan Application,
  crashed with `(productsQuery.data ?? []).flatMap is not a function`.
- Root cause: three pages (`ClientProfilePage`, `DashboardPage`, `LoanListPage`) cached a `Map`
  under the same React Query key (`['loan-products', 'all']`) that `LoanApplicationDetailPage`,
  `LoanProductsPage`, and `StatementOfAccountPage` expect to hold a plain array. Visiting a
  Map-caching page first served the wrong shape from cache to the array-expecting page. This was
  the actual cause of the earlier report — not a session/auth issue, despite how it looked (see the
  `ErrorBoundary` work in §2, which correctly caught it but couldn't explain *why* it happened).
  Gave the three Map queries their own distinct keys.
- Also: extracted the Detail page's `ApplicantAvatar` (renders an applicant's uploaded Profile
  Picture attachment, falling back to initials) into a shared component and reused it in the
  Loan Applications list rows, per an explicit request.

## 6. Decision scoring breakdown + "LMS, not AI" terminology cleanup (`bc8987f`, this session's tail)

- Added a "Decision scoring" breakdown to the Risk Management Summary card: each of the three
  pre-qualification rules (age, income vs. loan amount, address proximity) shown individually with
  a pass/fail icon and the actual numbers behind it, so the officer can see exactly *why* an
  application landed PREAPPROVED/PREDECLINED, not just the final badge.
  `LoanApplicationPreQualificationService` gained `evaluateCriteria()` — pure, no I/O, reuses the
  already-cached `distanceFromBranchKm` rather than re-geocoding — called on every
  read/create/update/approve/decline/revert response so the breakdown never goes stale relative to
  the status.
- User then asked to remove the word "AI" from every place describing the LMS's *own*
  computations, since these are deterministic and rule-based, not an external AI model — framing
  it as "the LMS does this," not "AI does this." Renamed: "AI Risk Management Summary" → "Risk
  Management Summary"; the Loan Account detail's "AI Risk Assessment" card/function → "Risk
  Assessment"; the About page's "AI-assisted risk summary" copy → "system-computed risk summary and
  decision scoring". Left the *genuinely* AI-powered feature (AI Auto-fill, the Ollama-based
  document reader from §1) untouched, since it actually is AI. Also refreshed two stale doc
  comments (`App.tsx`'s routing overview, `LoanDetailPage.tsx`'s `RealLoanDetailView` comment) that
  still described risk assessment/payment history as mock-only.
- User asked why the About page's changelog had no July 9 entry. Investigated: the in-app
  changelog (`lmsVersion.ts`'s `LMS_CHANGELOG`, distinct from the developer-facing
  `app/frontend/CHANGELOG.md`) is a hand-maintained array — not git/live-derived — and had a real
  gap (`0.9.3` July 8 straight to `0.9.4` July 10). `app/frontend/CHANGELOG.md`'s own July 9
  entries were already complete (legacy data migration — 4,604 borrowers, 1,790 loan accounts,
  280,172 transactions — plus Client Data/Loan Accounts/Loan Products/Statement of Account going
  real that day). Backfilled the missing About-page entry from that record and renumbered the
  later versions forward by one (`0.9.4`→`0.9.5`, `0.9.5`→`0.9.6`).

## Current state / follow-ups

- Both new risk-computation features (loan-application pre-qualification, loan/client risk
  assessment) use **proposed default thresholds** presented to the user but not yet formally
  confirmed as final business rules the way the flat rate and distance/age numbers were — worth a
  dedicated confirmation pass before relying on them for real decisions.
- The `MockLoanApplication`/`mockData.ts` section still contains old `PENDING_REVIEW`/`reviewState`
  types and an "AI Risk Assessment" comment — confirmed orphaned (nothing imports it) in an earlier
  session, left untouched again this session per the same reasoning (dead code, out of scope).
- Multi-branch distance logic (nearest-branch, not a single hardcoded branch), admin-configurable
  thresholds, and the full AI-risk-scoring "why" UI were all explicitly scoped out this session and
  may be worth their own follow-up.
