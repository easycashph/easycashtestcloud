# Session Log: 2026-08-12 to 2026-08-13 — Manila-time date counting, SOA penalty modes, and a ₱60M finding

Continues `docs/SESSION_LOG_2026-08-12_or_ar_channel_and_arrears_fix.md` (which ends at commit
`1060397`). Started from one user question about a single accrued-interest figure and ended up
uncovering a portfolio-wide problem with penalty on matured loans.

Commits: `34144a0`, `8056466`, `ae3ef89`, `e051f8f`.

## 1. Legacy collections notes imported (`34144a0`)

User asked whether the notes staff had written in SDevTech could be recovered. The dump's
`comments` collection (21,031 rows — field visits, PTP dates, updated contact numbers) had never
been read by any migration phase. Added Phase 6 to `migrate-legacy-data.ts`, resolving each note's
parent to a migrated loan account or borrower: **11,058 imported**, the rest belong to records that
were never migrated.

- `ProfileNote.authorUserId` made nullable — legacy staff accounts were never migrated into `User`,
  and inventing an attribution would have been worse than leaving it blank. The note text almost
  always names the staff member anyway.
- Some notes were stored as rich-text HTML; the notes panel renders plain text, so HTML is stripped
  on import rather than showing literal tags.

## 2. The UTC-vs-Manila off-by-one (`8056466`)

User asked why SML-REG_00323's Accrued Interest said 71 days when its schedule implied 70.

**I initially got this wrong** and told the user `formatDate` was the bug. It wasn't. The user
pushed back with a screenshot of SDevTech showing the same date our UI showed, which forced a
proper look:

- CP12-migrated rows store Manila midnight as `T16:00:00Z`. So `2026-06-02T16:00:00.000Z` is
  June **3** in Manila — what SDevTech printed and what our own UI showed.
- Every date-difference in the codebase read UTC calendar fields, so the backend read it as June 2.
- **8,033 of 8,822 schedule rows** use that convention. 158 of them also straddle a month boundary,
  where `PenaltyCalculator` additionally picked the wrong divisor (`2026-05-31T16:00:00.000Z` is
  June 1 in Manila → 31 days instead of 30).

Fixed by adding `manilaDaysBetween` / `manilaDaysInMonth` / `manilaWholeMonthsBetween` to the
existing `manilaTime.ts` and routing `PenaltyCalculator`, `AccruedInterestCalculator` and
`StatementOfAccountCalculator` through them — replacing three near-duplicate local `daysBetween`
implementations. One helper handles both storage conventions and bare `@db.Date` columns, so there
is no per-caller special-casing to get wrong later. Frontend `formatDate`/`formatDateTime` pinned to
`Asia/Manila` (they rendered correctly only because every workstation is set to PHT — a property of
the office, not the code).

**Stored data was left alone** — it was correct; the readers were wrong.

Impact assessed before changing anything:
- 1,169 loans had overstated accrued interest, ₱166,761.86 total.
- **Penalty money already collected (₱2,732,195.93) was unaffected** — allocation uses the frozen
  `due.penalty`, never the live formula, and the live formula only runs on prospective loans, none
  of which use the affected storage convention.
- No restructure had baked a wrong figure into a new loan's principal (0 restructures exist).
- 4 of 13 already-issued Statements of Account were overstated by ₱369.71 total; re-issued.

13 regression tests added (`tests/unit/shared/manilaTime.test.ts`) covering the exact June 2/June 3
case and the month-boundary divisor.

## 3. SOA penalty: two modes, then three (`ae3ef89`, `e051f8f`)

User then noticed the SOA's penalty (₱6,066.51) disagreed with the schedule (₱2,935.41) on the same
loan. Two causes:

1. The SOA applied **one shared day count** to every past-due installment regardless of each one's
   own due date.
2. It **never honoured the maturity cap**, so an installment sitting ON its maturity date — not late
   at all — was charged a full period.

Reworked into explicit modes, recorded as `penaltyMode` so any statement can be explained and
reproduced later:

| Mode | Behaviour |
|---|---|
| `RECORDED` (default) | Takes each installment's penalty straight off the repayment schedule — frozen SDevTech snapshot for a migrated loan, live ADR-050 figure for one originated here. No dates asked. |
| `COMPUTED` | Keeps recorded figures, fills in **only** installments that have none, counting each from its own due date and never past maturity. For the ~2% (26 of 1,223) where SDevTech recorded nothing. |
| `MANUAL` | Staff type the figure, **reason required**. See §4. |

`RECORDED` makes schedule and SOA agree by construction for **both** loan types — the goal stated in
the 2026-07-28 addendum, which until now only held for prospective loans.

Date defaults for `COMPUTED` now come from the loan, not from today: "from" is the earliest past-due
installment with no penalty on record; "to" is `min(today, maturity)`. Left on today, a loan that
matured in 2018 silently computed **zero days** and read as "no penalty owed" — ₱11,637.34
understated on the one loan checked. The maturity clamp is now stated in the dialog rather than
applied silently.

