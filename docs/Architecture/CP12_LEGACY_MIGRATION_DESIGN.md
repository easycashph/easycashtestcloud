# CP12 — Legacy MongoDB Migration: Analysis & Design

**Status:** IMPLEMENTED AND RUN, 2026-07-08 — Milestone 9.1 is now fully complete (CP1–CP13, all
done). Migrated into local dev Postgres only (§5 point 7) — a future production cutover against
Easycash's real backup database is the explicit longer-term goal, a separate, later,
separately-approved step.
**Prepared:** 2026-07-08.
**Scope:** Milestone 9.1's last remaining checkpoint (CP12) — migrating the real legacy Mambu-era
MongoDB export into `app/backend`'s Postgres schema. Per `CLAUDE.md`'s workflow: analyzed (§1-§4),
designed (§5, decisions locked in with the business), implemented and run (§6 — this section,
added after the fact with the real results).

## 6. Implementation results (2026-07-08)

Script: `app/backend/scripts/migrate-legacy-data.ts` (dry-run by default; `--apply` writes for
real). Idempotent (upserts on `legacyId` everywhere) — safe to re-run; confirmed by actually
re-running it mid-session after fixing a bug (see below) with no duplication.

**Verified directly against Postgres after the run** (not just trusting the script's own log):

| Table | Rows |
|---|---|
| `LoanProduct` / `LoanProductVersion` / `PenaltyRule` | 43 each |
| `Borrower` | 4,604 |
| `BorrowerIncomeDetail` / `BorrowerGovernmentId` | 333 each |
| `Address` | 1,384 |
| `IdentificationDocument` | 888 |
| `CharacterReference` | 92 |
| `LoanAccount` | 1,777 |
| `CoBorrower` / `LoanAccountCoBorrower` | 214 / 434 |
| `LoanTransaction` | 279,490 |
| `Attachment` (metadata only, per §5 point 4) | 21,012 |

`LoanAccount.status` breakdown: `ACTIVE_IN_ARREARS` 1,142, `CLOSED` 501, `ACTIVE` 128,
`PENDING_APPROVAL` 4, `APPROVED` 2 (sums to 1,777, matching the migrated count — the 22 skipped
loans, see below, account for the gap from 1,799 source rows).

`LoanTransaction.type` breakdown: `PENALTY_APPLIED` 252,725, `REPAYMENT` 9,299, `FEE_CHARGED`
5,919, `ADJUSTMENT` 5,350, `INTEREST_APPLIED` 3,341, `DISBURSEMENT` 1,942, `DEFERRED_INTEREST_APPLIED`
459, `DEFERRED_INTEREST_PAID` 419, `TRANSFER` 36.

**Skipped rows (by design, not bugs — each was evaluated, not silently dropped):**
- 1 `loan_products` row — literally `"TEST-PROD"` / `"Test Product"`, correctly excluded.
- 15 `loan_accounts` rows — unresolved borrower reference (test/orphaned legacy data).
- 7 `loan_accounts` rows — no source `firstRepaymentDate` (ADR-045: no fabrication rule exists,
  so these are skipped rather than guessed).
- 92 `attachments` rows — unresolved owner.
- **244,973 `loan_transactions` rows (46.7%)** — the single largest finding of this migration.
  1,466 are `IMPORT`-typed (a Mambu-internal onboarding marker, not a real financial event, per
  §5 point 2's decision). The remaining **243,507 reference a `parent_account_key` that doesn't
  match any of the 1,799 current `loan_accounts` records** — verified twice, against both that
  collection's `uid` and `_id` fields, confirmed not a join-key bug in the script. These
  transactions are presumed to belong to loan accounts that no longer exist in the current
  `loan_accounts` snapshot (plausibly from the Excel → Mambu → SDevTech system transitions
  `CLAUDE.md` documents). **Explicit decision (2026-07-08): proceed with the 53.3% that resolve,
  accept the gap for this pass** — nothing is lost, the full 524,463-row source ledger remains
  intact and untouched in the gitignored dump for future investigation if the cause is ever
  identified and a fuller migration becomes worthwhile.
  **UPDATE 2026-07-23 (CONFIRMED CLOSED):** that future investigation happened — see
  `docs/Architecture/CP12-legacy-migration-report.md`'s "Known gaps" section. Confirmed genuine,
  permanent legacy data gap (the referenced accounts exist nowhere in the legacy export, not just
  excluded by migration scope), not recoverable. The 244,242-row figure re-verified against a
  fresh 2026-07-23 dump (`scripts/analyze-orphaned-transactions.ts`) and permanently preserved in
  Postgres (`legacy_orphaned_transactions` table, via `scripts/export-orphaned-transactions.ts`).

**One implementation bug found and fixed during the real run:** 12 legacy loan codes are each
reused across exactly 2 real records (different `uid`/`creationDate` — a renewal-style reuse
pattern, not a data-entry error), but `LoanAccount.loanCode` is `@unique`. The first `--apply` run
failed on the first collision. Fixed: the second occurrence of a reused code gets a `-LEGACY2`
suffix so both real records migrate — neither is silently dropped to satisfy the constraint.

**Source data location:** `legacy/mongodb/07012026_103239/db-easycash/` — a full `mongodump`
export, confirmed real (real names/emails/phones), confirmed already `.gitignore`d
(`legacy/mongodb/` — never enters git history). Verified directly against the files, not
reconstructed from the existing ADRs (though the counts below match them exactly, confirming this
is the same dataset those ADRs were evidenced from).

---

## 1. Source dataset — confirmed counts

| Collection | Count | Target |
|---|---|---|
| `loan_accounts` | 1,799 | `LoanAccount` |
| `client_accounts` | 4,629 | `Borrower` |
| `loan_transactions` | 524,463 | `LoanTransaction` |
| `loan_products` | 44 | `LoanProduct` + `LoanProductVersion` |
| `co_borrowers` | ~unconfirmed, sampled | `CoBorrower` |
| `addresses` | sampled | `Address` (polymorphic) |
| `identification_documents` | sampled | `IdentificationDocument` |
| `character_references` | sampled | `CharacterReference` |
| `client_income_details` | sampled | `BorrowerIncomeDetail` |
| `client_other_details` | sampled | `BorrowerGovernmentId` |
| `attachments` | 21,104 (per ADR-006, already referenced) | `Attachment` (metadata only — see §5) |
| `disbursements` | sampled | Merges into `LoanAccount`/`LoanTransaction` (no separate model) |
| `activities.bson` (151 MB) | not sampled | Likely out of scope — see §5 |
| `comments.bson` (76 MB) | not sampled | Likely out of scope — see §5 |
| `custom_field_values.bson` (56 MB) | not sampled | Likely out of scope — see §5 |
| `monthly_loan_releases` | sampled | Reporting snapshot, not a migration source (see §4) |
| `mambu_users` | sampled | `User.legacyId` traceability only (ADR-039: no password carry-over) |

**Good news:** the target Prisma schema was already built with this migration in mind —
`legacyId String? @unique` already exists on `User`, `LoanProductVersion`, `FeeRule`, `Borrower`,
`LoanAccount`, `LoanTransaction`, `RepaymentSchedule`, `AppliedFee`, `CoBorrower`, `Attachment`,
`DocumentTemplate`. This is the natural idempotency key for every collection's migration (upsert
on `legacyId`, never insert blind) — no new schema change needed to make the migration idempotent.

---

## 2. Collection → Model mapping (drafted, not yet approved)

### 2.1 `client_accounts` → `Borrower` (+ related tables)
Sample fields confirmed: `full_name` (needs splitting — legacy already has `first_name`/
`middle_name`/`last_name` separately, so no name-parsing heuristic needed), `birthdate`,
`mobile_phone_1/2`, `email_address`, `civil_status`, `gender`, `state`, `assigned_branch_key`,
`assigned_user_key`, `loan_cycle`.
- `client_income_details` (parent-keyed) → `BorrowerIncomeDetail` — clean 1:1 field match
  (`employment_type`, `employer_name`, `employer_address`, `nature_of_business`, `position`,
  `years_employed`).
- `client_other_details` (parent-keyed) → `BorrowerGovernmentId` — `sss_number`, `tin_number`.
- `addresses` (parent-keyed, polymorphic — confirmed by ADR-014) → `Address` with
  `ownerType: BORROWER`.
- `identification_documents` (client_key-keyed) → `IdentificationDocument`.
- `character_references` (parent-keyed) → `CharacterReference`.
- **Open mapping question:** `client_accounts.state` (`INACTIVE` 3,198 / `ACTIVE` 1,423 /
  `EXITED` 7 / `REJECTED` 1) → `Borrower.status` (`BorrowerStatus` enum — needs checking against
  its actual values, not yet inspected in this pass).
- **Branch/User FK resolution:** `assigned_branch_key`/`assigned_user_key` are legacy Mambu encoded
  keys, not present in the new schema's seeded `Branch`/`User` tables (which currently have exactly
  one placeholder "HQ" branch and whatever `User` rows exist — see ADR-005, "no legacy branch list
  exists"). **This blocks a clean FK migration** — see §5 point 1.

### 2.2 `loan_products` → `LoanProduct` + `LoanProductVersion`
Only 44 rows — smallest, most tractable collection. Sample confirms a near-complete field match to
`LoanProductVersion`'s columns (`interest_calculation_method`, `loan_amount.{default,min,max}`,
`num_installments.{default,min,max}`, `repayment_schedule_method`, `days_in_year`,
`rounding_repayment_schedule_method`, `product_category`). Per ADR-002/ADR-003 (no retroactive
version-history reconstruction), each legacy product becomes exactly **one** `LoanProductVersion`
(`versionNumber: 1`), not an attempt to reconstruct historical edits.
- `penalty_rate` → `PenaltyRule` (per ADR-008, mechanism-only, `capPercent` unenforced).
- No fee-rule-shaped field observed in the sample — `FeeRule` rows likely need a **separate**
  source (fee amounts appear to live on `loan_transactions` as `fees_amount`/on `disbursements`,
  not as a declared per-product rule in this dump). Needs a second collection pass — see §5.

