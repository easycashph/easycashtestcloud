# CP12 — Legacy Core-Loan-Data Migration Report

**Date:** 2026-07-09
**Script:** `app/backend/scripts/migrate-legacy-data.ts` (`npx tsx scripts/migrate-legacy-data.ts [--dry-run]`)
**Source:** `legacy/MongoDB dump/07092026_ 92543.zip`, `db-easycash` database (read-only — never modified)
**Target:** PostgreSQL `easycash` database (Docker volume `easycash_postgres_data`)

## Scope (confirmed 2026-07-09)

Core loan data only: `Borrower` (+ income detail, ID documents, character references),
`CoBorrower`, `Address` (polymorphic), `LoanProduct` + one `LoanProductVersion` each,
`LoanAccount`, `LoanTransaction`. Explicitly **out of scope**: `activities`, `comments`,
`attachments`, `custom_field_values`, `sms`/`sms_logs`, address-api reference data.

## Decisions confirmed before implementation

1. **Branch/officer:** all migrated loans assigned to `HQ` branch, no loan officer (nullable) —
   legacy branch/officer keys have no corresponding real `Branch`/`User` rows yet, and none were
   fabricated.
2. **Balance treatment:** per `ADR-007` §4 (resolved 2026-07-08) — all loan accounts migrated
   as-is, including non-reconciling `CLOSED` accounts, with balances exactly as recorded.

## Verified linkage keys (confirmed against real data before writing)

| Relationship | Key | Match rate |
|---|---|---|
| `loan_accounts.accountHolderKey` → `client_accounts.uid` | uid | 1790/1805 (99.2%) |
| `loan_accounts.productTypeKey` → `loan_products.uid` | uid | 1805/1805 (100%) |
| `co_borrowers.parent_key` → `client_accounts._id` | _id | 234/251 (93%) |
| `addresses.parent_key` → `client_accounts._id` OR `co_borrowers._id` (polymorphic) | mixed | 1186/1274 (93%) |
| `identification_documents.client_key` → `client_accounts.uid` | uid | 442/455 (97%) |
| `client_income_details.parent_key` → `client_accounts._id` OR `.uid` (inconsistent across records) | mixed | 554/618 (90%) |
| `character_references.parent_key` → `client_accounts._id` OR `.uid` (inconsistent) | mixed | 72/54\* | 
| `loan_transactions.parent_account_key` → `loan_accounts.uid` | uid | 280,172/524,575 (53%) |

\* Overlap counted both ways in verification sample; final script resolves via `_id` first, `uid` fallback.

## Result (actual PostgreSQL row counts, post-migration)

| Table | Rows |
|---|---|
| `borrowers` | 4,604 (4,629 source rows; some legacy duplicates share the same `uid` and collapsed via upsert) |
| `loan_products` | 44 |
| `loan_product_versions` | 44 |
| `loan_accounts` | 1,790 / 1,805 source rows |
| `loan_transactions` | 280,172 / 524,575 source rows |
| `co_borrowers` | 251 |
| `addresses` | 2,372 |
| `identification_documents` | 440 |
| `character_references` | 46 |
| `borrower_income_details` | 334 |

## Known gaps (flagged, not fabricated)

- **`LoanAccount.firstRepaymentDate`** approximated from `creationDate` — no reliable legacy
  source field exists for this (per `ADR-045`, no rule exists to derive it). Needs a
  business-confirmed correction pass if the exact historical first-repayment date matters for
  any migrated loan.
- **`LoanAccount` ↔ `CoBorrower` linkage not migrated** — legacy `co_borrowers.parent_key` links
  to the primary client, not a specific loan account, so which loan(s) each co-borrower applied
  to could not be reliably re-derived from this export.
- **`RepaymentSchedule` not migrated** — the legacy `payment_schedules` collection is empty in
  this export (0 documents). Schedules for migrated loans will need to be regenerated or
  reconstructed separately if historical installment-level detail is required.
- **244,403 `loan_transactions` (47%) skipped** — these reference `loan_accounts` that exist in
  the transaction history but are absent from the current `loan_accounts.bson` export (older/
  archived accounts not present in this particular dump). Not fabricated or dropped silently —
  logged and counted.
- **15 `loan_accounts` skipped** — unresolved borrower or product linkage.
- **12 legacy loan accounts share a duplicate `id` (loan code)** with another account — a real
  legacy data-quality issue. The 2nd+ occurrence was migrated with a deterministic `-DUPn` suffix
  on `loanCode` rather than being dropped or silently renamed, preserving full history for both.
- **28 legacy transaction sub-types collapsed into the new schema's 10-value
  `LoanTransactionType` enum** by closest semantic bucket (e.g. all `*_ADJUSTMENT`/`*_REDUCED`
  variants → `ADJUSTMENT`, `WRITE_OFF`/`WRITE_OFF_ADJUSTMENT` → `ADJUSTMENT`). The original
  legacy type is preserved verbatim as a `[legacy:TYPE]` prefix on the transaction `comment` for
  every row where the mapping is lossy, so no classification information is silently discarded.

## Idempotency

The script upserts on each model's `legacyId` unique constraint (or a manual dedupe check where
no such column exists — `IdentificationDocument`, `CharacterReference`). Re-running is safe and
was in fact required once during this run (fixed a type-coercion bug and a duplicate-loan-code
collision mid-migration, then re-ran to completion without data loss or duplication).

## Follow-up fix — address barangay/city/province stored as raw codes (2026-07-09)

Discovered post-migration: 65% of legacy address records (830/1,274, later found to be 1,516/2,372
once co-borrower addresses were included) stored `barangay`/`city_municipality`/`province` as raw
PSGC codes (e.g. barangay `"137404005"`) rather than names — a real split in the legacy source
itself (the other addresses stored names directly), not a migration bug; the original migration
correctly passed through whatever the source contained verbatim.

Fixed with a second, separate script — `app/backend/scripts/resolve-address-codes.ts`
(`npx tsx scripts/resolve-address-codes.ts [--dry-run]`) — which resolves codes to names using the
legacy `db-address-api` MongoDB export's own `barangays`/`citymunicipalities`/`provinces` lookup
tables (also read-only, never modified) and updates the affected `addresses` rows in place.
**Result:** 1,516 addresses resolved and updated; 852 were already text and left untouched; 4 had a
barangay code (`"831"`) that doesn't match any PSGC lookup entry and were left as-is rather than
guessed.
