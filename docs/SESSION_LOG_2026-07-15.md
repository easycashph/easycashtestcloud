# Session Log — 2026-07-15

**Purpose:** plain-language record of this session, continuing from
`docs/SESSION_LOG_2026-07-14.md`. Written per the project's standing convention
(`CLAUDE.md` §Session Logs) so context is never lost between conversations.

---

## Dashboard: Portfolio Breakdown redesign (donut → proportional bars)

Continuing yesterday's Active/Past Due/Matured breakdown addition, iterated the visual design
live with the user through several rounds, each confirmed working before moving to the next:

1. Added the Active/Past Due/Matured split as text under each category (yesterday's work),
   committed as `32f6041`.
2. User asked for a mockup of a stacked-progress-bar treatment before implementing — built via the
   `visualize` tool (scratchpad HTML, rendered in the Browser pane), user picked a tighter/more
   compact variant. Implemented: hairline separators between categories instead of large gaps,
   colored percentage text (green/amber/red matching the bar segments) instead of long peso-only
   lines, bold total on the right. Committed `30abf15`.
3. Replaced the donut/pie chart entirely with horizontal bars whose *length* now encodes each
   category's share of the total portfolio (the pie's old job) while the bar's internal segments
   still encode Active/Past Due/Matured — recommended because a literal pie is weaker than a bar
   for comparing near-equal-sized categories, and because "Other (Legacy)" turned out to be a
   13-product grab-bag (CL/CM-Car/OFW/OTH-COMP/PFL/PL/REL/SP-*) the user asked about directly.
   Removed the now-unused `Pie`/`PieChart`/`Cell` recharts imports and `CHART_COLORS` constant.
4. Added peso amounts back into the per-segment breakdown line (mockup shown first, user picked
   "Option A" — same line, wrapping on narrow screens) and per-segment account counts
   (`activeCount`/`pastDueCount`/`maturedCount` added to `PortfolioCategorySlice`).

## Loan Portfolio Health: Venn drill-down status badge bug

User reported: clicking Good/In Arrears/Matured in the Venn diagram seemed to list the wrong
accounts. Investigation found the **list itself was always correct** (`buildRealPortfolioHealth`'s
good/arrears/matured split is mutually exclusive and live-computed) — the bug was that
`LoanDrillDownDialog`'s status badge falls back to the raw, legacy-migrated
`LoanAccount.status` field whenever `isMatured` is false, and that field never transitions in this
codebase. A loan the live computation correctly buckets as "Good" could still carry a stale
`ACTIVE_IN_ARREARS` status, making the list look wrong even though it wasn't. Fixed by overriding
each loan's *display* status to match the bucket it was actually classified into
(`good` → `ACTIVE`, `activeInArrears` → `ACTIVE_IN_ARREARS`) before handing rows to the dialog;
"Matured" needed no fix since `isMatured` already overrides the badge regardless of `status`.
Committed `4513b88`.

