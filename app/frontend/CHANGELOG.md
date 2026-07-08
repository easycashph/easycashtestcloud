# Frontend Changelog — Milestone 9.1 UI Preview Build

Scope note: everything in this changelog is a **CEO-facing UI preview** built against
hand-authored mock data in `src/lib/mockData.ts`. It exists to demonstrate layout, navigation, and
interaction flow before the real backend HTTP API (`app/backend` CP13) is wired up. **No entry
below touches `app/backend` or any real database.** See the "Preview Mode" banner rendered in the
app itself, and the top-of-file comment in `src/lib/mockData.ts`, for the same disclosure.

## 2026-07-08

### Loan Application ↔ Loan Account linking; 3-second hold on the final confirm button
- New business rule (was not previously enforced anywhere): a loan account can only be created
  from a specific, still-unconverted `APPROVED` Loan Application — matched via that application's
  own `createdClientId` (the "Create Client" link). `findApprovedApplicationForClient()` is the
  single source of truth for this; both `ClientProfilePage` and `LoanApplicationDetailPage` gate
  their "Create Loan Account" button on it, with an explanatory message when absent. This means a
  renewal loan needs its own newly-approved application too, not just an existing client
  relationship — matches the already-modeled `accountType: 'RENEWAL'` field on
  `MockLoanApplication`.
- `MockLoanApplication` gained `loanAccountCreated`/`createdLoanAccountId` (mirrors the existing
  `clientCreated`/`createdClientId` pattern); `MockLoanAccount` gained `sourceApplicationId`.
  `createLoanAccountForClient()` now accepts a `sourceApplicationId` param and marks that
  application converted when provided.
- `LoanApplicationDetailPage`'s approved-application card is now a 2-step flow: Step 1 "Create
  Client" (existing), Step 2 "Create Loan Account" (new) — appears once Step 1 is done, opens the
  Create Loan Account form prefilled from the application's requested product/amount/term
  (`assignedSubType`/`requestedAmount`/`requestedTermMonths`), and flips to "View Loan Account"
  once used. `LoanDetailPage`'s Loan Terms tab shows an "Originated from" link back to the source
  application when set.
- Extracted `CreateLoanAccountDialog` (previously private to `ClientProfilePage`) into its own
  shared component (`src/components/CreateLoanAccountDialog.tsx`) with an `initialValues` prop, so
  both entry points share one form/formula implementation instead of duplicating it.
- The dialog's final "Yes, create" button is now disabled for 3 seconds with a live countdown
  ("Yes, create (3)" → "(2)" → "(1)" → "Yes, create") every time the safety-net confirm dialog
  opens — an additional speed bump against a hasty double-click, on top of the existing
  confirm-dialog step.
- Fixed a pre-existing data bug found while testing this: two seed applications'
  `assignedSubType` (`'SML-Reg'`, `'SL-Reg'`) didn't match any real `MOCK_LOAN_PRODUCTS` product
  code (`'SML-REGULAR'`, `'SL-REGULAR'`), so the new prefill silently showed a blank Product
  Sub-type. Corrected both.

### "Approve Loan"/"Activate Loan" implemented — completes the full application-to-disbursement workflow
- Both buttons on `LoanDetailPage` were `ComingSoonButton` placeholders; now real actions, each
  behind the same safety-net confirm-dialog pattern used elsewhere in this preview.
- New `approveLoanAccount(loan, actorName)`: `PENDING_APPROVAL` → `APPROVED`, sets `approvedAt`,
  appends an `APPROVED` timeline entry, logs `APPROVE_LOAN_ACCOUNT`.
