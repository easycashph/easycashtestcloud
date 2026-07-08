# CP12 — Legacy MongoDB Migration: Analysis & Design

**Status:** DESIGN — not yet approved for implementation.
**Prepared:** 2026-07-08.
**Scope:** Milestone 9.1's last remaining checkpoint (CP12) — migrating the real legacy Mambu-era
MongoDB export into `app/backend`'s Postgres schema. Per `CLAUDE.md`'s workflow, this document is
the analyze/design step; no migration script is written or run against Postgres until this is
approved, and the specific open questions in §5 are answered.

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

## 5. Open questions — need your decision before implementation starts

1. **Branch/User FK resolution.** Every `loan_accounts`/`client_accounts` row references a legacy
   `assignedBranchKey`/`assignedUserKey`, but the new schema has no migrated branch list or staff
   roster yet (ADR-005: only one placeholder "HQ" branch exists). Options: (a) migrate everything
   under the single placeholder HQ branch, leaving `loanOfficerId`/`assignedLoanOfficerId` null
   (defer officer attribution to later), or (b) first migrate `mambu_users` into real `User` rows
   (per ADR-039, identity-only, no passwords) so officer attribution is preserved from day one.
   **Recommendation: (a) for a first pass** — officer attribution is valuable but not
   correctness-critical the way balances/transactions are, and doing it later is a pure addition,
   not a rework.
2. **`loan_transactions.type` mapping (30 legacy values → 10 target values).** Needs your business
   judgment, not mine, for at least: `IMPORT` (1,466 — likely a Mambu-internal migration marker
   from *their own* onboarding; may not represent a real financial event at all), `FEE` vs.
   `FEE_CHARGED` (two distinct legacy types, 6,194 and 11,038 rows respectively — is this a
   real distinction or a data-entry inconsistency?), the six `*_REPAYMENT`/`*_REDUCED` types
   (do these net against the ledger or are they display-only annotations?), and whether every
   `*_ADJUSTMENT` type should collapse into the single target `ADJUSTMENT` value (losing which
   original component it adjusted) or whether `LoanTransaction`'s existing `reversesTransactionId`
   self-link is the intended mechanism instead (per TXN-1's "corrections are new, explicitly linked
   reversal transactions").
3. **`loan_accounts.accountState: CLOSED` (509 rows) → three-way split.** Needs a concrete rule:
   what signal distinguishes a normally-paid-off `CLOSED` loan from a `CLOSED_WRITTEN_OFF` or
   `CLOSED_REJECTED` one? Candidate signals found so far: a `WRITE_OFF`-typed transaction present
   on the loan (15 exist total, far fewer than 509 — so most `CLOSED` loans are presumably
   paid-off, not written-off), the `fullyPaid` boolean seen in the `loan_accounts` sample document,
   or cross-referencing the 79 non-reconciling accounts already named in ADR-007 §4.
4. **Attachment metadata migration.** Migrate the 21,104 `attachments` rows as metadata-only
   (`storageKey` pointing at nothing, since the physical files are out of scope per ADR-006), skip
   entirely for this pass, or something else? Metadata with no retrievable file may be more
   confusing than useful in the new system's UI.
5. **`activities`/`comments`/`custom_field_values` collections** — confirm these are genuinely out
   of scope (CRM/notes data, not financial ledger data) before I spend time inspecting their
   ~280 MB combined, or is there something in there that actually needs to migrate?
6. **`FeeRule` source.** No per-product fee-rule-shaped field was found in the `loan_products`
   sample — fee amounts appear to live per-transaction (`fees_amount`) rather than as a declared
   rule. Should `FeeRule` rows be back-derived from historical fee transaction patterns (a real
   inference, not a direct migration), left empty for legacy loans (fees already baked into each
   loan's `feesDue`/`feesPaid` balance columns, no separate rule needed for historical data), or is
   there a fee-schedule source I haven't found yet?
7. **Where does this migration run, and when?** Confirm this is scoped to populate **your own local
   dev Postgres** (matching `bootstrap-admin.ts`'s "local dev tooling" precedent) for now, not a
   shared/production target — a real production cutover would need its own separate go-ahead,
   timing, and rollback plan, well beyond this design pass.

**Do not start implementing until this design is explicitly approved — including the open
questions above that materially change what the migration script does.**
