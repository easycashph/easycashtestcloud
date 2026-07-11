# Session Log — 2026-07-11

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-10.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

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