### 2.3 `loan_accounts` → `LoanAccount`
Strong field overlap already: `interestRate`↔`interest_rate` (24.99 in sample — a %, matches
`Decimal(6,3)`), `principalAmount`↔`loan_amount`... **actually `principalDue`/`principalBalance`/
`principalPaid` and their `interest`/`fees`/`penalty` counterparts already exist field-for-field in
both schemas** — this is the cleanest mapping in the whole migration.
- `accountHolderType`: **confirmed 100% `CLIENT` across all 1,799 rows** — ADR-004's
  individual-only scope limit holds for every real record; zero `GROUP` loans to worry about.
- `accountState` distribution: `ACTIVE_IN_ARREARS` 1,150 / `CLOSED` 509 / `ACTIVE` 131 /
  `PENDING_APPROVAL` 5 / `APPROVED` 4. Mostly a direct enum match to `LoanAccountStatus` — **except**
  the 509 `CLOSED` rows need to resolve to `CLOSED` / `CLOSED_WRITTEN_OFF` / `CLOSED_REJECTED`
  (three target values, one legacy value) — needs a disambiguating signal (candidates: presence of
  a `WRITE_OFF`-typed transaction on that loan, `fullyPaid` boolean seen in the sample, or the
  already-known 79 non-reconciling accounts from ADR-007 §4). **This is exactly the population
  ADR-007 §4 already discussed** (79 non-reconciling `CLOSED` accounts, decision: migrate as-is,
  flag for manual review) — that decision should directly inform this field's mapping logic.