- New `activateLoanAccount(loan, actorName)`: `APPROVED` → `ACTIVE` (disbursement) — generates the
  loan's full repayment schedule via the same `buildSchedule()` every other active loan in this
  preview uses (so a freshly-disbursed loan's schedule looks identical in shape to a seeded one),
  recomputes `principalDue`/`interestDue`/`collectionsBalance`/`accountingBalance` from scratch
  (nothing paid yet), sets `activatedAt`, appends a `DISBURSED` timeline entry, logs
  `ACTIVATE_LOAN_ACCOUNT`.
- End-to-end tested: Loan Application (`APPROVED`) → Create Client → Create Loan Account
  (prefilled from the application) → Approve Loan → Activate Loan/Disburse — verified the
  resulting loan's Status Timeline shows all three steps in order with correct actor/timestamp,
  and its Repayment Schedule tab shows the full declining-balance amortization table.

### Generated Documents distributed onto Loan Accounts; Loan Products get editable document templates
- Removed the standalone `/admin/documents` Generated Documents page/route/nav link
  (`GeneratedDocumentsPage.tsx` deleted). Its content now lives on `LoanDetailPage`'s Attachments
  tab, under a new "Generated Loan Documents" section — filtered to that loan account
  (`getGeneratedDocumentsForLoan()`), sitting above the existing manual-upload "Other Attachments"
  section.
- `MockLoanProduct` gained a `documentTemplates: MockDocumentTemplate[]` field — the loan document
  templates (Promissory Note, Disclosure Statement, Loan Agreement, Deed of Assignment, Data
  Privacy and Consent Form) generated when a loan account under that product is activated, adapted
  from the real legacy Word templates in `legacy/reports/201 Loan Docs Generator/`. Seafarer Loan
  products get the seafarer-specific variant set instead (Loan Agreement/Deed of Assignment
  "-SL" suffix, plus Special Power of Attorney) — matching the legacy `-SL` template naming and the
  seafarer-allotment-specific SPA content.
- `buildGeneratedDocuments()` in `mockData.ts` now derives each loan's document set from its own
  product's `documentTemplates` (via `getMockLoanProduct(loan.productId)`) instead of a fixed
  4-type list, plus an Amortization Schedule generated automatically for every product.
- `LoanProductsPage` shows each product's "Loan Document Templates" in its expanded row, with an
  Edit button (active products only) opening a dialog to edit the template name and mail-merge
  body — in-memory only, same preview-only convention as the rest of the page.

### Dashboard layout/bug fixes
- Chart tooltips (Loan Disbursement Trend, Collections vs. Target, Collections Forecast, Portfolio
  Breakdown) now use `TOOLTIP_CONTENT_STYLE`/`TOOLTIP_LABEL_STYLE` pulling from the app's
  `--popover`/`--popover-foreground`/`--border` CSS variables, instead of Recharts' default plain
  white box that stayed white in dark mode.
- `CHART_COLORS` (Portfolio Breakdown pie) no longer includes `--chart-1`, which is re-themed per
  the LMS Configuration accent color and could render identically to `--chart-3`'s green under the
  default emerald accent (Business Loan and Seafarer Loan were indistinguishable).
- Fixed the Collections Forecast and Portfolio Breakdown cards: a fixed-height `CardContent`
  wrapped both the chart and trailing content (disclaimer paragraph / category legend), so the
  card's border box stopped short and that trailing content visually overflowed into the next
  card. The fixed height now applies to a wrapper `div` around just the chart.
- Portfolio Breakdown by Loan Category reworked from a tall stacked layout (chart, then a
  full-width wrapping legend row) to a compact side-by-side donut + legend layout — cuts the
  card's vertical footprint roughly in half on desktop/tablet, stacks vertically on mobile.
- `LoanPortfolioVennDiagram`'s "Good Loan Accounts"/"Matured Loan Accounts" titles were colliding
  into unreadable run-on text at the diagram's width; now wrapped onto two lines each with more
  vertical clearance (viewBox height increased, circles shifted down).

### Create Loan Account form expanded to match the official calculator
- Evidence: `legacy/reports/OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm`, `Loans_details`
  sheet's field set (Term, Contractual Rate, Anticipated Disbursement Date, Co-Borrower, Net
  Proceeds, Processing Fee/Doc Stamp, EIR Monthly/Annual), plus the CONFIRMED formulas already
  documented in `docs/Architecture/CALCULATION_ENGINE_SPEC.md` §2 (PMT / Monthly Amortization) and
  §3 (Add-On/EIR rate conversion — `AddOnMonthlyRate = (TotalInterest / Principal) / n`).
- `ClientProfilePage`'s `CreateLoanAccountDialog` gained: an editable Contractual Rate (defaults
  to the product's rate, validated against `minInterestRate`/`maxInterestRate`), Anticipated
  Disbursement Date (drives `firstRepaymentDate`, one month after), and an optional Co-Borrower
  Name — plus a live "Computation Summary" panel (Monthly Amortization, Total Interest, Net
  Proceeds, EIR Monthly/Annual, and a per-fee breakdown from the product's `feeRules`).
- New `computeLoanOriginationSummary()` in `mockData.ts` — reuses the same PMT shape as
  `buildSchedule()`'s amortization generator, so the preview figure and the eventual generated
  schedule agree.
- `MockLoanAccount` gained an optional `coBorrowerName` field, surfaced on `LoanDetailPage`'s Loan
  Terms tab. `createLoanAccountForClient()` now accepts `interestRate`, `coBorrowerName`, and
  `anticipatedDisbursementDate` overrides (previously only product/principal/installment count).

### Create Loan Account form rebuilt around the real loan-encoding sheet (Interest Rate Chart + per-fee Waive toggles)
- New evidence base: `legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx` — the
  actual loan-encoding workbook (`Fill up form`, `manual input for LOAN AMOUNT`, `Interest Rate
  Chart` sheets), a level up in fidelity from the read-only `OFFICIAL CALCULATOR` workbook used
  for the first pass of this form. Superseded the manually-typed Contractual Rate and the flat,
  non-waivable `feeRules`-only fee model with this sheet's actual mechanics.
- **Interest Rate Chart** (`INTEREST_RATE_CHART`, `src/lib/mockData.ts`): the real 135-row Add-On
  Rate → Contractual Rate lookup table (`Interest Rate Chart` sheet, `A2:C136`), read exactly as
  the source sheet does — `INDEX/MATCH` by `(Term, Add-On Rate)`, no interpolation. This resolves
  `CALCULATION_ENGINE_SPEC.md` §3's note that the Add-On→Contractual reverse direction "uses a
  precomputed lookup table" — that table's actual contents were previously unknown. One 3-row
  group in the source (`Add-On 10.0%`) was excluded as internally-inconsistent stray test data,
  not a real tier — never fabricated a replacement.
- **Per-fee Waive toggles** (`LoanFeeWaivers`): Account Management Fee (1% of principal),
  Processing Fee (product's own rate), Digital Signature Fee (₱500 flat), Notarial Fee (₱500
  flat), Insurance Fee, and Advance Interest Fee — each independently waivable, mirroring the
  source sheet's column `H` (`"NO"` zeroes that fee out entirely, never redistributed).
- **Advance Interest Fee** and **Insurance Fee** formulas newly documented (previously
  undocumented anywhere in this codebase) — see `computeLoanOriginationSummary()`'s doc comment
  for the exact cell-sourced formulas, including the Advance Interest Fee's >30-day partial-period
  condition (independently confirms the shape of `CALCULATION_ENGINE_SPEC.md` §8's day-count
  formula from a second legacy source) and the Insurance Fee's `Obligation`-tiered calculation.
- Added an **Outstanding Balance from Previous Loan** field for renewals — deducted from Net
  Proceeds alongside fees, matching the source sheet's `Other Bank Charges/Deductions Collected`
  field (`H9`, the previous loan's balance being paid off from the new loan's proceeds).
- `computeLoanOriginationSummary()` signature changed to a single params object
  (`LoanOriginationParams`) given the larger field count; `LoanOriginationSummary` now reports a
  `fees` breakdown object, `otherProductFees` (the product's non-Processing-Fee `feeRules`,
  e.g. Documentary Stamp Tax — always applied, no waive evidenced for these), `obligation`, and
  `contractualRateFromChart` (false when no chart entry exists for the term/add-on combination,
  surfaced in the UI rather than silently guessed).

### Interest Rate Chart corrected; Create Loan Account gained a Disbursement section
- Cross-validated `INTEREST_RATE_CHART` against a second, independent copy of the same table:
  `legacy/reports/OFFICIAL CALCULATOR OF EASYCASH 1.5.83 LMSv3.xlsm`, sheet `Rate_details` (also
  studied that workbook's `Schedule` and `Loans_details` sheets — the latter is the real
  production ledger of disbursed loans, useful for validating every fee formula against actual
  historical figures, not just worked examples). Two corrections resulted:
  - The `Add-On 10.0%` tier (terms 1–3), previously excluded as suspected stray test data (its
    values in the Encode.xlsx copy were fractions like `0.1` instead of whole percent), is real —
    `Rate_details` stores it correctly as `10`/`13.07`/`14.36`. No longer excluded.
  - Added a previously-missing `Add-On 5.0%` tier (terms 1–4: `5`/`6.6`/`7.33`/`7.72`), present in
    `Rate_details` but absent from the Encode.xlsx copy.
  - Every other value matched exactly between both independent sources.
- Cross-referencing `Loans_details`'s real disbursed-loan rows also confirmed the Account
  Management Fee's 1% rate, the ₱500 Notarial Fee, and the Advance Interest/Insurance Fee
  formulas against real production figures (not just the one worked example previously
  available) — documented in `computeLoanOriginationSummary()`'s doc comment, including a note
  that `Loans_details` records the same ₱500 flat fee as "Web fee" under an older name than the
  Encode.xlsx sheet's "Digital Signature Fee" (confirmed distinct from Notarial Fee — real loans
  show both charged simultaneously).
