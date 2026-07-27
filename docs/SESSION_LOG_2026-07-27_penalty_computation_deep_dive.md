# Session Log — 2026-07-27: Client Profile cleanup, multi-machine git sync, penalty computation deep dive

## Context

Continuation from `SESSION_LOG_2026-07-24_loan_adjustment_and_ui_polish.md`. This session covered
a small UI cleanup on the Client Profile page, several rounds of reconciling git history across
the user's Windows machine and MacBook (working in parallel across sessions), and a long
verification/education discussion comparing the live penalty computation against both the
Statement of Account calculator and the user's own Excel reference tool — no penalty logic was
changed, only analyzed.

## 1. Client Profile page — removed duplicate Attachments card, widened Loan History

User asked to remove the Attachments card from the Client Profile page, reasoning it duplicated
the same files already shown on the Loan Account's own Attachments card. Investigated first:
`AttachmentsPanel` on `ClientProfilePage.tsx` used `ownerType="BORROWER"` plus a `secondaryOwner`
merge-in of the client's most recent Loan Application's documents — the exact same
`secondaryOwner` merge-in pattern also used on `LoanDetailPage.tsx`'s own Attachments card, so
application-stage documents genuinely appeared in both places.

Pushed back once (per CLAUDE.md "challenge poor design decisions") before removing the whole
card outright — the BORROWER-level "own uploads" capability (documents not tied to any specific
loan) would be lost too. User confirmed after seeing the tradeoff that they wanted the whole card
gone anyway. Removed:
- `AttachmentsPanel` import and the `cardsById.attachments` block entirely.
- `'attachments'` from `DEFAULT_CARD_ORDER`.
- Added a `visibleCardOrder = cardOrder.filter((id) => cardsById[id] !== undefined)` guard (mirrors
  `LoanApplicationDetailPage.tsx`'s existing pattern) so a staff member's already-saved
  localStorage card order that still lists `'attachments'` doesn't render an empty draggable slot.
- Updated a stale banner ("...and Attachments below are live") that referenced the removed card.
- Confirmed profile picture upload (`uploadPhotoMutation`, `ApplicantAvatar`) is unaffected — it's
  wired through its own independent `/attachments?ownerType=BORROWER` query, not dependent on the
  card's rendering.

Then widened the Loan History card to full width (`fullWidth={id === 'loanHistory' || ...}` on
`SortableSection`) — its 8-column balance table was cramped into a half-width grid column,
forcing horizontal scroll.

Verified live (loan account list, balance columns readable without scrolling; Attachments card
gone; profile picture still independent). `tsc --noEmit` clean. Commit `f3b1677`, pushed to
`origin/main`.

## 2. Multi-machine git sync (Windows ↔ MacBook)

User is splitting work between this Windows machine and a MacBook, sometimes in parallel sessions
on each. Several rounds of confusion and reconciliation this session:

- Walked through moving the whole project to the MacBook: `git clone` (chosen over copying the
  folder, since `node_modules` contains OS-specific native binaries — Prisma engine, `bcrypt` —
  that don't work cross-platform), recreating `.env` files from `.env.example`, and transferring
  the database via `pg_dump`/`pg_restore` rather than copying the Docker volume directly.
  Generated `app/docker/easycash_backup.dump` (21MB, `pg_dump -F c`) on request, left in place at
  the user's choice (not deleted from the container's `/tmp` either).
- User reported card layout changes made on the Mac "not showing up" here — traced through
  `git status`/`git log`/`git stash list` on the Mac and found **nothing**: clean working tree, no
  stash, single branch, fully up to date with `origin/main`. The changes were never actually
  committed on the Mac (most likely made through some other means, e.g. a different session that
  only produced mockups rather than real edits) — flagged this finding rather than guessing
  further; user acknowledged and moved on ("ok na ngayon, nandito na lahat").
- Verified live that the co-borrower `firstName`/`middleName`/`lastName` structuring (made in a
  separate Mac session, merged in earlier) is fully wired end-to-end here too: schema, real
  Postgres columns (`\d co_borrowers`), backend use cases/repository/presenter, and frontend types
  — all consistent, no gaps.
- Reconciled a second round of divergent history: `origin/main` had gained co-borrower
  edit/address/signing work (6 commits, done in a separate Mac session) while this machine had the
  Loan Adjustment + UI polish commits. Merged cleanly except one **add/add conflict on `Update LAN
  IP.command`** — a Mac session had independently written a macOS port of the same `.bat` script
  this session had also written earlier the same day; resolved by keeping the remote's (older,
  already in use) version. Applied the two new migrations (`add_co_borrower_signing`,
  `add_coborrower_names`), regenerated the Prisma client, verified `tsc --noEmit` clean on
  backend/frontend/portal and the full backend suite (885 passed, 7 skipped, 0 failed) before
  pushing (`8378e1c..312c5ea`).