- `firstRepaymentDate` — `LoanAccount.firstRepaymentDate` is a **required** field (per ADR-045, no
  fabrication rule exists). Need to confirm every one of the 1,799 rows actually has a usable
  source value (likely `disbursements.first_repayment_date`, joined by `disbursementDetailsKey`) —
  not yet verified for 100% coverage.
- `loanProductVersionId` FK — resolved via `productTypeKey` → migrated `LoanProduct`'s legacyId.
- `assignedBranchKey`/`assignedUserKey` — same open Branch/User FK question as §2.1.

### 2.4 `loan_transactions` → `LoanTransaction`
The highest-volume, highest-risk collection (524,463 rows, financial ledger data). Legacy `type`
has **30 distinct values**; the target `LoanTransactionType` enum has only **10**
(`DISBURSEMENT`, `REPAYMENT`, `FEE_CHARGED`, `PENALTY_APPLIED`, `INTEREST_APPLIED`,
`DEFERRED_INTEREST_APPLIED`, `DEFERRED_INTEREST_PAID`, `TRANSFER`, `ADJUSTMENT`, `REVERSAL`).
Full legacy distribution:

```
PENALTY_APPLIED: 416,034          FEE_ADJUSTMENT: 1,115
REPAYMENT: 33,539                 INTEREST_APPLIED_ADJUSTMENT: 531
INTEREST_APPLIED: 20,146          TRANSFER: 488
FEE_CHARGED: 11,038               DEFERRED_INTEREST_APPLIED_ADJUSTMENT: 384
DEFERRED_INTEREST_APPLIED: 8,184  INTEREST_DUE_REDUCED: 251
DEFERRED_INTEREST_PAID: 7,357     DISBURSMENT_ADJUSTMENT: 239
DISBURSMENT: 6,327                REPAYMENT_UNDO: 213
FEE: 6,194                        DEFERRED_INTEREST_PAID_ADJUSTMENT: 138
PENALTY_ADJUSTMENT: 3,227         PENALTY_REDUCTION_ADJUSTMENT: 95
FEES_DUE_REDUCED: 3,014           INTEREST_REDUCTION_ADJUSTMENT: 95
PENALTIES_DUE_REDUCED: 2,263      TRANSFER_ADJUSTMENT: 34
REPAYMENT_ADJUSTMENT: 2,057       WRITE_OFF: 15
IMPORT: 1,466                     WRITE_OFF_ADJUSTMENT: 6
                                   FEE_REPAYMENT: 6
                                   PENALTY_REPAYMENT: 6
                                   FEE_REDUCTION_ADJUSTMENT: 1
```