- New **Disbursement** section on the Create Loan Account form: Payment Method (reuses
  `ACTIVE_PAYMENT_METHODS`), plus Bank Name/Bank Account Number/ATM Card Number/Name on
  Card-or-Account fields shown only for `BANK_TRANSFER`/`AUTO_DEBIT` — matches `Loans_details`
  columns `AD`–`AG`. `MockLoanAccount` gained an optional `disbursementBank` field, surfaced on
  `LoanDetailPage`'s Loan Terms tab; `createLoanAccountForClient()` now accepts `paymentMethod`
  and `disbursementBank` overrides (previously hardcoded to `GCASH`).

### Documentary Stamp Tax gets its own Waive toggle, defaulted to waived
- `LoanFeeWaivers` gained a `documentaryStampTax` flag — unlike the other six toggles, this one
  isn't part of the official calculator's own per-fee mechanism (there, Documentary Stamp Tax is
  just a fixed, always-applied product fee); added per MIS request as an explicit exception.
- New `DEFAULT_FEE_WAIVERS` export (`{ ...NO_FEES_WAIVED, documentaryStampTax: true }`) is now the
  Create Loan Account form's actual starting state — Documentary Stamp Tax starts waived, every
  other fee still starts charged, matching `NO_FEES_WAIVED`'s baseline.
- `computeLoanOriginationSummary()`'s `otherProductFees` mapping now special-cases the
  `Documentary Stamp Tax` line to respect this toggle; every other `productFeeRules` entry (e.g.
  Credit Investigation Fee) remains always-applied, unchanged.

## 2026-07-07

### About page — version/changelog now derive automatically, no more dual maintenance
- `LMS_VERSION` and `LMS_UPDATED_ON` are no longer independent constants — both are now derived
  from `LMS_CHANGELOG[0]` (`src/lib/lmsVersion.ts`), and the "Current" badge on the About page's
  changelog is computed from array position (`index === 0`) instead of a manually-set `stage`
  field. Previously these could (and did) drift out of sync with the actual changelog content —
  the changelog itself is now the only thing to update when a release ships. Version bumped to
  **0.9.2** with a new entry summarizing everything shipped today after 0.9.1 (Create Application,
  search/filter across three pages, clickable client names, Portfolio Filter promoted to master
  filter, real bottom-up forecast/disbursement figures) — this session's own hardcoded changelog
  had gone stale before this fix, which is what prompted it.

### Search & filter — Client Data, Payment Recording, Payment Reminders; applicant name links to Client Profile
- **Client Data (`/clients`)**: search now also covers contact number, email, and position (was
  name/employer/branch only), plus two new filter dropdowns — Home Branch, and loan presence
  (All / With active loan / With loan history / No loans yet — "active" includes ACTIVE,
  ACTIVE_IN_ARREARS, and MATURED). A "N of M clients shown" count line reports the filtered size.