- A third small commit landed from another session mid-day (`perf(dev-env): Update LAN IP script
  only rebuilds frontend, restarts backend`) — pulled cleanly, no conflict, no action needed beyond
  the pull itself.

**Lesson reinforced for the user**: always `commit` **and** `push` after editing on either machine,
and `git pull` before starting a new session on the other one — this was said explicitly and
should be treated as standing guidance for future cross-machine work.

## 3. Penalty computation deep dive (analysis only — no code changed)

User asked for the live ADR-050 penalty computation to be checked against real accounts, and
against their own reference tools. Two loans were used:

### `SML-Self_00058` (matured, ₱30,000 principal, 6 installments, matured Jul 1 2026)

- Verified the live/current computation (`CurrentPenaltyResolver` + `PenaltyCalculator.calculate`)
  matches hand-verified math exactly, run through the actual production code via a disposable
  Vitest scratch file (written, run, then deleted — not committed): per-installment penalties
  ₱3,602.67 / ₱2,738.69 / ₱1,953.26 / ₱1,239.23 / ₱590.11 / ₱0.00 (last installment still within its
  3-day grace period as of the frozen maturity-date cutoff), total ₱10,123.96.
- Confirmed this loan is NOT SEC MC 3 covered — principal (₱30,000) and tenor (6 months) both
  individually exceed the ₱10,000 / 4-month ceilings, so the ADR-050 10%-compounding rate applies
  (not the SEC MC3 5%-simple ceiling), independent of the other two criteria.
- Compared against the Statement of Account calculator (`StatementOfAccountCalculator.ts`) for the
  same loan — SOA showed ₱8,851.61, deliberately different by design (documented in the file's own
  2026-07-19 doc comment): SOA's ₱10,000 rate threshold is evaluated **per-installment** (each
  installment's own unpaid balance, here ~₱5,901, under the threshold → 5%) rather than against the
  whole loan's principal (₱30,000, over the threshold → 10% in ADR-050); SOA is also flat/simple
  (linear in days, staff-entered shared From/To range) versus ADR-050's whole-calendar-month-gated
  compounding. Verified the SOA total by hand against the documented formula — matched exactly.
- User then reopened the 2026-07-19 SOA threshold decision, arguing the per-installment basis is
  wrong and it should be evaluated against **the loan's total remaining unpaid balance** (sum of
  all unpaid installments' P+I, ₱35,406.44 here) rather than either the per-installment or the
  original-principal basis — **this is unresolved, no code changed.** Needs a fresh explicit
  confirmation next session before touching `StatementOfAccountCalculator.ts`.

### `SML-REG_00378` (NOT matured, ₱15,000 principal, first due Apr 1 2026, matures Sep 1 2026)