**Also switched the ADR-050 divisor to a flat 30** from the installment's own due-month length. The
same 30 days of lateness cost ₱3,145.08 in February against ₱2,840.72 in a 31-day month on an
identical balance — a ₱304.36 spread with no business meaning, and the SOA had always divided by 30.
User confirmed after seeing a sample.

## 4. The finding: SDevTech never stopped charging penalty at maturity

Investigating one loan for the mode work (`SML-Co-Borrower_D3M8Y`) turned up a figure that jumped
5.6x under `RECORDED`. **I stopped and did not regenerate it**, which was the right call — the cause
was portfolio-wide.

A loan's final installment is due **on** its maturity date, so under our own rule it should carry no
penalty at all. SDevTech kept adding penalty to it for as long as the account stayed open.

| | |
|---|---|
| Migrated loans reviewed | 1,799 |
| Final instalment carries recorded penalty, still unpaid | **681** |
| Total on those final instalments | **₱19,313,224.66** |
| Of those, penalty **exceeds the unpaid balance** | 156 |
| Penalty already collected (cannot be touched) | 13 |
| Oldest affected loan matured | August 2010 |
| Earlier instalments, partly-post-maturity (estimate) | 1,030 rows, ₱43,199,753.56 |

User confirmed the business rule directly: **"hindi na namin sinisingil ang penalty na naipon
pagkatapos mag-mature ang isang loan."**

Two further checks:
- **Not growing on its own.** Compared seven snapshots (Jul 23 → Aug 12): figures are static except
  when someone touches the account in SDevTech (one loan moved +₱2,216.28 in three weeks).
- **`penaltyDue` is create-only.** `migrate-repayment-schedules.ts` updates only paid amounts/status
  on re-run, never `penaltyDue` — so a correction here would **not** be overwritten by a future
  sync. 28 loans have already drifted from SDevTech as a result.

### Why `MANUAL` exists rather than an automatic cap

Capping with our own formula looked attractive but is not honest. On `SML-MAX_E8J3Z`, installment #1
had 31 days before maturity; SDevTech recorded ₱381,938.96 for that window where our formula gives
₱5,451.23 — **~70x apart**. SDevTech's accrual formula could not be derived from the dump (its
intermediate values match neither daily nor monthly proration), so an automatic figure would be a
guess presented as a calculation. These accounts are settled case by case, so staff enter the figure
with a reason. Both reference figures (recorded, and maturity-capped) are shown with a "use this"
shortcut so the decision is made between two known ends rather than from a blank field.

`RECORDED` now warns when the figure includes post-maturity accrual, so the default is not reached
for on a long-defaulted account unawares.

## 5. Live data corrected this session

- **3 Statements of Account re-issued under `RECORDED`** (new SOA-00003 each; superseded copies kept):
  SML-REG_00323 ₱6,066.51 → ₱2,935.41 · SML-REG_00268 ₱35,332.01 → ₱9,428.02 ·
  SML-REG_00338 ₱8,534.40 → ₱1,399.08.
- Earlier in the session, the same 3 plus `SML-Co-Borrower_D3M8Y` were re-issued for the timezone
  fix (₱369.71 total).
- **`SML-Co-Borrower_D3M8Y` deliberately not re-issued** — under `RECORDED` it rises from ₱79,696.35
  to ₱446,897.82 because of the post-maturity penalty. Held pending the decision in §6.

## Verification

- `npx tsc --noEmit` clean on both apps after every change.
- `npx vitest run` (backend): pre-existing baseline of 5 failed files / 10 failed tests held
  throughout — **zero regressions**. Passing count rose 892 → 912 across the session.
- SOA calculator tests were **rewritten, not merely adapted** — the shared-date-range rule they
  asserted was replaced by user decision, so the old assertions were no longer true.
- Every figure quoted to the user was reproduced through the real production calculators against the
  live database before being stated, and the SML-REG_00323 replication was checked against the exact
  figure the UI had shown (₱6,462.92) to prove the method.
- Docker rebuilt and confirmed healthy after each change.

## Open — awaiting decision

**The ₱19.3M correction is prepared but NOT applied.** User's words: *"hayaan muna natin ito para
mapag-isipan muna."*

- A management brief exists in two forms, both stating the ₱43.2M figure explicitly as an estimate:
  - `docs/Penalty on matured loans - decision brief.docx` (2 pages, US Letter, **untracked** —
    deliberately not committed pending the user's call)
  - Artifact: https://claude.ai/code/artifact/028f40ed-b2f2-47a2-8b02-605991bcfdd1
- Proposed mechanism when approved: `ReducePenaltyUseCase` — audit trail, required reason, balance
  sync, and it refuses where penalty has already been collected (the 13). **Not** a raw UPDATE.
- Part B (₱43.2M on earlier instalments) is a separate decision needing a stated method, since the
  legitimate portion cannot be separated from the record.

## Also open, not yet examined

**Accrued interest on long-defaulted accounts.** Raised twice, deferred both times. Even with
penalty set to ₱5,451.23, `SML-MAX_E8J3Z` still shows **₱320,760.10** of accrued interest, and
`SML-MAX_Z9F7B` showed ₱5.27M earlier in the session — six to seven years of accrual on loans long
in default. Likely larger than the penalty question. Untouched so far.