Also gave a design mockup (proportional single stacked bar + the same 3 summary cards, replacing
the two-circle Venn) after the user asked for suggestions — the Venn's "In Arrears" middle lens is
a fake mathematical overlap (a loan can't literally be both Good *and* Matured), which is
confusing, and circle sizes weren't proportional to the real (very uneven, 48 vs. 1192) counts.
**Not yet implemented** — user moved on to other work before deciding.

## Repayment Schedule investigation — found and fixed a second wave of data loss from the DB restore incident

User asked why `SML-REG_00376` had no Repayment Schedule tab content. Investigation chain:

1. Confirmed zero `repayment_schedules` rows for that loan, but a **real** legacy record exists in
   `repayments.bson` (₱136,113.48 principal due, unpaid) — not a documented "no legacy data" gap
   like the CP12 report's known 15-loan exclusion list.
2. Broader check found 6 ACTIVE loans total missing all schedule rows (`SML-REG_00372/00373/00376/
   00377`, `SML-QC_00027`, `SP-Easy_00001`) and the sitewide `repayment_schedules` count was 8,715
   vs. the CP12 report's documented 8,746 — this is the **same DB-restore-incident pattern** from
   2026-07-14 (`Sync Database From Export.bat` replacing schema+data with an older colleague
   snapshot), just not caught yesterday since the incident happened mid-session and this
   particular gap wasn't tested until today. Re-ran `migrate-repayment-schedules.ts` (idempotent) —
   restored to 8,742 rows.
3. Even after the schedule rows came back, `SML-REG_00376`'s `principalBalance` was still `0.00`
   despite a real, unpaid schedule amount — because this loan was never flagged
   `legacyBalanceDataMissing = true` (it had a *present*, if wrong, `0.00` snapshot from the
   original migration, not an absent one), so `recompute-active-loan-balances-from-schedule.ts`'s
   flag-scoped query skipped it.
4. Broader check for this pattern found **960** ACTIVE/ACTIVE_IN_ARREARS loans disagreeing with
   their schedule sum on at least one balance component — but per the CP12 report's own documented
   open question, most of this is *expected*, legitimate legacy-account-snapshot-vs-schedule
   disagreement (interest/penalty accrual timing), not a bug to silently overwrite. Narrowed to the
   **unambiguous** subset: exactly 6 loans where `principalBalance = 0` AND the schedule shows a
   real amount due AND zero paid (i.e. never computed at all, not a genuine disagreement) — found
   these are the same 6 loans from step 2. Wrote
   [scripts/recompute-zero-balance-loans-from-schedule.ts](../app/backend/scripts/recompute-zero-balance-loans-from-schedule.ts)
   (same `SUM(due)-SUM(paid)` formula as the existing recompute script, scoped to this narrow
   population instead of the flag), dry-run verified (6 to fix, 1 correctly skipped —
   `SML-REG_00294`, genuinely fully paid per its own schedule), then applied. Committed `54c4efe`.
5. Confirmed with the user afterward that **every** PENDING_APPROVAL/APPROVED/ACTIVE/
   ACTIVE_IN_ARREARS loan now has a Repayment Schedule; only one CLOSED legacy loan
   (`SL-LAZ_00004-LEGACY2`, ₱1,000) remains without one — matches the CP12 report's known,
   accepted "no legacy repayment history available" population, not a new gap.

**Deliberately left untouched, pending a business decision:** the other ~954 loans in the 960
figure (legitimate legacy-snapshot-vs-schedule disagreement) — this needs someone to decide which
source is authoritative before any further balance recomputation, per CLAUDE.md's "never fabricate
financial logic."

## Document Template Mapping: SML, SL, and BL product families

Continuing yesterday's finding that `document_template_mappings` was entirely empty (why optional
documents never appeared in the Documents card for any loan), user gave the business rules
directly, one product family at a time:

- **SML** (15 products, done 2026-07-14): Loan Agreement - Seafarer, Special Power of Attorney,
  Deed of Assignment - Borrower/Co-Borrower, Manulife.
- **SL** (12 products, today): Deed of Assignment - Salary, Loan Agreement - Salary. User also
  asked for Promissory Note/Disclosure Statement/Data Privacy Consent/Acknowledgement Receipt to
  apply here too — no mapping needed, since those 4 are already `isRequired = true` and apply to
  every product regardless of `DocumentTemplateMapping`.
  [scripts/map-sl-document-templates.ts](../app/backend/scripts/map-sl-document-templates.ts),
  committed `fdd3449`.
- **BL** (3 products): Manulife only.
  [scripts/map-bl-document-templates.ts](../app/backend/scripts/map-bl-document-templates.ts),
  committed `660b5a9`.

Total `document_template_mappings` now 102 (75 SML + 24 SL + 3 BL). Remaining ~28 non-SML/SL/BL
products (CL, CM-Car, OFW, OTH-COMP, PFL-*, PL-*, REL-REG, SP-*) still have zero
conditional-document mappings — not yet requested by the user for those families.

## Payment Reminders page: due-date range filter, totals row, layout, page size

Several small, independently-confirmed feature additions:

1. **Due Date range filter** — reused the existing `DateRangeFilter` component (already used by
   Dashboard/report pages), filtering client-side (the page already fetches the full
   `/payment-reminders` list, no backend change needed) on `dueDate` between `from`/`to`.
2. **Totals row** — sums Principal/Interest/Penalty/Fees/Total Amount Due across the *whole
   filtered result* (every page, not just the page currently shown), added under the table.
   Clarified to the user when asked: this total respects whatever search/status/date filters are
   currently active, not a fixed grand total.
3. **Alignment fix** — user flagged the filter bar looked misaligned (Search/Status had no label,
   so they sat at a different height than the labeled "From"/"To" date inputs, plus a large empty
   gap before the far-right "Columns" button). Gave Search and Status their own labels matching the
   date filter's style, aligned the whole row with `items-end`.
4. **Page size** 100 → 50 per user request.

Committed `819665f` (filter + totals + alignment) and `b8782e2` (page size).

## Report Generation feature — scoping discussion, not yet started