- **Payment Recording (`/payments`)**: new "Find loan account" search (borrower name or loan
  code) and a payable-status filter (All / Active only / In Arrears only) that narrow the
  loan-account dropdown, with a "N of M payable loan accounts match" line. Narrows the picker
  only — never the allocation math; the currently selected loan stays pinned in the options so
  the picker never goes blank because of a filter.
- **Payment Reminders (`/reminders`)**: new search box (borrower name or loan account code)
  alongside the existing status and reminder-type filters.
- **Loan Application detail (`/applications/:id`)**: the applicant's name is now a link to their
  Client Profile when the applicant is an official Easycash client — either the client record
  that "Create Client" produced from this application, or a same-name existing client (repeat
  applicant). Stays plain text for brand-new applicants, so no dead links.

### Loan Applications — Create Application (officer-encoded walk-in intake)
- New **Create Application** button on `/applications` → `/applications/new`: a loan officer can
  now encode a walk-in applicant's application on their behalf, since the public application
  website does not exist yet. Same role gate as the rest of Loan Applications (MIS / Loan
  Operation Manager / CRM).
- The form mirrors the company's **real paper form (Form No. ECLC-LOFN01, Rev 02,
  `legacy/reports/Loan Application Form -general.pdf`) section for section**: §1 How did you find
  out about Easycash, §2 Loan Information (New/Renewal, type of loan, amount, term, purpose),
  §3 Personal Information (name/nickname/gender/civil status/DOB with live age/address/home
  ownership/contacts), §4 Employment (employer, occupation, TIN, SSS), §5 Dependants (dynamic
  rows), §6 Spouse (auto-shown only when civil status is Married, per the form's own skip rule),
  §7–8 Co-Borrower (toggle), §9 Character References ×2 — plus two LMS-only cards clearly labeled
  as not on the paper form: Verification Inputs (monthly income, credit score from the CB report,
  properties owned — the qualification-factor inputs) and a Documents Submitted checklist
  (intake-stage document names only, metadata only, no real upload).
- Paper form's loan types OFW / Car / Real Estate are shown as a note but not offered — only the
  3 active categories are selectable, matching the product catalog.
- Submitting (confirmation-gated, like Approve/Decline) builds the same rule-based qualification
  factors/risk level the sample applications carry, prepends the application to the list as
  PENDING REVIEW, logs `CREATE_LOAN_APPLICATION`, and opens its detail page — which now shows
  "Walk-in applicant — encoded at the branch by {officer} from the paper form (ECLC-LOFN01)"
  instead of the public-website caption, plus new Type of account / Loan purpose / "Found
  Easycash via" rows. Only LMS-modeled fields persist onto the sample record; the form says so
  explicitly (dependants/spouse/TIN/SSS/references stay on the paper form for now).

### Dashboard — Portfolio Filter layout fixed
- The Filter icon no longer floats mid-paragraph next to the (multi-line) description — it's now
  top-aligned with the card title (`items-start` + `mt-0.5`, was `items-center` against the whole
  title+description block).
- Loan Category, From, and To now sit in a single row together at any width that has room for
  them (previously waited for a `lg:` 1024px breakpoint, so most normal-width windows showed them
  needlessly stacked one per line). Verified at mobile (375px, stacks full-width cleanly), a
  ~624px window (single row), and 1280px desktop.
- `DateRangeFilter` (shared component) inputs are now `w-full sm:w-40` instead of a fixed `w-40`,
  so they don't force horizontal scrolling on very narrow screens.

### Loan Accounts — client name links to the client's profile
- On the Loan Accounts list (`/loans`) and the Loan Account Detail page (`/loans/:id`), the
  borrower's name is now a link straight to their Client Data profile (`/clients/:borrowerId`).
  On the list, clicking the name opens the client profile without also triggering the row's own
  click-through to the loan detail page (`stopPropagation`). New `getMockBorrowerForLoan` helper
  in `mockData.ts` looks up the matching `MockBorrowerProfile` by `loanIds`; falls back to plain
  (non-linked) text for the rare loan with no matching client record, so no dead links are ever
  rendered.

### Dashboard — reordered; Portfolio Filter is now the master filter for the whole page
- Section order changed to: **Portfolio Filter → Overview → Portfolio Quality Metrics → Loan
  Disbursement Trend → Collections vs. Target → Collections Forecast → Portfolio Breakdown by Loan
  Category → Loan Portfolio Health → Recommendation.** Portfolio Filter now sits at the very top.
- The Portfolio Filter (loan category + date range) now drives every portfolio card, not just
  Portfolio Breakdown and Loan Portfolio Health: **Overview**'s Total Active Loans, Collections
  This Month, and Overdue Accounts; **Portfolio Quality Metrics**' Delinquency Rate, PAR, Average
  Loan Size, and Write-off exposure (verified live: filtering to "Business Loan" correctly shows
  the one written-off loan's ₱105,783.33 exposure, while "Salary Loan" correctly shows ₱0.00 —
  the write-off bucket now respects category too); and **Loan Disbursement Trend**, rebuilt as a
  real bottom-up sum of `principalAmount` by `activatedAt` month (`buildDisbursementTrend` in
  `mockData.ts`) instead of a fabricated series, so it can be filtered meaningfully.
- **Collections vs. Target** and **Collections This Month** have no per-loan, per-calendar-month
  payment-date field to sum bottom-up, so they're scaled proportionally to how much of the
  portfolio's outstanding principal the current filter selects — clearly disclosed in each card
  ("Estimated for the selected filter" / "scaled proportionally to outstanding principal"), not
  presented as more precise than they are.
- **Collections Forecast** and **Recommendation** are deliberately exempt, by design (each card
  now says so explicitly): a cash-flow forecast is most useful as a whole-company number, and
  Recommendation is portfolio-wide strategic guidance, not a report figure.
- **Collections Forecast methodology improved**: previously a fabricated linear series
  (`1_050_000 + i*35_000`); now a real bottom-up projection (`buildCollectionsForecast` in
  `mockData.ts`) that sums each active loan's own scheduled installments (principal + interest +
  fees + penalty, from `MOCK_INSTALLMENTS`) due in each of the next 4 months, then applies the
  portfolio's own recent collection-realization rate (average actual ÷ target from
  `COLLECTIONS_VS_TARGET`). This is the standard approach for a loan portfolio — known future
  amortization × a realistic collection rate — rather than fitting a trend line to past totals
  alone.