**This mapping is NOT something I should decide unilaterally** — several of these are real business
judgment calls (see §5 point 2). `principal_amount`/`interest_amount`/`fees_amount`/
`penalty_amount`/`balance` fields on each transaction map cleanly to `LoanTransaction`'s component
columns regardless of the type-mapping decision.

### 2.5 `co_borrowers` → `CoBorrower` + `LoanAccountCoBorrower`
Clean field match (`first_name`/`middle_name`/`last_name`/`gender`/`civil_status`/`birth_date`/
`email_address`/`phone_number`/`relationship`). `parent_key` resolves the join to the owning
`LoanAccount` (via that loan's own migrated `legacyId`).

### 2.6 `attachments` → `Attachment` (metadata only, per ADR-006)
`Attachment.storageKey` expects an opaque key resolved by the storage adapter — but ADR-006
(referenced in the schema's own comment) already documents that migrating the **physical files**
themselves is unresolved/out of scope. Metadata-only migration (`fileName`, `fileType`, `ownerId`,
`uploadedAt`) with no working `storageKey` would create `Attachment` rows that point at files that
don't exist in the new system's storage — needs an explicit decision (§5 point 3).

---

## 3. Migration approach (proposed shape, not yet built)

1. **Read-only against MongoDB source.** The `.bson` files are parsed directly (this analysis
   already proves that's viable, via the `bson` npm package) — no MongoDB server needs to be stood
   up. `CLAUDE.md`'s "never modify legacy data during migration" is trivially satisfied since the
   script never writes back to the dump.
2. **Idempotent via `legacyId`.** Every migrated row upserts on `legacyId` (already present on
   every relevant model, per §1) — re-running the script twice produces the same end state, not
   duplicates. This is what makes it safe to run repeatedly during development/testing.
3. **Ordered by dependency**, matching the FK graph: `LoanProduct`/`LoanProductVersion` → `Branch`/
   `User` resolution (§5 point 1) → `Borrower` (+ income/gov-id/address/id-docs/character-refs) →
   `LoanAccount` → `CoBorrower` (+ join table) → `LoanTransaction` (batched — 524k rows should not
   be one giant transaction; chunked commits with progress logging) → `RepaymentSchedule` (if a
   source for the original installment schedule exists — not yet confirmed) → `AppliedFee`.
4. **Dry-run mode first.** Script runs in a mode that reports counts/mapping decisions/rejected
   rows without writing anything, so the mapping can be sanity-checked against the real data before
   any Postgres write happens.
5. **A reconciliation report at the end** — per-collection counts in vs. rows migrated vs. rows
   skipped (and why), cross-checked against the known-good counts in §1 and the already-flagged 79
   non-reconciling `CLOSED` accounts from ADR-007 §4.
6. **Runs against a scratch/dev Postgres first**, never directly against a shared/production
   database — this is local dev migration tooling, matching how `bootstrap-admin.ts`/`seed.ts`
   already work in this repo (`scripts/`, not a route, run manually).

---

## 4. What's explicitly NOT in scope for this pass

- **`activities.bson`/`comments.bson`/`custom_field_values.bson`** — not yet even opened for
  inspection. Likely CRM-style notes/audit trail rather than financial ledger data, but this is an
  assumption, not a verified fact — flagged in §5, not silently excluded.
- **`monthly_loan_releases`** — this collection's own sample record has a `loanCreated` date of
  "June 17, 2026" (i.e., it's a **generated reporting snapshot**, refreshed going forward, not
  historical source data) — excluded from migration scope, it's an output artifact, not an input.
- **Physical attachment files** — per ADR-006, already out of scope (existing decision, not new).
- **Branch list, real staff `User` accounts** — ADR-005 already establishes there's no real legacy
  branch list; this migration does not invent one (see §5 point 1).
- **Password/credential migration** — ADR-039 already establishes this never happens.
- **Group-held loans** — moot; confirmed zero exist in the real data (§2.3).

---

## 5. Decisions (locked in 2026-07-08)

1. **Branch/User FK resolution — Option (a).** Migrate everything under the single placeholder HQ
   branch; leave `loanOfficerId`/`assignedLoanOfficerId` null for this pass. Officer attribution
   can be added later as a pure addition once a real staff roster exists — not a rework of this
   migration.
2. **`loan_transactions.type` mapping — `FEE` and `FEE_CHARGED` are genuinely distinct** (confirmed
   by the business, not a data-entry inconsistency) — both map to `LoanTransactionType.FEE_CHARGED`
   on the target side (the new schema doesn't carry the legacy sub-distinction, but the amounts are
   preserved either way; if the sub-distinction turns out to matter later, it's recoverable from
   `legacyId` cross-reference against the original dump, which is never deleted). **The
   `*_ADJUSTMENT` types are loan-officer-initiated manual corrections** (confirmed) — these map to
   the target `ADJUSTMENT` type, a real, distinct event class from the original transaction it
   adjusts (not folded into `reversesTransactionId`, which per TXN-1 is for system-level reversals,
   not a human loan officer's manual correction). `IMPORT` (1,466) — treated as a Mambu-internal
   onboarding marker, not a real financial event; excluded from the migrated `LoanTransaction` rows
   (does not affect any balance — the loan's own `principalDue`/`interestDue`/etc. columns are
   migrated directly from `loan_accounts`, not reconstructed by replaying transactions).
3. **`loan_accounts.accountState: CLOSED` (509 rows) — no three-way split needed.** Confirmed by
   the MIS Manager: **Easycash has no write-off accounts** — collection proceeds via settlement
   only, until an account's status becomes `CLOSED`. All 509 `CLOSED` rows map directly to the
   target `CLOSED` status (paid off), not `CLOSED_WRITTEN_OFF`. `CLOSED_REJECTED` doesn't come from
   this `accountState` value at all — a rejected application never became an active `loan_accounts`
   row in the first place, so this target status simply has no legacy-migrated population (it only
   ever gets created going forward, by the real `RejectLoanUseCase`). The 15 `WRITE_OFF`-typed
   transactions found in `loan_transactions` (§2.4) are migrated as literal ledger entries (they're
   real historical rows) but do **not** drive any status mapping — per the confirmed business fact,
   no loan's *current* state is "written off."
4. **Attachment metadata — migrate it.** All 21,104 `attachments` rows migrate as metadata
   (`fileName`, `fileType`, `ownerId`, `uploadedAt`, `legacyId`) even though the physical files
   themselves remain out of scope (ADR-006). A future storage-migration pass can backfill
   `storageKey` once the actual files are located/transferred; the metadata existing now, even
   temporarily file-less, is still useful (search, counts, "what was on file for this loan").
5. **`activities`/`comments`/`custom_field_values` — confirmed CRM notes, out of scope.** Not
   inspected further; excluded from migration entirely.
6. **`FeeRule` source — Option (a): legacy loans keep their own balances, no back-derived
   `FeeRule` rows.** Each migrated `LoanAccount`'s `feesDue`/`feesPaid` columns already carry the
   real historical fee totals directly from `loan_accounts` — no separate `FeeRule` needs to exist
   for a loan that already happened. `FeeRule` starts being populated only for **new** loan
   products going forward (a real product-configuration task, unrelated to this migration).
7. **Target: local dev Postgres only, this pass.** Confirmed explicit longer-term goal: prove the
   migration is correct and repeatable against a local copy first, so the LMS is provably "fit" for
   Easycash's real backup database before any production cutover is attempted. That cutover is a
   separate, future, explicitly-approved step — not implied or scheduled by this design.

All seven decisions above are final for this implementation pass. Proceed to build the migration
script per §3's approach.