User wants to build Excel report generation/download, matching a set of real legacy reports they
have as `.xlsx` samples (`C:\Users\EASYCASH\Downloads\Reports\`, 11 files). Inspected each file's
actual header row structure directly (raw XML parsing, not a library) rather than guessing from
filenames alone. Found they group cleanly into what looks like the legacy system's own report menu
structure:

- **Accounting** (2): Aging Report (Current/1-30/31-60/61-90/91-120/121-150/150+ bucketed past
  due), Detailed Ending Current Balance (per-loan balance snapshot).
- **Collection** (7): Accounts with Past Due, Collection (paid-installment history), Expected
  Collection (×2, same structure), First Amortization (×2, same structure), Daily Collection Report
  (per-transaction, OR#/AR#/channel, month-scoped).
- **Operation** (1): Fully Paid Accounts.
- **Standalone**: Monthly Loan Releases (disbursement/origination report with full fee/rate
  breakdown per loan).

Recommended: generate server-side with `exceljs` (real `.xlsx` output — styling, currency
formatting, multiple sheets — not a client-side CSV shortcut), following the same Clean
Architecture pattern as the existing loan-document generation module (a new `reporting`-style
backend module, endpoint per report, `downloadFile()` on the frontend). Recommended building one
report fully end-to-end first per CLAUDE.md's incremental-work rule, then repeating the pattern —
user said they'd think about which report to start with; **nothing implemented yet**, this is
scoping only.

## Repeated origin/main merges

Same pattern as 2026-07-14 — pushed was rejected several times by the colleague's ongoing parallel
work; each time: fetch, `git diff --stat` to scope, trial merge (`--no-commit --no-ff`), confirm no
real conflicts (or resolve the rare one), full `npm install` + `prisma generate` + `tsc --noEmit`
(both apps) + backend test suite (stayed at the known 574/16 baseline throughout) + Docker rebuild,
then commit and push. Notable merges today: `4762e0b` (activated-schedule preview, disbursed status
relabel, payment/rate guardrails), `adad87a` (Portfolio Quality Metrics grid style — no real
conflict, since origin hadn't touched `PaymentRemindersPage.tsx` despite an initial diff-stat
suggesting otherwise; double-checked via `git diff <merge-base> origin/main -- <file>` before
trusting the auto-merge).

## Client/Loan Account deletion — discussed, not executed

User asked how to delete a client and loan account. Confirmed there's no in-app delete feature by
design (audit/append-only-ledger philosophy) — the only mechanism is the existing dev-only
`scripts/delete-test-records.ts` (matches "TEST" in borrower/application names, dry-run by
default). Ran it in dry-run to show the user exactly what it would find (1 loan application, 6
borrowers, 2 loan accounts — including `SP-Easy_00001`, one of the 6 loans just fixed earlier this
session). Flagged that risk explicitly and asked for confirmation before running `--apply`; user
said to hold off for now. **Not executed.**

## Transaction history sort order bug — diagnosed and fixed

User reported (in a separate, since-compacted conversation) that the `/loan-accounts/:id/transactions`
endpoint's ordering looked wrong — REVERSAL entries appearing above the REPAYMENT they reverse, even
though the REPAYMENT happened later. Root cause:

- `entryDate` on REPAYMENT transactions comes from the "Payment date" field, a **date-only** picker —
  so it's always stored at `00:00:00` regardless of what time the repayment was actually recorded.
- `entryDate` on REVERSAL transactions is the **real** timestamp of the reversal action (e.g.
  `06:28:14`).
- Sorting by `entryDate DESC` alone puts same-day REVERSALs (real time) above same-day REPAYMENTs
  (midnight), even when the REPAYMENT is chronologically the most recent ledger event.

**First pass** (committed `922f341`, pushed): added `createdAt` as a secondary sort key —
`orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }]` — in both
[PrismaLoanTransactionRepository.ts](../app/backend/src/modules/ledger/infrastructure/PrismaLoanTransactionRepository.ts)
(`findByLoanAccountId`) and
[PrismaReportingRepository.ts](../app/backend/src/modules/reporting/infrastructure/PrismaReportingRepository.ts)
(`listTransactions`). This fixed the originally-reported case but turned out incomplete.

**Second pass, same day**: user noticed REVERSAL and DISBURSEMENT rows still always sorted above
everything else in the loan detail Payment History tab. Root cause the first pass missed: REPAYMENT
isn't the only type with a peculiar `entryDate` — REVERSAL's (`reversedAt`, defaults to `new Date()`)
and DISBURSEMENT's (`activatedAt`) both carry a **real time-of-day**, while REPAYMENT's stays pinned
at midnight. The `createdAt` tiebreaker never even gets consulted, because raw `entryDate` comparison
alone already resolves same-day ordering in REVERSAL/DISBURSEMENT's favor (any non-midnight time
beats midnight on the same calendar day) — no ties to break.

**Real fix**: truncate `entryDate` to the calendar day for the *primary* sort key (raw SQL —
Prisma's `orderBy` can't express `DATE()` truncation), so same-day transactions of any type tie
there and `createdAt` (the one universally reliable "when this was actually recorded" timestamp)
decides the order within a day; cross-day ordering (a backdated transaction) is unaffected. Applied
to the same two methods, both rewritten to run a raw `SELECT id ... ORDER BY DATE("entryDate") DESC,
"createdAt" DESC, id DESC` (with the existing branch/type/date-range/cursor filters translated to SQL
`Prisma.sql` fragments) and reorder a normal `findMany({ where: { id: { in } } })` to match — same
"fetch ordered ids, then findMany + reorder" pattern already used elsewhere in this codebase
(`PrismaLoanAccountRepository`, `PrismaDashboardRepository`), rather than hand-mapping raw rows.
Cursor pagination reimplemented as a keyset tuple comparison
(`(DATE(entryDate), createdAt, id) < (cursor's own values)`) instead of Prisma's built-in
`cursor`/`skip`, since that only works with Prisma's own `orderBy`.

Verified against `SML-REG_00362`: the two REVERSALs (created 06:28:04/06:28:14) now sort correctly
interleaved with same-day REPAYMENTs by real creation order, not pinned above all of them.
`PrismaLoanTransactionRepository.test.ts` rewritten for the new raw-SQL/id-reorder contract (7/7
passing); full suite back at the known 576/16 baseline (two extra passes vs. the prior 574 from the
newly-added allocation-visibility work). Backend rebuilt; both affected routes confirmed still
registered (401, not 404/500).

## Repayment Schedule table: Total Due column, Paid/Balance fees+penalty bug

User asked to add a "Total Due" column (Principal + Interest + Fees + Penalty due) after Penalty Due
in `LoanDetailPage`'s Repayment Schedule table — mocked up first via the `visualize` tool, approved,
then implemented (uses the same live `currentPenaltyOwed`/ADR-050 logic as the existing Penalty Due
column). Committed `7c3a2e4`.

While explaining the new Balance column's "cumulative paid" formula, found (and the user then spotted
independently in a screenshot) that **Paid and Balance only ever summed `principalPaid +
interestPaid`** — never `feesPaid`/`penaltyPaid`, even though the API already returns both. Effect: an
installment fully paid *including* a fee or penalty component still showed a smaller "Paid" than its
new "Total Due" (looked incomplete when it wasn't), and the running Balance column stopped decreasing
once a payment touched fees/penalty (reproduced live: `SML-REG_00359`'s Balance stuck at ₱99,244.44
across all 4 rows after a ₱35,215.77 payment that included a ₱3,201.43 penalty). Fixed both to sum all
four `paid` components. Committed `922f341` alongside the sort-order fix (same commit, same file).

## Payment allocation visibility: three linked features (#1 Remaining column, #2 allocation
## breakdown, #3 post-payment confirmation)

User asked why the "Due" columns never decrease after a payment (by design — `due` is immutable,
REPAY-3 — but the real gap was "no visibility into which installment(s) a payment actually hit").
Discussed the current state (no waive/reduce-penalty feature exists yet either — flagged as a future
ADR, not built this session), then scoped three additive UI features, each mocked up via `visualize`
and approved before implementation:

1. **Remaining column** (`LoanDetailPage`, Repayment Schedule tab) — `Total Due − Paid` per row and in
   the Total row, amber/bold when > 0, muted when settled.
2. **Payment allocation breakdown** (`LoanDetailPage`, Payment History tab) — REPAYMENT rows are now
   expandable (chevron, click-to-toggle); expanding shows which installment(s) the payment hit and the
   exact fees/penalty/interest/principal split per installment. Backend: the `payment_allocations`
   table already existed (written since the 2026-07-11 Reverse Payment feature, but only ever read
   internally by `ReversePaymentUseCase`) — added a read side: new
   [ListPaymentAllocationsForTransactionUseCase](../app/backend/src/modules/ledger/application/use-cases/ListPaymentAllocationsForTransactionUseCase.ts),
   `GET /transactions/:id/allocations` (branch-scoped, H-1), and
   [PaymentAllocationPresenter](../app/backend/src/modules/ledger/interface/http/presenters/PaymentAllocationPresenter.ts).
   Migrated/legacy REPAYMENTs (predate allocation recording) show an explanatory empty state instead
   of an error.
3. **Post-payment confirmation dialog** (`PaymentRecordingPage`) — replaces the previous silent
   `setConfirmOpen(false)` on success with a dialog showing the applied amount, per-installment
   allocation table, an overpayment warning if `remainder > 0`, and the new loan balance, with
   "Record another payment" / "View loan" actions. Backend: `ProcessPaymentUseCase.execute()` now
   also returns `appliedAllocations` (enriched with installment number/due date), threaded through
   `ProcessPaymentResult` → the payments controller → `ProcessPaymentResponse`.

Backend `tsc`/tests clean (574/16 baseline — one controller test updated for the new
`appliedAllocations` field). Frontend `tsc`/tests clean. Both containers rebuilt; DB-level
verification only (`payment_allocations` joins confirmed correct on `SML-REG_00362`; new route
confirmed registered via 401/404 probe) — could not exercise the UI directly (no login credentials
in this environment). Committed `7c3a2e4` (Total Due) is separate from this feature set, which is
**not yet committed** — see below.

### Caught immediately by feature #3: a real cashier-error case

First live use of the new confirmation dialog caught a real discrepancy on `SML-REG_00378`: user
intended to record ₱500.00 but the dialog showed ₱499.98 was actually applied. Verified against the
DB this was genuine (not a display bug — `loan_transactions.amount = 499.98`,
`interestComponent = 499.98`, matching `repayment_schedules` installment #2's `interestPaid`), so the
amount field itself held 499.98 at submit time (input has no hidden rounding/clamping — root cause of
*why* the field held that value wasn't pinned down: no browser access to reproduce; possibilities
noted to the user were a leftover unclearsed value or a `step="0.01"` scroll-on-focus nudge on the
`<input type="number">`). Reversed via a one-off script (`npx tsx`) that called the real
`ReversePaymentUseCase` directly (same primitive the UI's "Reverse" button uses) rather than raw SQL —
kept the ledger's `reversesTransactionId` link and audit log intact. Verified: REVERSAL transaction
correctly linked, installment #2 back to `interestPaid = 0.00` / status `PENDING`. Script deleted
after use (one-off, not a repeatable maintenance script).

## Current state

- Working tree clean; Docker stack (`postgres`, `backend`, `frontend`) running locally, in sync
  with `origin/main` as of `660b5a9`.
- Known follow-ups (carried over, still unresolved):
  - Two independent Note systems still coexist in the backend (`loan-note` vs `profile-note`
    module) — needs a product decision on which is canonical.
  - Duplicate `LocalFileStorage` in `@shared/infrastructure` and `@modules/document/infrastructure`.
  - 16 pre-existing backend test failures in `loan-application`/`borrower` modules — should be
    reported to the colleague, not fixed blind.
  - **~954 loans with legitimate legacy-snapshot-vs-schedule balance disagreement** — needs a
    business decision on which source is authoritative before touching further (see above).
  - `DocumentTemplateMapping` still empty for ~28 non-SML/SL/BL loan products.
  - `ACKNOWLEDGEMENT_RECEIPT.docx` deliberately has no placeholders yet (mostly manual/paper data
    not tracked in this system) — user's choice, not a gap to close.
  - `DISCLOSURE_STATEMENT`'s "Effective Interest Rate" (§5) placeholder still not added in Word
    (likely just needs `{InterestRate}` per ADR-010, not a new backend field — unconfirmed).
  - Loan Portfolio Health Venn → proportional-bar redesign: mockup shown and liked in concept, not
    yet implemented.
  - Report generation (Excel): scoped (11 sample reports categorized), no code written yet -
    waiting on the user to pick which report to build first.
  - Pending user decision: whether to run `delete-test-records.ts --apply` against the 6 borrowers
    / 2 loan accounts / 1 loan application identified as test data.
  - **Transaction history sort bug**: fixed and committed (`922f341`) — see above.
  - **Payment allocation visibility (#1/#2/#3)**: implemented and verified at the DB/API level this
    session but **not yet committed** — needs a commit (and ideally a real UI walkthrough once login
    access is available) before it's considered done. See above for full scope.
  - **No waive/reduce-penalty feature yet.** Discussed with the user; would need its own ADR (who can
    waive, partial vs. full, approval thresholds, whether it applies to already-paid penalty) before
    implementation — not started.