### Dashboard — filters + dynamic totals on Portfolio Breakdown and Loan Portfolio Health
- New shared **Portfolio Filters** card (Loan Category + date-range) sits above both widgets and
  drives them together: **Portfolio Breakdown by Loan Category** (pie) and **Loan Portfolio
  Health** (Venn diagram) now recompute their loans, counts, and every ₱ total live against the
  active filter — including the per-segment Interest Income / Accrued Revenue / Credit Loss
  figures. A summary line reports "Showing N active loan accounts · ₱X total outstanding
  principal" for whatever is currently in scope, and each card's drill-down dialog reflects the
  filtered set too. Reset button clears back to the whole portfolio.
- `src/lib/mockData.ts`: `buildPortfolioHealth()` and `buildPortfolioByCategory()` are now
  exported, reusable builder functions (previously private, MOCK_LOANS-only) so the Dashboard can
  call them against any filtered loan subset; `PORTFOLIO_HEALTH`/`PORTFOLIO_BY_CATEGORY` remain as
  the portfolio-wide baseline used by the (unfiltered) Quality Metrics and Recommendation cards.
  New `LOAN_CATEGORY_OPTIONS` export for the filter dropdown.

### Dashboard — "AI Portfolio Assist" renamed to "Recommendation"
- Same three per-segment plans (Maintain / Protect the margin / Resolve), same disclosure text —
  only the card title changed, per business instruction.

### Back buttons now use browser history instead of a hard-coded destination
- Every "Back to X" button (Loan Account Detail, Loan Application Detail, Client Profile,
  Statement of Account) now calls `navigate(-1)` instead of a hard-coded route, so it returns to
  wherever the user actually came from — list, search result, or another detail page — instead of
  always resetting to a blank list. Label shortened to "Back" since the destination is no longer
  a fixed, nameable page.

### About page — company/product info update
- LMS name corrected to **Easycash Loan Management System Platform** (`LMS_APP_NAME`).
- New **Developer Team — Easycash Dev** card: Jomer Biason (MIS Assistant — Vibe Coder and
  Programmer) and Nomer Perez (MIS Manager — Reviewer).
- New **Easycash Portal** card — informational disclosure of the planned future client-facing
  app/website (`easycashportal.ph`): online loan application, status, transaction history,
  payments, tracker, and customer service contact. Explicitly labeled "Planned — not yet built";
  nothing in this LMS links to it.
- Details grid gained a "Developed by" fact.

### About page (new, under Administration) — LMS version number + changelog
- Added `/admin/about`: an app-store-style About page — logo, app name, version badge, an "About
  this app" description of the platform's modules, a Details grid (version, updated/released
  dates, offered-by, environment), and a **What's New — Changelog** section listing prior releases
  newest-first.
- New single source of truth for the version/changelog: `src/lib/lmsVersion.ts`
  (`LMS_VERSION`, `LMS_CHANGELOG`, `LMS_ABOUT_SECTIONS`, `LMS_ABOUT_FACTS`). Bump the version and
  prepend a changelog entry here whenever a user-visible release ships — this is the
  stakeholder-facing history, separate from this developer-facing `CHANGELOG.md`.
- Current version: **0.9.1** (pre-1.0, reflecting the Milestone 9.1 UI-preview stage). The sidebar
  footer now reads the same version (`v0.9.1`) instead of a hard-coded "Milestone 9.1" string, so
  the two can never drift out of sync.
- "About" added as the last item under the Administration sidebar group.

### Loan Portfolio Health — per-segment income/loss figures + shorter overlap label
- Each summary card now shows a labeled financial figure computed live from the sample portfolio,
  giving a collected → accrued → at-risk revenue narrative:
  - **Good → Interest Income** (realized interest revenue already collected from performing
    accounts) = sum of interest paid.
  - **In Arrears → Accrued Revenue** (interest earned but not yet remitted; penalty/late-fee
    income is still called out separately in the card text) = sum of interest balance.
  - **Matured → Credit Loss** (unpaid principal at risk of loss now that the loan is past its full
    term) = sum of principal balance.
- The Venn overlap label was shortened from the two-line "Active Accounts / in Arrears" to a
  single **"In Arrears"** so it fits inside the lens; the In-Arrears summary card title was
  shortened to match. (`PORTFOLIO_HEALTH` gained `interestIncome` / `accruedRevenue` /
  `creditLoss` in `src/lib/mockData.ts`.)

### Venn diagram — third segment is now "Matured" (distinct from Closed), green/yellow/red color code
- Per business clarification, the Venn's third circle is now **Matured Loan Accounts** (red), a
  new distinct loan status `MATURED`: an **active** loan that has passed its full maturity date
  but is still unpaid, carrying an outstanding balance — the highest-risk active segment. This
  is deliberately **different from a Closed account**: `CLOSED` = reached maturity AND settled
  successfully (a separate, healthy outcome, not shown as a Venn circle). Written-off loans
  (`CLOSED_WRITTEN_OFF`) are likewise no longer a Venn segment — they remain behind the Write-off
  exposure quality metric and its drill-down.
