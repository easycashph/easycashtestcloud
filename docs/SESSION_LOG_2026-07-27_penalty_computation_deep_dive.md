# Session Log — 2026-07-27: Client Profile cleanup, multi-machine git sync, penalty computation deep dive

## TL;DR for a fresh Claude session picking this up cold

- Two real UI/code changes landed and are committed (see §1): Client Profile's duplicate
  Attachments card removed, Loan History card widened. Nothing else in this log changed code.
- The rest of the session (§3-8) is a long, still-unresolved analysis of penalty computation
  discrepancies across three places in the codebase: the live Repayment Schedule (`ADR-050`,
  compounding, whole-calendar-month gated), the Statement of Account calculator (flat/linear,
  staff-entered date range, different ₱10,000 rate threshold basis), and the user's own Excel
  reference tool (flat/linear too, but yet another day-count convention). None of the three agree,
  and why is now fully understood and documented — but nothing has been changed.
- **The live thread to continue**: §6/§7 propose making the SOA's Penalty line just call
  `resolveComputedPenalty()` (the exact same function the live Repayment Schedule already uses)
  instead of maintaining `StatementOfAccountCalculator`'s own parallel formula — this would make SOA
  and Live identical *by construction* for prospective (non-migrated) loans, and correctly falls
  back to the frozen `due.penalty` snapshot for migrated loans automatically (no new logic needed
  for that case — `resolveComputedPenalty` already gates on `isProspectiveLoan`). A mockup of the
  redesigned "Create Statement of Account" modal was shown and approved in shape (single "As of
  date" input replacing the From/To range, "Live computed" badge, explanatory copy) — **but
  implementation has not started.**
- **Before writing any code for that**, get explicit answers to the 4 open questions in §6 (repeated
  in "Current state" below) — especially whether the Accrued Interest date should lock/disable
  before the loan's maturity date (raised in §7, not yet confirmed).
- **Do not touch ADR-050 itself** (the whole-month-gated compounding formula) without a very
  explicit, unambiguous go-ahead — §5/§6 raised the idea of making it daily-prorated instead, purely
  as a comparison exercise; that would be a business-critical reversal of an already-confirmed rule
  and must not be inferred as approved from this discussion.

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

## 4. Payment allocation order and compounding — Q&A, no code changed

User asked two follow-up conceptual questions, answered by reading `PaymentAllocationCalculator.ts`
and searching for interest-compounding logic rather than assuming:

- **"Kung magbayad ng ₱500 papuntang interest, mababawasan din ba ang penalty?"** — explained the
  real allocation order (`docs/Architecture/CALCULATION_ENGINE_SPEC.md` §5 / `ADR-009`, sourced from
  the Promissory Note's own clause 4): **Fees → Penalty → Interest → Principal**, each tier filled
  completely before the next. So a single payment CAN reduce both Penalty and Interest, but only
  because Penalty is paid first out of it and whatever remains afterward flows into Interest — not
  because the payment is split between them independently. Worked two examples (penalty smaller
  than payment → both reduce; penalty larger than payment → only penalty reduces, Interest
  untouched).
- **"Pwede ba itong maging compounded?"** — clarified that **Interest itself does not compound**
  anywhere in the normal repayment cycle; only **Penalty** compounds (ADR-050), computed against the
  combined overdue Principal+Interest base, not against Interest on its own. Found one narrow
  exception via a codebase search: `RestructureLoanUseCase.ts`'s own doc comment acknowledges an
  "interest-on-interest" implication — restructuring folds unpaid Interest into the *new* loan's
  Principal, so on the new loan that former Interest starts earning fresh Interest — but this is a
  one-time event at the moment of Restructure, not continuous/automatic compounding within normal
  repayment.

## 5. "Would daily-prorated Live match SOA?" — no, not on its own

User asked directly: if Live's penalty computation were changed to daily-prorated (per §3's
proposal), would it then match the SOA calculator's output? Answered no — even after fixing the
compounding-vs-linear difference, **two more structural mismatches remain**:

1. **Day-count mechanic**: SOA applies one staff-entered shared From/To range uniformly across
   every qualifying installment (e.g. 150 days for all of them); the daily-prorated Live proposal
   counts each installment's own days from its own due date to a shared To-date (117/87/56/26 days
   in the `SML-REG_00378` example) — structurally different even once both are "flat/daily."
2. **Rate threshold basis** — the same open question from §3: SOA compares each installment's own
   unpaid balance against ₱10,000 (yielding a different rate per installment); ADR-050/Live compares
   the whole loan's principal; the user's proposed "total unpaid balance of the loan" basis is still
   undecided.

Concluded that true parity would require deciding and aligning all three axes together
(compounding→linear, day-count mechanic, rate threshold basis) — not just one. Offered to build a
full side-by-side comparison table with all three aligned, but the user has not yet asked for that;
**no code changed**.

## 6. Proposed direction: SOA should just reuse Live's computed penalty (not maintain a parallel formula)

After §3-5 kept surfacing new mismatches between SOA's independent `StatementOfAccountCalculator`
formula and the Live/ADR-050 one, the user proposed a structurally different fix: instead of trying
to align SOA's own formula with Live's, **have the SOA's Penalty line call the exact same function
Live already uses** (`resolveComputedPenalty` in `CurrentPenaltyResolver.ts`), with a manual
date-range fallback offered only for migrated loans or loans with no live-computable penalty.

