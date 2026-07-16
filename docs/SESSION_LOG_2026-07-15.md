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

## Payment Recording: "Next due" summary, confirmation-dialog "Close" behavior

User asked to show what's due next on the Payment Recording page (so a cashier doesn't need to leave
the page to check), and reported the summary wasn't refreshing after using the confirmation dialog's
"Record another payment" button — only a full page reload showed the update. Chain of changes:

1. Added a "Next due" line (oldest unpaid installment, remaining amount) to the loan summary card,
   next to Collections/Accounting balance.
2. First fix attempt: switched the post-payment cache refresh from `invalidateQueries` to
   `refetchQueries` (forces an immediate network refetch rather than only marking the query stale).
   Committed `9375a30`. User reported it still didn't show up even after this.
3. Confirmed via the browser's fetched JS bundle that the deployed code *did* contain both the new
   "Next due" string and `refetchQueries` call — ruled out a stale-build/cache-serving problem.
4. Added explicit loading/error/empty states to the "Next due" block (previously silently rendered
   nothing on any of those three conditions, making a real failure indistinguishable from "nothing
   due") so a future report would surface *why* instead of just "it's blank" — but before that
   diagnostic path was exercised further, the user decided to simplify instead.
5. **User's actual resolution**: remove "Record another payment" entirely. Replaced with a **Close**
   button that calls the existing `changeClient()` handler (resets `selectedBorrower`/`loanId`/search)
   so it returns straight to the client-search step for the next transaction, instead of trying to
   keep the same loan's form usable in place. Sidesteps the refresh-reliability question entirely
   rather than continuing to chase it.

Root cause of the original refresh issue was **not conclusively diagnosed** — plausible candidates
noted (query-key mismatch, an unobserved fetch error, a race with dialog-close timing) but not
confirmed against live data (no login access in this environment). Worth revisiting if "Next due"
turns out to have the same staleness problem on ordinary loan selection (not just post-payment) once
someone can drive the UI directly.

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

## Report generation: Loan Releases Report (first of 11 scoped legacy reports)

Picked up the report-generation feature scoped-but-not-started earlier this session (11 legacy
`.xlsx` samples, `C:\Users\EASYCASH\Downloads\Reports\`). Started with **Monthly Loan Releases**,
per CLAUDE.md's incremental-work rule (one report fully end-to-end before repeating the pattern).

1. **Column mapping** — parsed the legacy `Monthly-Loan-Releases (2).xlsx` sample directly (raw
   OOXML `sharedStrings.xml`/`sheet1.xml`, via a Node one-liner, not a library) to get the exact
   28-column header order and sample values. Mapped every column against the current schema; most
   matched existing `LoanAccount` fields exactly (`netProceeds` → "Total Net Amount",
   `outstandingBalancePayoff` → "Outstanding Loan Balance", `docStampFee` → "Documentation Fee",
   confirming those fields' own doc comments). Two columns (`Nth Loan`, `New/Renew`) had no explicit
   schema field — asked the user rather than guessing (CLAUDE.md "never invent business rules"):
   confirmed `Nth Loan` = `Borrower.loanCycle`, `New/Renew` = "Renew" when `loanCycle > 1` else
   "New". Confirmed scope: date-range filter on Disbursement Date, `.xlsx` via `exceljs` in a new
   `reporting`-module read path (not a new module).
2. **Backend**: `LoanReleaseReportRow` + `getLoanReleasesReport()` added to `IReportingRepository`;
   implemented in `PrismaReportingRepository` (bulk-fetch address/schedule rows, same
   fetch-then-group pattern as `PrismaBorrowerRepository` — `Address` has no Prisma relation,
   polymorphic `ownerType`/`ownerId`). New `ExcelJsLoanReleasesReportWriter` (real `.xlsx`, currency/
   date formatting, totals row with `SUM()` formulas) — installed `exceljs` (`^4.4.0`). New route
   `GET /reports/loan-releases.xlsx?from=&to=`.
3. **Frontend**: new `LoanReleasesReportPage` — date range filter + "Download report" button
   (`downloadFile()`, same pattern as loan document downloads), no in-page table since the whole
   point is the downloadable file.
4. **Verification** (no login access): wrote a one-off script calling the real use case + writer
   directly against live data — confirmed against **1,784 real disbursed loans**, header order
   exactly matches the legacy file, `New/Renew`/`Nth Loan` derivation correct (spot-checked a
   `loanCycle=3` loan → "Renew"), totals row formulas present. Script deleted after use. Noted but
   did not fix: some borrowers' addresses show raw PSGC codes instead of decoded names (pre-existing
   data-quality issue, same one `fix-coded-addresses.ts` was written for — only affects some rows).

## Reports navigation: hub page + Dashboard preview cards

User anticipated sidebar clutter as more of the 11 reports get built and asked for a better
structure — mocked up (via `visualize`) and approved before implementing:

1. **Reports hub** (`ReportsHubPage`, route `/reports`) — replaces the 4 individual sidebar report
   links with one "Reports" entry. Cards grouped into categories mirroring the legacy system's own
   report menu (discovered while categorizing the 11 samples): **General** (the 3 pre-existing report
   pages, not 1:1 legacy replacements), **Accounting**, **Collection**, **Operation**. Live reports
   are clickable; the 7 not-yet-built ones show a "Coming soon" badge, non-clickable.
2. **Dashboard preview cards** — user pointed out Loan Report/Collection Report are chart-heavy and
   asked about surfacing them on the Dashboard instead. Recommended (and the user agreed, after
   seeing a full-dashboard-context mockup) a middle ground over a full move: small sparkline preview
   cards (last 30 days, no axes/table/filters) with a link to the full report, added to
   `DashboardPage` as a new "Reports" card, reusing the same DAILY endpoints
   `LoanReportPage`/`CollectionReportPage` already call — no new backend work. Added English/Filipino
   translation keys for the new labels.

Both frontend-only; backend/frontend `tsc`/tests clean throughout. Verified by inspecting the served
JS bundle for the new strings (no login access this session either).

## Reduce Penalty feature (previously scoped-but-unstarted, revisited and built)

Picked up the waive/reduce-penalty request flagged earlier this session as needing its own design
pass. Confirmed every business rule with the user before writing code (CLAUDE.md "never invent
business rules") rather than assuming:

- Who: the Accounting Officer — mapped to the seeded `Accounting` role (plus MIS, per this
  codebase's standing "MIS is in every allow-list" convention).
- Approval: happens *outside* this system (a branch manager memo, etc.) — this feature records the
  reference in a required `reason` field, it does not run its own in-app approval workflow.
- Scope: partial or full (down to ₱0) reduction; never above what's currently owed.
- Cannot reduce a penalty component that's already been paid (a refund/credit decision, explicitly
  out of scope).
- **Critical clarification that changed the design**: after a reduction, does the penalty resume
  growing the next day per ADR-050's live daily formula, or stay frozen? Confirmed: **frozen** —
  once reduced, an installment's penalty is a static manual override until paid or reduced again,
  not a one-time subtraction from that day's live figure. This is why the implementation stores a
  persistent override rather than applying a delta.
- UI placement: iterated through three mockups with the user (inline "Waive" link → renamed
  "Reduce" with a "new amount" field instead of "amount to subtract" → finally an "Actions" dropdown
  per row, with "Adjust Fees" alongside as a disabled "Coming soon" placeholder) before writing any
  code.

**Backend**: `RepaymentSchedule` gained `penaltyOverride{Amount,Reason,ByUserId,At}` (the current/
latest override, mutable) plus a new immutable `PenaltyReduction` audit table (one row per action,
preserves full history across repeated reductions) — additive-only Prisma migration
(`20260715131429_add_penalty_reduction`), verified via `prisma migrate status`/inspecting the
generated SQL (only `ADD COLUMN`/`CREATE TABLE`, no drops). **Caught and fixed a self-inflicted bug
during this migration**: an early schema edit accidentally deleted `RepaymentSchedule.legacyId`/
`createdAt`/`updatedAt` while inserting the new fields — `prisma migrate dev` correctly refused to
run non-interactively and warned it would drop those columns (8742 non-null values); caught before
any data loss, fields restored, re-ran cleanly. `RepaymentInstallment.reducePenalty()` (domain
entity) enforces every confirmed rule; extracted the ADR-050 rate/grace-period logic out of
`RepaymentInstallmentPresenter` into a new shared `CurrentPenaltyResolver` so the presenter (display)
and the new `ReducePenaltyUseCase` (validation ceiling) can't drift on what "currently owed" means.
New `PenaltyReduction` domain entity + repository, `POST /repayment-installments/:id/reduce-penalty`
gated to `MIS`/`Accounting`.

**Frontend** (`LoanDetailPage`, Repayment Schedule tab): new "Actions" column (Accounting/MIS only),
per-row dropdown with "Reduce penalty" (disabled once paid or already penalty-paid) and "Adjust
fees" (permanently disabled, "Coming soon"). Reduce Penalty dialog: new-amount input pre-filled with
the current penalty, a "Set to ₱0.00" shortcut, required reason field. `isLivePenalty` is now an
explicit presenter field (previously the frontend inferred it from `currentPenaltyOwed !== null`,
which broke once an override could also make that non-null) so the "(as of today)" label only shows
when actually live-computed, not frozen.

**Testing**: 9 new backend unit tests (6 on the domain entity's `reducePenalty()` — freeze
behavior, zero/full waive, ceiling rejection, negative rejection, already-paid rejection, latest-
reduction-wins; 3 on the presenter's override path) all passing; full suite back at the known
576/16 baseline. Frontend `tsc`/tests clean. Both containers rebuilt; route confirmed registered
(401, not 404); schema/migration confirmed additive via raw SQL inspection. **Deliberately did not**
exercise a real reduction against live migrated-loan data as part of verification — no prospective
(non-migrated) loan currently has a live nonzero penalty to test against, and mutating a real
client's penalty purely to prove the wiring works, unrequested, was judged out of proportion to the
risk; relied on the unit coverage instead. A real click-through (and a first real reduction) is
worth doing once login access is available.

## Report generation, continued: Reduce Penalty feature name display

Small follow-up after the Reduce Penalty feature (see its own section above) shipped: the Loan
Detail page showed "Reduced by Accounting" (the role) instead of the actual staff member's name.
Fixed by joining `penaltyOverrideByUserId`'s name in the repository's read path
(`findById`/`findByLoanAccountId`), same pattern already used by
`PrismaGeneratedLoanDocumentRepository.generatedByName` — a display-only
`PenaltyOverride.byName`, never touched by `reducePenalty()`'s write path. Now reads "Reduced by
{actual name}", falling back to "Accounting" only if the name somehow doesn't resolve. Backend/
frontend `tsc`/tests clean (updated two existing tests for the new field); containers rebuilt,
route/bundle re-verified. Committed `0338f90`.

## Legacy data investigation: Net Proceeds / Anticipated Disbursement Date, and a real migration gap found

User asked to check the legacy MongoDB export (`legacy/MongoDB dump/extracted/07092026_ 92543/
db-easycash/`, NOT `legacy/db-exports` which is actually a Postgres backup of *this* system, not
SDevTech source) for where Net Amount/Proceeds and Anticipated Disbursement Date live.

**Findings:**
- `monthly_loan_releases` collection has `totalNetAmount` — confirmed exact source of the Excel
  report's "Total Net Amount" column (verified the formula: loanAmount − sum of fees = totalNetAmount
  for the sample row), matching our existing `LoanAccount.netProceeds`.
- `document_templates`' Disclosure Statement HTML uses a Mambu merge-field `NET_LOAN_DISBURSED` for
  "3. NET PROCEEDS OF LOAN" — same concept, computed at doc-gen time in the legacy system.
- `loan_accounts.expectedDisbursementDate` / `disbursements.expected_disbursement_date` — confirmed
  source of `LoanAccount.anticipatedDisbursementDate`.
- **Bonus finding, corrects an earlier "unconfirmed" note**: the same Disclosure Statement's
  "5. EFFECTIVE INTEREST RATE" section uses `CF:8a8e8f5e604d6aff01604eb4d8590425` — a genuine Mambu
  custom field (3,501 populated records in `custom_field_values`, values like 12.12%/12.75%/9.62%,
  distinct from and higher than `contractualInterestRate`). The earlier assumption ("likely just
  needs `{InterestRate}` per ADR-010, not a new field") was **wrong** — this is real, unmigrated
  legacy data with no current schema field. Flagged, not yet actioned.

**Follow-up question this surfaced, investigated and fixed**: user asked whether interest-rate
fields are as blank in our system as legacy's own gaps. Checked both sides:
- Legacy `loan_accounts`: `interestRate` always populated (1805/1805); `addOnRate` only for
  622/1805 (34%) — no separate "contractual rate" field exists at all in the source.
- Our DB: `interestRate` correctly 100% migrated (1784/1784) — this is the field
  `ActivateLoanUseCase` actually uses to run the amortization schedule
  (`monthlyContractualRate = loanAccount.interestRate`), so no calculation-engine impact from any of
  this. But `addOnInterestRate`/`contractualInterestRate` (display-only fields — Create Loan Account
  form, Loan Releases Report columns) had only **1** row populated out of 1,784 — and that one row
  turned out to be the user's own test loan (`SML-REG_00378`, no `legacyId`), not a real migrated
  record. **Root cause**: `migrate-legacy-data.ts`'s loan account `create` payload never set either
  field at all — confirmed by reading the script directly, not inferred.

**Fix**: new `scripts/backfill-loan-interest-rates.ts` (kept, not one-off — same precedent as other
retained backfill scripts), two backfills per the user's explicit decision:
1. `addOnInterestRate` ← legacy `addOnRate`, keyed by `legacyId` — 611 of 622 legacy-sourced values
   applied (11 belonged to loans that were themselves skipped during the original migration, e.g.
   unresolved borrower — consistent, not a new gap). ~1,172 loans remain null because legacy itself
   has no value for them — not fabricated.
2. `contractualInterestRate` ← straight copy of that loan's own `interestRate` (legacy has no
   separate source; the real contractual rate already migrated correctly into `interestRate`) — all
   1,783 migrated loans backfilled.

Dry-run verified before `--apply`; DB re-checked after (`addOnInterestRate` 1→612,
`contractualInterestRate` 1→1,784, sample rows spot-checked). `tsc` clean. Committed `1889ba0`.

### Follow-up: post-restore reminder, and one false lead ruled out

Two small closes on the backfill above:

1. **`legacy\Sync Database And Apply Migrations.bat`** restores a colleague's `pg_dump` with
   `--clean` (wipes local data) then re-applies Prisma migrations — it already reminded the user to
   re-run a couple of named one-time data scripts after a restore, but didn't mention today's new
   `backfill-loan-interest-rates.ts`. Same failure class as the DB-restore incidents noted in
   earlier session logs (local-only backfilled data silently lost on the next sync). Added it to the
   reminder list. Committed `f4fd6ca`.
2. User asked whether a broader `addOnRate`-family field exists elsewhere in the legacy export.
   Found `loan_products.addOnRates` (plural) in a raw grep, but on inspection it isn't a real
   field at all — it's the literal corrupted-JSON-fragment text already documented in
   `migrate-legacy-data.ts`'s `KNOWN_CORRUPTED_PRODUCT_NAMES` comment (one product, `CM-Car`, whose
   `name` field ended up as the literal string `"addOnRates:[1.75"` from a legacy CSV-import bug;
   zero real loans use that product). Confirmed there is no second, more-authoritative add-on-rate
   source being missed — `loan_accounts.addOnRate` (already backfilled) is the only real one.

## Adjust Fees feature (second half of the Actions dropdown, "Coming soon" → live)

Picked up the "Adjust fees" placeholder left disabled in the Reduce Penalty work — same UI slot,
same confirm-business-rules-first process. Confirmed with the user before coding:

- Who: same Accounting/MIS roles as Reduce Penalty.
- **Bidirectional** — may raise OR lower the fees due, unlike Reduce Penalty (which can only lower).
  Non-negative is the only ceiling.
- Cannot adjust an installment whose fees have already been paid — same rule/rationale as Reduce
  Penalty's already-paid-penalty restriction.
- Same required `reason` field convention (external approval reference, not an in-app workflow).

**Design difference from Reduce Penalty, worth noting**: penalty needed a "frozen override vs. live
ADR-050 daily formula" distinction because penalty genuinely recomputes over time. Fees have no such
live-computation concept at all (`due.fees` is already a static, immutable snapshot) — so
`RepaymentInstallment.effectiveFeesDue` is simply "the override if one's set, else `due.fees`", no
separate "is this live" flag needed the way `isLivePenalty` was for penalty.

**Backend**: same architecture as Reduce Penalty, one-to-one — `RepaymentSchedule.feesOverride*`
(current override, mirrors `penaltyOverride*`) plus an immutable `fee_adjustments` audit table
(mirrors `penalty_reductions`). New `FeeAdjustment` domain entity/repository,
`RepaymentInstallment.adjustFees()`, `AdjustFeesUseCase`, `POST /repayment-installments/:id/
adjust-fees` (same `MIS`/`Accounting` gate). New Prisma migration
(`20260716003024_add_fee_adjustment`) — purely additive, double-checked this time given the earlier
accidental-deletion incident from the penalty migration.

**Frontend**: reused the same "Actions" dropdown column from Reduce Penalty (renamed the shared
visibility flag `canReducePenalty` → `canManageInstallments` since it now gates two actions, not
one) — "Adjust fees" is no longer permanently disabled; per-row enablement checks `status !== 'PAID'
&& feesPaid === 0`. Fees Due column, and every Total Due/Remaining/Balance calculation across the
table, now reads the effective (override-aware) fees value instead of the raw immutable `due.fees`.
New dialog mirrors Reduce Penalty's (new-amount input, "Set to ₱0.00" shortcut, required reason) —
no "must not exceed" ceiling messaging since this one is bidirectional.

**Testing**: 12 new backend unit tests (6 on `adjustFees()`/`effectiveFeesDue`, 2 on the presenter's
`currentFeesDue`/`feesOverride` fields, plus repository include-clause assertion updates) all
passing; full suite back at the known 595/16 baseline. Frontend `tsc`/tests clean. Verified the read
path against a real installment with real unpaid fees (`SML-MAX_Q0F5H` installment #5, ₱1,101.47)
via a one-off read-only script (deleted after use) — deliberately did **not** perform a real
adjustment against live client data just to prove the write path, same judgment call as the Reduce
Penalty verification. Backend container rebuilt; route confirmed registered (401, not 404).

## Unified Payment History timeline: penalty reductions + fee adjustments now visible there

User asked whether reduction/adjustment events should also show in Payment History, not just as the
"latest override" annotation on the Repayment Schedule table (which silently loses history if the
same installment is adjusted more than once). Agreed after a mockup: yes, but as a UI-level merge,
not by faking `LoanTransaction` rows — these events have no ledger/balance impact.

**Backend**: added `findViewsByLoanAccountId()` to both `IPenaltyReductionRepository`/
`IFeeAdjustmentRepository` — returns a display-oriented view (not the domain entity) joined with the
installment's number/due date and the acting user's name, via Prisma's nested-relation `where`
(`repaymentInstallment: { loanAccountId }}`) rather than N+1 lookups. New
`ListInstallmentAdjustmentsForLoanUseCase` merges both view lists and sorts newest-first. New
`presentInstallmentAdjustment` flattens the tagged union (`PENALTY_REDUCTION` | `FEE_ADJUSTMENT`)
into one JSON shape. New endpoint `GET /loan-accounts/:id/installment-adjustments` (same H-1 branch
check as the sibling repayment-schedule endpoint). 3 new unit tests (merge, sort, empty-list); full
suite still at the known 598/16 baseline (net +3 vs. 595 from Adjust Fees).

**Frontend**: `LoanDetailPage`'s Payment History tab now fetches this new endpoint alongside
`transactions` and merges both into one chronologically-sorted list at render time
(`paymentHistoryRows`). Adjustment rows render with a distinct accent-tinted style (no chevron/
allocation breakdown — nothing to expand), showing the previous→new amount, which installment, who,
and the reason. (Caught and fixed a `colSpan` miscount while building this — the placeholder cell
needed to span 6 columns, not 4, to keep the Amount/Balance/Comment columns aligned with the header;
also discovered the CDS "pro" purple accent color referenced during mockup design doesn't exist in
this app's actual Tailwind config, so used the existing `primary` accent instead, matching the
"Reduced by X" annotation's own color.)

**Verification**: confirmed via a one-off read-only script against **real production data the user
had already generated by testing the features live** (`SL-CORP_00086`'s penalty reduction,
`SP-Easy_00001`'s fee adjustment, both by "Nomer Perez") — the merge/join/name-resolution all worked
correctly against real rows, not just fixtures. Backend rebuilt; route confirmed registered.

## Payment History invalidation bug + Adjust Fees not syncing to loan-level balances

User reported: adjusted both penalty and fees on `SML-REG_00210` but neither showed up in Payment
History. Two separate, unrelated bugs found during investigation:

1. **Cache invalidation bug (frontend-only).** Confirmed via direct DB query that both writes had
   actually succeeded (`penalty_reductions`/`fee_adjustments` rows existed for installment #3).
   `onActionSuccess` in `LoanDetailPage.tsx` — the shared success handler for Reduce Penalty,
   Adjust Fees, Reverse Payment, and Record Payment — invalidated `loan-account`, `loan-accounts`,
   `repayment-schedule`, and `loan-transactions` query keys, but never the newly-added
   `installment-adjustments` key the unified timeline (previous section) reads from. Fixed by
   adding that key to the list. One-line fix, no schema/use-case changes.

2. **Adjust Fees never synced `LoanAccount.balances` (real financial-correctness bug, found while
   investigating #1).** User asked directly: "hindi ba kailangan mag adjust din yung Balance
   After?" — prompted a deeper investigation (dispatched to an Explore subagent) into whether
   `loan.balances.penaltyBalance`/`feesBalance` and the derived `accountingBalance`/
   `collectionsBalance` (the loan-summary MiniStat cards) reflect Reduce Penalty / Adjust Fees.
   They did not: neither use case ever called `loanAccountRepository.save()` — `AdjustFeesUseCase`
   didn't even look up `LoanAccount`, and `ReducePenaltyUseCase` only read it for ADR-050 context.
   The Repayment Schedule tab was already correct (built on `currentFeesDue`/`currentPenaltyOwed`
   from the presenter) — only the loan-level summary balances were stale.
   - **Penalty and fees turned out NOT to be symmetric.** `due.fees` (backing `feesBalance`) is a
     frozen figure — safe to sync 1:1. `due.penalty` is only frozen for **migrated** loans; for
     **prospective** loans, ADR-050's live daily-accrual formula was *never* written back to
     `LoanAccount.penaltyBalance` in the first place (a separate, pre-existing gap unrelated to
     Reduce Penalty) — so naively subtracting a Reduce Penalty delta from `penaltyBalance` would
     produce a wrong number, not a corrected one, since the live-grown amount was never added to
     that balance to begin with.
   - **User-confirmed scope** (asked via `AskUserQuestion` rather than guessing, per CLAUDE.md):
     sync fees now; leave `penaltyBalance` sync out of scope, carried as a known follow-up below.
   - **Fix**: new `LoanAccount.adjustFeesBalance(delta)` domain method (mirrors `applyPayment()`'s
     shape — moves `feesBalance` and `feesDue` together, leaves principal/interest/penalty
     untouched). `AdjustFeesUseCase` now loads `LoanAccount`, calls
     `loanAccount.adjustFeesBalance(previousFees.subtract(newAmount))`, and saves it inside the
     same `unitOfWork.run()` block as the installment/audit-row writes. 4 new unit tests on
     `LoanAccount.test.ts` (lower/raise delta, other balances untouched, `updatedAt`). Full backend
     suite still green (94/94 in the touched files; no change to the known 16 pre-existing
     unrelated failures elsewhere).
   - **Backfill**: two loans already had live Adjust Fees writes made before this fix landed
     (`SML-REG_00210` installment #3, ₱0→₱100; `SP-Easy_00001` installment, two adjustments
     ₱0→₱100→₱200). Backfilled both via a direct SQL `UPDATE` on `feesBalance`/`feesDue` after
     confirming the exact delta from `fee_adjustments` — user confirmed both, one at a time.
     `SML-REG_00210` now `feesBalance`/`feesDue` = ₱100.00; `SP-Easy_00001` = ₱200.00.

3. **Payment Recording never allocated against a penalty/fee override either — the deepest of the
   three bugs, since it affects real money, not just display.** User asked directly: "bakit kapag
   pumunta ako sa payment recording old amount pa rin na hindi adjusted?" Two layers found:
   - **Frontend display/auto-fill**: `PaymentRecordingPage.tsx`'s `remainingDue()` computed
     penalty/fees straight from raw `i.due.penalty`/`i.due.fees`, same class of bug as #2 — fixed
     to use `i.currentFeesDue`/an override-aware penalty fallback, also fixing the duplicate inline
     calc feeding `previewCrossInstallmentAllocation` (the automatic-allocation preview) and the
     Manual tab's per-field labels (all three read through the same `remainingDue()` helper).
   - **Backend allocation engine (the real bug)**: dispatched an Explore subagent to check whether
     `ProcessPaymentUseCase`'s actual money-allocation math (`toRemainingDue()`, feeding
     `PaymentAllocationService.allocate()` and the Manual-mode validation ceiling) reads override-
     aware amounts. It did not — `installment.due.penalty`/`due.fees` directly, ignoring
     `penaltyOverride`/`feesOverride`/`effectiveFeesDue` entirely, and `RepaymentInstallment.
     recordPayment()` performs no cap/validation of its own either. **Real-money consequence**: a
     payment on an installment Reduce Penalty or Adjust Fees had already touched would still get
     soaked up by the stale original (higher) penalty/fees tier instead of the actual reduced
     amount, misallocating what should have gone to interest/principal.
   - **First fix attempt introduced a regression, caught by `GoldenMasterReplay.test.ts` (3
     failures).** Initially added `resolveEffectivePenaltyDue()` mirroring the *display* layer's
     override-or-live-formula logic — but the actual ledger/allocation engine had never charged
     against ADR-050's live daily-accrual projection at all, only ever `due.penalty` (frozen,
     typically ₱0 for a fresh loan). Calling `resolveComputedPenalty` unconditionally injected a
     real, nonzero, today-relative penalty into payment allocation for every prospective loan's
     unpaid installment — breaking golden-master fixtures whose expected splits assumed zero
     penalty. Diagnosed by `git stash`-ing the change and confirming the fixtures passed clean
     without it. **Corrected**: `resolveEffectivePenaltyDue()` now checks ONLY the explicit
     `penaltyOverride` — an actually-committed figure — never the live projection; `due.penalty` is
     the fallback exactly as before. Same correction mirrored on the frontend (`remainingDue()` now
     falls back to `i.penaltyOverride?.amount`, not `i.currentPenaltyOwed`, so the Payment Recording
     preview matches what the backend will actually allocate).
   - **Verification**: `GoldenMasterReplay.test.ts` back to 4/4 passing; full backend suite back to
     the known 604 passed / 16 pre-existing unrelated `loan-application`/`borrower` failures (no
     net change); 2 new regression tests added directly on `ProcessPaymentUseCase.test.ts` (fee
     override and penalty override each correctly exhausted by a payment, spilling the remainder
     into the next tier) — both green.

4. **`RepaymentInstallment.status` never went PAID after full payment on an overridden installment
   (the deepest of the four, and the one actually visible on screen).** User reported directly, with
   a screenshot: `SML-REG_00210` installment #3 — fully paid (₱11,747.59 principal, ₱2,504.50
   interest, ₱400.00 penalty matching its Reduce Penalty override, ₱200.00 fees matching its Adjust
   Fees override, ₱14,852.09 total) — stayed stuck on a red "Late" badge instead of turning green
   "Paid", and Payment Recording auto-filled ₱0.00 instead of jumping to installment #4's real
   balance. Root cause: `RepaymentInstallment.status` (`RepaymentInstallment.ts`) compared
   `paid.total()` against raw `due.total()` (₱15,677.30 — still counting the pre-reduction
   ₱1,425.21 penalty) instead of the override-adjusted total (₱14,852.09) — so a fully-settled
   installment could never numerically reach "PAID" once an override had permanently lowered what
   full payment actually means. Confirmed against the real row via direct SQL before touching code.
   Because installment #3 stayed "LATE" (not "PAID"), it kept polluting the Payment Recording page's
   "unpaid installments" list as the oldest entry with zero actually remaining, which is exactly why
   the auto-fill amount came out ₱0.00 instead of skipping to installment #4.
   - **Fix**: new private `effectiveDueTotal` getter on `RepaymentInstallment` — principal + interest
     + `effectiveFeesDue` + (`penaltyOverride?.amount ?? due.penalty`) — same override-only
     "chargeable amount" precedent as bug #3's `resolveEffectivePenaltyDue` (deliberately not the
     live ADR-050 projection, for the same reason: a status that flips as a live formula ticks
     upward, on an installment nobody has touched since settlement, would be nonsensical). `status`
     getter now compares against this instead of raw `due.total()`.
   - **No DB backfill needed** — `status` is a derived getter, recomputed live on every read
     (`PrismaRepaymentInstallmentRepository.toDomain()` calls `RepaymentInstallment.reconstitute()`,
     which never accepts `status` as an input prop). The stored `status` column is only a queryable
     write-time cache for other consumers (reports/filters) — it self-corrects the next time the
     entity is saved, and was left as-is rather than mass-backfilled (out of scope for a
     single-loan bug report; flagged as a possible follow-up if a report is later found reading that
     raw column instead of the live getter).
   - **Verification**: confirmed directly against real data via a one-off read-only script hitting
     `PrismaRepaymentInstallmentRepository.findByLoanAccountId()` for `SML-REG_00210` — installment
     #3 now reads `PAID` (₱14,852.09 paid / ₱14,852.09 effective due), #4 still correctly `LATE`
     (₱0.00 paid). 2 new unit tests on `RepaymentInstallment.test.ts` (PAID once paid reaches the
     override-adjusted total; stays LATE when only some components are settled). Full suite still
     606 passed / 16 known pre-existing unrelated failures (no net change).

## Reduce Penalty balance sync (the deferred half of bug #2, revisited on request)

User reviewed the loan-summary MiniStat cards for `SML-REG_00210` and asked for the numbers to be
explained; walking through Collections/Accounting Balance's formula surfaced that Fees (₱100.00)
was correctly synced but Penalty (₱3,875.63) still counted pre-reduction raw amounts — exactly the
scope carve-out from the earlier Adjust Fees balance-sync fix. User asked to sync it now.

Reused `resolveEffectivePenaltyDue()` (already added for the payment-allocation fix — override, or
frozen `due.penalty` otherwise) as the delta basis instead of the live ADR-050 ceiling
(`resolveComputedPenalty`) used for validation — same reasoning as before: `LoanAccount.
penaltyBalance`/`penaltyDue` were seeded from `due.penalty`, never from the live daily-accrual
projection, so a delta against the live figure would still subtract an amount the balance never
actually held.

**Fix**: new `LoanAccount.adjustPenaltyBalance(delta)` (mirrors `adjustFeesBalance`).
`ReducePenaltyUseCase` now computes `previousBalanceTrackedPenalty = resolveEffectivePenaltyDue(
installment)` *before* mutating the installment, calls `loanAccount.adjustPenaltyBalance(...)`, and
saves `loanAccount` inside the same `unitOfWork.run()` block. 4 new unit tests on `LoanAccount.
test.ts` (lower by delta, accumulates correctly across a repeated reduction on the same
installment, other balances untouched, `updatedAt`) — the repeated-reduction test matters because
each call's delta is computed against the *previous* effective value (override if one already
exists, else raw `due.penalty`), so two reductions on the same installment net out correctly rather
than double-counting against the original raw figure. Full suite still 610 passed / 16 known
pre-existing unrelated failures (no net change).

**Backfill**: two loans already had live Reduce Penalty writes made before this fix — computed each
installment's net delta (`due.penalty − current override amount`, telescoping correctly through
`SML-REG_00210`'s two separately-reduced installments) and applied it once to that loan's
`penaltyBalance`/`penaltyDue` via direct SQL:
  - `SL-CORP_00086` installment #4 (₱594.69 → ₱300.00 override): loan penalty ₱594.69 → **₱300.00**.
  - `SML-REG_00210` installments #3 (₱1,425.21 → ₱400.00) and #4 (₱1,425.21 → ₱500.00): loan
    penalty ₱3,875.63 → **₱1,925.21** (verified the backfilled total matches the sum of each
    installment's effective/override-aware penalty — #3 ₱400 + #4 ₱500 + #5 ₱1,425.21 (untouched)
    = ₱2,325.21 due, minus ₱400 already paid = ₱1,925.21 balance).

Backend rebuilt (`docker compose up -d --build backend`). Not yet click-through verified in a
browser (same standing limitation this session) — verified via unit tests and the backfilled SQL
values cross-checked against the installment-level effective totals.

Backend rebuilt (`docker compose up -d --build backend`) with all four fixes. Not yet click-through
verified in a browser (no login credentials in this environment, same standing limitation as the
rest of this session) — verified via DB query (write succeeded), unit tests (regression-tested
against golden-master fixtures), and typecheck only.

## Reverse Payment: a fully-settled loan's auto-close was never undone on reversal

User reported: reversed a payment on `SML-REG_00378` after it had auto-closed, expected the loan to
return to ACTIVE with its balance restored — balance came back, status did not, leaving the loan
stuck `CLOSED` with a real ₱3,934.06 outstanding.

**Root cause**: `ProcessPaymentUseCase` auto-closes a loan on `isFullyPaid` (`loanAccount.close()`),
but `ReversePaymentUseCase` had no symmetric reopen — it called `loanAccount.applyPayment()` to
restore the balance components but never checked whether that reversal had un-settled a `CLOSED`
loan. Confirmed directly against the DB: `loan_transactions` showed the exact closing `REPAYMENT`
(₱3,934.06, `balanceAfter: 0.00`) immediately followed by its `REVERSAL` (`balanceAfter: 3748.51`)
two minutes later — the write succeeded, only the status transition was missing.

**Fix**: `LoanAccount`'s `ALLOWED_TRANSITIONS` gained `CLOSED -> ACTIVE` (only from `CLOSED`, not
`CLOSED_WRITTEN_OFF`/`CLOSED_REJECTED` — those are different, not-yet-scoped decisions). New
`reopen()` mirrors `close()`: transitions to `ACTIVE`, clears `closedAt`/`closedReason`. Always
reopens to `ACTIVE`, never `ACTIVE_IN_ARREARS` — this codebase doesn't track which of the two a
loan was in before closing, and arrears is already computed live elsewhere (Loan Portfolio Health)
rather than trusted from this stored column. `ReversePaymentUseCase` now calls `loanAccount.reopen()`
when `status === 'CLOSED' && !isFullyPaid` after applying the reversal. 6 new unit tests: 4 on
`LoanAccount.test.ts` (close/reopen transitions, reopen rejected when not CLOSED, reopen rejected
for CLOSED_WRITTEN_OFF specifically) and 2 on `ReversePaymentUseCase.test.ts` (reopens when the
reversed payment was the one that had fully settled the loan; does NOT reopen when the loan remains
fully paid after a smaller reversal, e.g. correcting an overpayment). Full suite still 616 passed /
16 known pre-existing unrelated failures (no net change).

**Backfill scope check**: before touching any data, queried every `CLOSED` loan with a nonzero
balance — found 80, not just the one reported. Cross-checked against `loan_transactions` for an
actual `REVERSAL` row: only `SML-REG_00378` had one. The other 79 have no `REVERSAL` at all and
`closedAt` either blank or a batch-uniform `2026-03-15 16:00:00` timestamp — the already-known,
separately-flagged legacy migration balance-disagreement issue (~954 loans, needs a business
decision — see "Known follow-ups" below), NOT this bug. Left untouched. Backfilled only
`SML-REG_00378`: `status` CLOSED → ACTIVE, `closedAt`/`closedReason` cleared, balances already
correct from the reversal itself (₱3,748.51 principal / ₱185.55 interest).

Backend rebuilt (`docker compose up -d --build backend`). Not yet click-through verified in a
browser (same standing limitation this session).

## Current state

- Working tree clean; Docker stack (`postgres`, `backend`) running locally (frontend now run via
  `Run LMS Preview.bat`'s Hot Reload Mode / Vite dev server on 5173 instead of the Docker frontend
  container, per user preference this session — Docker `frontend` service stopped). In sync with
  `origin/main` as of `0048187` — **only up to `370a3ea` is pushed; several commits are local-only**:
  `9d3d1de` (docs), `be3e312` (Loan Releases Report + Reports hub + Dashboard preview cards),
  `bc8ec0c` (Reduce Penalty feature), `0338f90` (Reduce Penalty name display fix), `a46dd5b` (docs),
  `1889ba0` (addOnInterestRate/contractualInterestRate migration backfill), `f4fd6ca` (post-restore
  reminder update), `0048187` (docs), `6d0da5a` (Adjust Fees feature), plus the unified Payment
  History timeline commit made just now. Sixteen-plus commits this session total (see git log for
  the full first-half list — transaction sort ×2, Total Due column, payment allocation visibility,
  Payment Recording Close/Next-due).
- **Correction to an earlier note in this log**: the user has, in fact, already exercised both
  Reduce Penalty and Adjust Fees against real live data via their own Hot Reload Mode session
  (`SL-CORP_00086` penalty reduction, `SP-Easy_00001` fee adjustment) — confirmed by finding those
  real rows in the DB while verifying the unified timeline feature. The "not yet exercised against
  real data" caveat on those two features below is now stale.
- **Next immediate task, agreed with the user: a real UI click-through once login credentials are
  available.** Everything this session was verified at the DB/API/build level only (no browser login
  access all session) — see the bullets below for exactly what still needs eyes-on confirmation.
- Known follow-ups (carried over, still unresolved):
  - **`LoanAccount.penaltyBalance` (and therefore `collectionsBalance`) does not reflect ADR-050's
    live daily penalty accrual for prospective (non-migrated) loans** — a pre-existing gap found
    while fixing the Adjust Fees balance-sync bug above, NOT caused by Reduce Penalty. The
    Repayment Schedule tab computes and shows live penalty correctly (`isLivePenalty`/
    `currentPenaltyOwed`); the loan-summary MiniStat cards do not, since nothing ever writes the
    live-accrued amount back to `LoanAccount.balances` between activation and an actual payment.
    Reduce Penalty's balance sync was deliberately scoped OUT of this (user-confirmed) because
    syncing a delta against a balance that was never tracking the live figure in the first place
    would produce a wrong number, not a corrected one. Needs a real design decision (e.g., a
    scheduled job that periodically reconciles `penaltyBalance` per prospective loan, or switching
    `collectionsBalance`/`penaltyBalance` to compute live on read instead of from a stored column)
    before penalty reductions can safely sync into the loan summary the way fees now do.
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
  - **`DISCLOSURE_STATEMENT`'s "Effective Interest Rate" (§5)** — corrected, see the legacy
    investigation section above: this is a genuine, distinct legacy Mambu custom field
    (`CF:8a8e...`, 3,501 populated records, NOT the same as `contractualInterestRate`), never
    migrated into the current schema. Needs a decision: add a new `LoanAccount` field + backfill
    script, or some other resolution — not yet actioned.
  - **`addOnInterestRate`/`contractualInterestRate` migration gap** — found, fixed, and committed
    this session (`1889ba0`, `scripts/backfill-loan-interest-rates.ts` kept as a retained
    migration-history script); see its own section above.
  - Loan Portfolio Health Venn → proportional-bar redesign: mockup shown and liked in concept, not
    yet implemented.
  - **Report generation (Excel)**: 1 of 11 legacy reports done (Loan Releases Report, `be3e312`) —
    the other 10 (Aging, Detailed Ending Current Balance, Accounts with Past Due, Collection,
    Expected Collection, First Amortization, Daily Collection Report, Fully Paid Accounts, plus the
    3 pre-existing General-category pages already live) remain "Coming soon" placeholders on the new
    Reports hub (`/reports`) — pick the next one whenever ready to continue the pattern.
  - Pending user decision: whether to run `delete-test-records.ts --apply` against the 6 borrowers
    / 2 loan accounts / 1 loan application identified as test data.
  - **Transaction history sort bug**: fixed in two passes, both committed (`922f341`, `94424e2`) —
    see above.
  - **Payment allocation visibility (#1/#2/#3)**: committed (`d01ac67`) — see above.
  - **Reduce Penalty feature**: built, committed (`bc8ec0c`, `0338f90`) — see above. Exercised
    against real live data by the user (`SL-CORP_00086`).
  - **Adjust Fees feature**: built and committed (`6d0da5a`) — see its own section above. "Coming
    soon" placeholder replaced with a working, bidirectional adjustment. Exercised against real live
    data by the user (`SP-Easy_00001`).
  - **Unified Payment History timeline**: built and committed this session — penalty reductions and
    fee adjustments now show interleaved with real transactions, not just as the schedule table's
    "latest override" annotation. See its own section above.
  - **Payment Recording "Next due" refresh issue**: root cause not conclusively found (see its own
    section above) — worked around by removing the "Record another payment" quick-succession flow
    entirely rather than continuing to chase the staleness bug. Revisit if "Next due" shows the same
    problem on ordinary loan selection once UI access is available.
  - **No login credentials available in this environment all session** — every UI-observable change
    this session was verified at the DB/API/build level (raw SQL checks, `curl` route-registration
    probes, `tsc`/test suites, inspecting the served JS bundle) rather than by driving the actual
    browser UI. A real click-through pass is worth doing once credentials are available — especially
    the newer payment-allocation-visibility, Reports/Dashboard, and Reduce Penalty changes.
  - **`be3e312`/`bc8ec0c`/`0338f90` are committed locally but not pushed** — push when ready.