- Venn color code is now: **Green = Good, Yellow = Active Accounts in Arrears (overlap), Red =
  Matured**. The `LoanStatusBadge` was aligned to match — In Arrears is now `warning` (yellow)
  and the new Matured status is `destructive` (red).
- `MATURED` is a first-class status across the mock model: two sample accounts (origination
  pushed past their full term), timeline event, High-Risk assessment, included in Total Active
  Loans / Portfolio Breakdown / the Delinquency Rate & Portfolio-at-Risk metrics (matured loans
  count as delinquent/at-risk). The AI Portfolio Assist plan for this segment is now **Resolve**
  (escalate to intensive collection / restructuring before the loss is realized).

### Venn diagram — "Sweet Spot" renamed to "Active Accounts in Arrears"
- The Loan Portfolio Health overlap segment is now labeled **Active Accounts in Arrears**
  (per business instruction) everywhere: the SVG overlap, the summary card, the AI Portfolio
  Assist badge, and `PORTFOLIO_HEALTH`'s internal key (`sweetSpot` → `activeInArrears`).
  The business meaning is unchanged — still active and paying, just sometimes late, generating
  penalty/late-fee income on top of amortization — and the new name is also the
  industry-standard term (an account "in arrears" is overdue but not in default).

### Dashboard — 3 loan categories only; SML rolls up under Seafarer Loan
- Portfolio Breakdown now groups by the 3 active loan CATEGORIES (Salary Loan, Seafarer Loan,
  Business Loan) instead of per sub-type product names. Every SML-* product — active or
  discontinued (SML-Regular, SML-Max, …) — is a sub-class of **Seafarer Loan** (a.k.a. Seaman
  Loan) and rolls up under it (`getDashboardLoanCategory` in `src/lib/mockData.ts`); a
  defensive "Other (Legacy)" bucket exists so no non-SL/BL/SML legacy loan could ever silently
  vanish from a chart total.

### Clickable charts — drill down to the accounts behind every figure
- New shared `LoanDrillDownDialog`: clicking a Venn region/summary card, a Portfolio Breakdown
  pie slice or legend entry, a Loan Disbursement Trend bar, the Total Active Loans / Overdue
  Accounts summary cards, or a Portfolio Quality Metric value opens a dialog listing exactly
  which loan accounts make up that analytics figure — each row links to the full Loan Account
  detail page. Charts with no account-level mapping (Collections vs. Target, Collections
  Forecast — target/projection lines over sample aggregates) deliberately stay non-clickable
  rather than pretending to drill down.
- Mock-data note: loan origination dates are now spread from ~3 weeks to ~23 months ago
  (previously 200+ days minimum) so the "last 6 months" disbursement bars have real accounts
  behind them instead of a permanently empty drill-down.

### Sidebar — new section order, theme-aware colors
- Sections/tabs reordered per business instruction: **Home** (Dashboard, Loan Report,
  Collection Report, Transaction Report), **Loan** (Loan Applications, Client Data, Loan
  Accounts), **Collection** (Payment Recording, Payment Reminders), **Administration**
  (LMS Configuration, Member Details, Generated Documents, Loan Products, Activity Logs).
- The sidebar (section tab area) is now theme-aware: light surface in light mode, dark in dark
  mode (previously a fixed dark blue in both), and the active-tab highlight follows the
  selected theme color.

### LMS Configuration (new page, MIS-only)
- `/admin/configuration` — MIS-only settings page: **Theme Color** (5 presets — **Easycash
  Emerald (default)**, Easycash Blue, Violet, Amber, Rose — applied instantly across buttons,
  active section tabs, links, and the primary chart series in both light and dark mode) and
  **Appearance** (light/dark switch). Preferences persist locally (preview build; a real
  implementation would persist per-user via the backend). Theme-color changes are written to
  the Activity Log (`CHANGE_THEME_COLOR`). Non-MIS accounts get the standard restricted-access
  card.

### Default theme color set to Easycash Emerald; company-name casing fixed
- The platform's default theme color is now **Easycash Emerald** (business-confirmed), not the
  legacy Easycash Blue — first load applies emerald out of the box (`DEFAULT_ACCENT` in
  `theme-provider.tsx`); Easycash Blue remains selectable as a preset.
- Corrected all user-facing casing of the company name to the official **Easycash** (was
  "EasyCash") — logo alt text, AI-summary copy, and theme-preset labels. Official business name
  is "Easycash Lending Company Inc." (`COMPANY_INFO.name`, already correct).

### Generated Documents (new page, under Administration)
- `/admin/documents` — mock registry of the official documents produced when a loan account is
  activated (Promissory Note, Disclosure Statement, Loan Agreement, Amortization Schedule —
  matching the company's real legal templates). Sortable/filterable table (default
  recent-to-oldest), rows link to the loan account; metadata only, downloads disabled in this
  preview.

### Investopedia-informed portfolio analytics
- New **Portfolio Quality Metrics** dashboard card applying industry-standard lending
  indicators (as taught on Investopedia — the site itself blocks automated access, so the
  standard definitions were corroborated via other industry sources): **Delinquency Rate**
  (count-based, in-arrears ÷ active accounts), **Portfolio at Risk** (balance-weighted,
  arrears outstanding ÷ total outstanding), **Average Loan Size**, and **Write-off exposure**
  — all computed live from the sample portfolio, all clickable through to the accounts behind
  them.