- User supplied `legacy/reports/PENALTY COMPUTATION ( LMS ).xlsx` as their own manual reference
  computation for this same loan, `TO` date initially "end of month" (Jul 31 2026), later changed
  by the user to match "today" (Jul 27 2026) mid-session. Parsed the file directly (no Python
  available on this machine — `markitdown`/`openpyxl` unusable; unzipped the `.xlsx` and
  hand-parsed `sheet1.xml`/`sharedStrings.xml` with a disposable Node script instead) and confirmed
  every Principal/Interest figure in it matches the real `repayment_schedules` rows exactly.
- Ran the actual production `PenaltyCalculator.calculate()` (again via a disposable, then-deleted
  Vitest scratch file) for this not-yet-matured loan: ₱914.40 / ₱580.13 / ₱276.25 / ₱0.00 across the
  4 already-due installments, total ₱1,770.78 — versus the Excel's ₱2,600.06 (after the user's date
  correction).
- Walked through, with worked examples, exactly why they differ even once both use the same `TO`
  date: the Excel is a **flat/linear, daily-prorated** rate (`outstanding × rate ÷ days-in-month ×
  real-days-late`, accruing from day one after the due date) with no whole-month gate, while
  ADR-050 requires a full elapsed calendar month (the "birthday" analogy — same
  `wholeCalendarMonthsBetween` logic already used for age-in-years elsewhere in this codebase)
  before charging anything at all, then **compounds** monthly rather than accruing linearly.
  Demonstrated concretely that the 4th installment (due Jul 1, 26 days late as of Jul 27) sits at
  exactly ₱0.00 under ADR-050 (needs to reach Aug 1 - its "due-date anniversary" - to register its
  first month) versus ₱231.70 already accrued under the Excel's linear model, and that this holds
  regardless of whether `TO` is set to real "today" or "end of month" (Jul 31 doesn't help either,
  since Jul 1's own next elapsed-month boundary is Aug 1, not Jul 31).
- User then floated a further, more consequential question: should ADR-050 itself be changed to
  charge immediately after the grace period (daily-prorated, no whole-month wait) instead of the
  current whole-month-gated compounding? Produced a side-by-side comparison table
  (`SML-REG_00378`: proposed-daily-prorated ₱2,600.06 vs current-compounding ₱1,770.78) but this is
  **the same one already computed for the Excel comparison** — no new code was written, and no
  decision was made. **This would be a significant reversal of ADR-050, which was confirmed via
  direct business/MIS testimony on 2026-07-11 — must not be implemented without an explicit,
  unambiguous confirmation, treated with the same weight as the original ADR-050 sign-off.**

## Current state / open items for next session

- **Client Profile Attachments removal + Loan History full-width**: done, verified, committed,
  pushed (`f3b1677`).
- **Git sync across Windows/Mac**: both machines in sync as of `origin/main` `312c5ea`
  (plus whatever the most recent LAN-IP-script perf commit was, pulled cleanly after). No pending
  local changes on this machine beyond the same pre-existing, untouched stray files noted in prior
  logs (deleted `legacy/Sync Database And Apply Migrations.bat`, `app/backend/templates-backup-preanchor/`,
  `legacy/Setup note only/`, `legacy/reports/Loan_Penalty_Computation_Reference.pdf`).
- **SOA penalty rate threshold basis** (per-installment vs whole-loan vs total-unpaid-balance):
  reopened, unresolved. Needs an explicit decision before any change to
  `StatementOfAccountCalculator.ts`.
- **Whether to change ADR-050 itself** (whole-month-gated compounding → immediate
  daily-prorated): raised, comparison shown, **NOT decided, NOT implemented**. This is a
  business-critical, already-once-confirmed rule — do not touch without a clear, explicit
  re-confirmation next time it comes up, and flag the size of the change (affects the live penalty
  figure on every active/in-arrears loan) before proceeding.
- Also still open from earlier sessions, untouched today: whether to widen Accrued Interest to
  legacy/migrated loans (no clear answer given previously), Dashboard color redesign mockups, and
  sidebar brand header redesign mockups.