Investigated the actual wiring before responding (`StatementOfAccountMergeDataResolver.resolve()` →
`StatementOfAccountCalculator.calculate()`, `GenerateStatementOfAccountUseCase.ts`'s
`penaltyFromDate`/`penaltyToDate` inputs) and confirmed this is not just workable but elegant:
`resolveComputedPenalty` already has the exact gate the user described built in —
`if (isProspectiveLoan && status !== 'PAID')` uses the live ADR-050 formula, otherwise it returns
the frozen `due.penalty` snapshot (which is `₱0` for accounts with nothing recorded) — i.e. the
"migrated or no computed penalty on record" carve-out the user asked for is already the existing
behavior of that function, not something new to build. Reusing it for SOA's Penalty line would make
SOA and Live **identical by construction** for prospective loans (same function call, not two
formulas kept in sync), resolving every open question from §3-5 (rate threshold, day-count
mechanic, compounding vs linear) at once by simply not having two formulas.

Assessed this positively and asked four clarifying questions before implementing (none answered
yet — **paused, no code changed**):
1. Whether the SOA's `PenaltyFromDate` field should be dropped from the document for prospective
   loans, since `resolveComputedPenalty` doesn't take a "from" input (it derives each installment's
   own due date automatically) — or kept as display-only.
2. Whether `PenaltyToDate` should keep its current staff-free-entry flexibility (any past/future
   date for a "what-if" preview) or be defaulted/locked to today.
3. Confirmed migrated loans keep the existing manual date-range + flat-formula path unchanged.
4. Whether the separate Accrued Interest section (its own independent staff-entered date/formula)
   should be left alone or folded into this same alignment effort.

## 7. Mockup of the redesigned "Create Statement of Account" modal

User shared a screenshot of the actual current SOA modal (Account information / Balances / Penalty
(From+To date range) / Accrued interest / Collection+Other Fee / Total amount due cards) and asked
for a mockup applying §6's direction in that exact layout, not a redesigned one. Produced two
mockup iterations:
- First pass matched the real card grouping/styling, replacing the Penalty card's From+To range
  with a single "As of date" input and a "Live computed" badge, and showed the Accrued Interest
  date input disabled/locked with "Not applicable until maturity" for a not-yet-matured example
  loan (`SML-REG_00378`) — flagged this lock behavior as a question needing confirmation, not yet
  decided.
- Second pass added two explanatory lines back in at the user's request: inside the Penalty card,
  "Same figure shown on this loan's Repayment Schedule - computed as of the date below"; and a
  small info box below it, "Migrated loans have no live penalty on file - a manual From/To date
  range appears instead for those accounts."

Still just a visual mockup — **no code changed**. Still waiting on the §6 clarifying questions
(especially whether Accrued Interest should lock before maturity, and the `PenaltyToDate`
flexibility question) before implementation starts.

## 8. "What's the start date, if only 'As of date' shows?" — clarified, no code changed

User asked, given the mockup now shows only one date field, what the effective "start" of each
installment's penalty period would be under §6's proposal — specifically whether it's a single
shared date like April 1, 2026. Clarified: there is no single shared start date. Each installment
supplies its own start automatically from its own `dueDate` (`resolveComputedPenalty` reads
`installment.dueDate` directly, same as Live already does) — for `SML-REG_00378` that's Apr 1 for
installment #1, May 1 for #2, Jun 1 for #3, Jul 1 for #4, each independent. The single "As of date"
field in the mockup is only the shared **end**/`asOfDate` point; staff never enter a "from" at all
under this design.

## Current state / open items for next session

- **Client Profile Attachments removal + Loan History full-width**: done, verified, committed,
  pushed (`f3b1677`).
- **Git sync across Windows/Mac**: both machines in sync as of `origin/main` `312c5ea`
  (plus whatever the most recent LAN-IP-script perf commit was, pulled cleanly after). No pending
  local changes on this machine beyond the same pre-existing, untouched stray files noted in prior
  logs (deleted `legacy/Sync Database And Apply Migrations.bat`, `app/backend/templates-backup-preanchor/`,
  `legacy/Setup note only/`, `legacy/reports/Loan_Penalty_Computation_Reference.pdf`).
- **§6's proposal — SOA reuses `resolveComputedPenalty` directly instead of its own formula**:
  this is the most likely next concrete implementation step; supersedes the standalone "SOA rate
  threshold basis" question (§3) since reusing Live's function makes that question moot for
  prospective loans. Blocked on the 4 clarifying questions in §6 — answer those first, then
  implement in `StatementOfAccountMergeDataResolver.ts` (swap the Penalty-line source, keep
  `StatementOfAccountCalculator`'s flat formula only as the migrated-loan fallback, which
  `resolveComputedPenalty` already gates on `isProspectiveLoan`).
- **Whether to change ADR-050 itself** (whole-month-gated compounding → immediate
  daily-prorated): raised, comparison shown, **NOT decided, NOT implemented**. This is a
  business-critical, already-once-confirmed rule — do not touch without a clear, explicit
  re-confirmation next time it comes up, and flag the size of the change (affects the live penalty
  figure on every active/in-arrears loan) before proceeding.
- Also still open from earlier sessions, untouched today: whether to widen Accrued Interest to
  legacy/migrated loans (no clear answer given previously), Dashboard color redesign mockups, and
  sidebar brand header redesign mockups.