- New `TermTip` component + `src/lib/financialGlossary.ts`: every metric carries an ⓘ hover
  tooltip with the plain-language definition of the term (Delinquency Rate, PAR, In Arrears,
  Write-off, Amortization, Penalty/Late Fee), explicitly noted as standard industry
  definitions computed against sample data.

## 2026-07-06

### Dashboard — Loan Portfolio Health (Venn diagram + mock AI Assist)
- Added a "Loan Portfolio Health" card to the Dashboard: a two-circle Venn diagram plotting
  **Good Loan Accounts** (`ACTIVE`, paying on schedule, no penalty fees) against **Bad Loan
  Accounts** (`CLOSED_WRITTEN_OFF`, defaulted/unrecoverable), with the overlap explicitly labeled
  **Sweet Spot** — accounts that are `ACTIVE_IN_ARREARS`: still active and still paying, just
  sometimes late, so the company earns real penalty/late-fee income on top of amortization
  (confirmed business intent, not a data-quality problem to fix away). All counts/₱ values are
  computed from the existing `MOCK_LOANS` array (`PORTFOLIO_HEALTH` in `src/lib/mockData.ts`) —
  no new mock loan records were added.
- Added a companion **"AI Portfolio Assist"** card below it: three static, hand-authored
  recommendation blocks (Maintain / Protect the margin / Resolve, one per segment), carrying the
  same "AI-Assisted — draft discussion points for management, not automated actions... static
  mock... not yet connected to an API for a real AI Assist engine" disclosure already used by the
  Loan Applications AI Risk Assessment panel.
- New reusable component: `src/components/LoanPortfolioVennDiagram.tsx`.

### Sortable column headers across every table
- Added click-to-sort column headers (with an ascending/descending indicator icon) to every
  `<Table>` across the LMS preview: Activity Logs, Client Data, Client Profile (Loan History),
  Collection Report (daily/monthly/yearly), Loan Applications, Loan Account Detail (Repayment
  Schedule + Payment History), Loan Accounts list, Loan Products (active + discontinued, grouped
  by category), Loan Report (daily/monthly/yearly), Member Details, Payment Recording (Automatic
  allocation preview), Payment Reminders, Statement of Account, and Transaction Report.
- **Any Date/timestamp column always opens sorted recent-to-oldest (descending)** by default —
  Date & Time, Created, Due Date, Submitted, Last Login, Date, etc. — per the standing requirement
  that date columns default to showing the newest entries first. Clicking a column header again
  toggles between ascending/descending; clicking a different column switches the active sort to
  that column instead (non-date columns default to ascending on first click).
- New shared building blocks: `useSortableTable` (`src/lib/useSortableTable.ts`) and
  `SortableTableHead` (`src/components/ui/sortable-table-head.tsx`) — one hook + one header
  component reused by every page, instead of duplicating sort logic per table.
- Payment Recording's Automatic allocation table is sorted for **display only** — the underlying
  fees → penalty → interest → principal calculation (ADR-009) still always runs against
  installments in oldest-due-first order regardless of how the table is currently sorted, since
  changing the calculation's input order would change the actual allocation, not just how it's
  shown.
- Loan Products' grouped/expandable tables (Active, Discontinued) sort within their existing
  category grouping rather than flattening it.

### Payment Recording — manual allocation mode
- Added an **Allocation** toggle (Automatic / Manual) to the Payment Recording screen.
  **Automatic** is the existing behavior (fees → penalty → interest → principal, oldest
  installment first, per ADR-009). **Manual** lets staff type in exactly how much of the payment
  applies to Principal, Interest, Penalty, and Fees, instead of relying on the automatic engine.
- Manual mode includes a "Copy automatic split" shortcut (prefills the four fields from what the
  automatic engine would have applied, still editable) and a live mismatch check comparing the
  four manually-entered amounts against the total payment amount, flagging any unallocated or
  over-allocated difference.
- The Allocation Preview panel switches accordingly: per-installment table for Automatic, a
  simple component-totals summary for Manual (explicitly noted as not yet mapped to specific
  installments — that decision is deferred to whenever CP13 wiring reaches this screen).
- Mock/preview only, same as the rest of this screen — no `app/backend` change, no real posting.

### Loan Applications — attachments, AI summary, repeat-client detection
- Restricted Loan Application attachment file names to documents an applicant would actually
  submit at intake (photo, valid IDs, Employee ID, Corporate Payslip, Latest Proof of Billing,
  Driver's License, Passport, KYC/credit bureau report, and Seafarer-specific docs). Removed
  documents that only exist for an already-approved official loan account (Promissory Note, Deed
  of Assignment, Disclosure Statement, Loan Agreement, Special Power of Attorney, Data Privacy and
  Consent Form, Manulife insurance) — those now only ever appear on the Loan Account itself.
- Expanded the AI Risk Assessment output into a fuller summarized recommendation (still a static,
  hand-authored mock — explicitly labeled "not yet connected to an API for a real AI Assist
  engine").
- Added **Repeat Client detection**: the applicant detail page now shows a "Repeat Client" / "New
  Applicant" badge, and for repeat clients, lists their previous Easycash loan account(s) —
  clicking one opens its full repayment schedule (the "monthly payment report"). Added two
  demonstration scenarios: a good payer (loan paid in full, no late installments) and a delinquent
  one (loan written off, partial payment history, with a recorded reason). The AI summary
  references this payment history directly when present.

### Loan Application → Client → Loan Account workflow
- Added **profile pictures and uploaded-attachment lists** to Loan Applications and Client
  Details, sourced from real historical applicant folders under `legacy/sdevtech/` (per explicit
  instruction) — only a curated photo subset was copied into `public/applicants/`; attachment
  entries show file name/size only, never real document content, and "Download" stays disabled.
- Added a **"Create Client"** action on Approved applications (confirmation dialog required) that
  copies the applicant's profile picture, personal/contact info, address, and attachments into an
  official Client Details record.
- Added a **"Create Loan Account"** action on Client profiles (confirmation dialog required),
  gated to MIS / Loan Operation Manager / CRM. Enforces the business rule that a client may never
  have two simultaneously ACTIVE/ACTIVE_IN_ARREARS loan accounts.

### Activity Logs — broadened and access-restricted
- Activity Logs are now visible **only to MIS** (previously MIS + Loan Operation Manager).
- Every major section (Dashboard, Loan Accounts, Loan Applications, Client Data, Loan Products,
  Payment Recording, Reports, Payment Reminders, Member Details, and individual Loan
  Account/Application detail pages) now logs page views and shows a MIS-only "Recent Activity"
  panel (recent-to-oldest) at the bottom of the page.
- Logging extended to cover: viewing a section, adding a note, uploading/deleting an attachment,
  creating a client, creating a loan account, adding/editing an LMS member, and all existing Loan
  Application actions. Every entry now records both date and time.

### Loan Applications — review workflow safety and roles
- Added a **CRM** role (staff: Rosemarie Tenchavez) with the same Loan Application access as Loan
  Operation Manager (assign product sub-type, approve, decline) — but, like Loan Operation
  Manager, CRM can never revert a decision once made.
- Added a confirmation dialog before every Approve/Decline action (safety net against an
  accidental click) for CRM and Loan Operation Manager.
- Added an MIS-only **"Revert to Pending Review"** action on already-decided applications.
- Added a Gmail-style **Reviewed / Pending Review** toggle on the applications list — independent
  of the approve/decline decision — with per-row and "select all" bulk toggling.

## 2026-07-05

### Payment Reminders (new module)
- Added an automatic payment reminder schedule: 5 days before due, 3 days before, 1 day before,
  on the due date, and weekly while past due. Sent via SMS and Email (both simulated); a third
  channel — the client's own Easycash account dashboard — is always shown as "Coming Soon" since
  it depends on the not-yet-built public client portal.
- Added a system-wide "Payment Reminders" list page and a per-loan "Reminders" tab on the Loan
  Account Detail page, both with a Sent/Scheduled indicator and a full message preview (Client
  Name, Loan Account Code, amount due, payment progress, and penalty fees when past due).

### Loan Applications (new module)
- Added a Loan Applications list + detail flow representing intake from the future public
  Easycash loan-application website (not built yet). Each application carries a static AI Risk
  Assessment (Low/Medium/High) with a pass/fail factor breakdown (age 18–55, address, income,
  credit score, properties) and a plain-language recommendation, always labeled AI-assisted /
  human-decided, never autonomous.
- Staff (not the client) assign the specific product sub-type during review, before approving.
- Access restricted to MIS, Loan Operation Manager, and (later) CRM.

### Loan Products & account codes
- Restructured Loan Products to 3 active categories confirmed by the business: Salary Loan (3
  sub-types — Corporate Tie-up, Regular, Special/repeat-client discount), Business Loan (1
  sub-type), Seafarer Loan (1 sub-type). Loan Products list now groups sub-types under their
  parent category.
- Corrected the account-code convention to `{CATEGORY}-{SubType}_{4-digit sequence}` (e.g.
  `SL-Corp_0001`), sequential per prefix, matching the real legacy naming convention.

### Staff roster, roles, and account switching
- Replaced the placeholder staff roster with the confirmed real roster: Jomer A. Biason (MIS),
  Nomer D. Perez (MIS), Liezel Pentecostes (Loan Operation Manager), Mariel Deguzman (Finance),
  Kyla Sobel (Accounting), Rosan Cinco (Collection Officer).
- Replaced the abstract "Viewing as: Role" dropdown with a real **"Switch Account"** panel showing
  each named staff member (with a decorative, disabled username/password section) — selecting an
  account changes the signed-in identity and, live, what that account can access.
- Confirmed access policy: MIS is super user (all access, including reverting a Loan Application
  decision and managing LMS members); Loan Operation Manager/CRM get the same base access as
  Finance/Accounting/Collection Officer plus Loan Application access; Finance/Accounting/
  Collection Officer cannot access Loan Applications or manage members.

### Environment
- Fixed a dev-server port conflict (`.claude/launch.json` now uses `autoPort: true` instead of a
  hard-coded, `--strictPort` port) so a busy port no longer blocks the preview server from
  starting.
- Added `Run LMS Preview.bat` — a standalone script (double-click, no Claude Code required) that
  installs dependencies on first run, starts the Vite dev server in its own window, and opens the
  preview in the default browser.

## Earlier (pre-existing at start of this changelog)

The bulk of the UI preview (Dashboard, Loan Accounts list/detail, Client Data, Payment Recording,
Loan Products catalog, Reports, LMS Administration/Member Details/Activity Logs, Preview Mode
banner, light/dark theme, real company branding) was already built and verified working before
the entries above; see `docs/PROJECT_HANDOFF.md` for the separate `app/backend` implementation
history (unrelated track — the backend is not yet wired to this frontend).
