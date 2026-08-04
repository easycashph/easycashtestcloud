/* eslint-disable no-console */
/**
 * CP12 — Legacy MongoDB → Postgres migration.
 * Design: `docs/Architecture/CP12_LEGACY_MIGRATION_DESIGN.md` (all mapping decisions locked in
 * 2026-07-08 — read that document before changing anything here).
 *
 * Reads the legacy Mambu-era `mongodump` export directly from its `.bson` files (never connects
 * to a live MongoDB, never writes back to the dump — CLAUDE.md's "never modify legacy data during
 * migration"). Idempotent: every row upserts on `legacyId`. The three borrower child tables that
 * have no natural unique key of their own (Address, IdentificationDocument, CharacterReference)
 * are made idempotent via delete-then-recreate per borrower (2026-07-14 fix — a plain `.create()`
 * here used to duplicate these three tables' rows on every re-run against an already-migrated DB;
 * caught before re-running against the 07142026 snapshot).
 *
 * DUMP_DIR points at a specific dated mongodump snapshot — update it (and the doc comment date
 * below) whenever migrating against a newer snapshot; the previous snapshot directory is not kept
 * around once superseded.
 *
 * Usage:
 *   npx tsx scripts/migrate-legacy-data.ts            # dry run — reports counts, writes nothing
 *   npx tsx scripts/migrate-legacy-data.ts --apply     # actually writes to the configured DATABASE_URL
 *
 * Target: local dev Postgres only, per design doc §5 point 7 — this is local dev tooling
 * (`scripts/`, not a route), matching `bootstrap-admin.ts`/`seed.ts`'s existing precedent. A
 * future production cutover is a separate, later, separately-approved step.
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = legacyDbEasycashDir();
const HQ_BRANCH_CODE = 'HQ';

// ----------------------------------------------------------------------------
// BSON reading
// ----------------------------------------------------------------------------

function* iterDocs<T = Record<string, unknown>>(collection: string): Generator<T> {
  const file = path.join(DUMP_DIR, `${collection}.bson`);
  const buf = fs.readFileSync(file);
  let offset = 0;
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    if (size <= 0) break;
    yield BSON.deserialize(buf.subarray(offset, offset + size)) as T;
    offset += size;
  }
}

function loadAll<T = Record<string, unknown>>(collection: string): T[] {
  return [...iterDocs<T>(collection)];
}

function indexBy<T extends Record<string, unknown>>(docs: T[], key: string): Map<string, T> {
  const map = new Map<string, T>();
  for (const d of docs) {
    const k = d[key];
    if (k !== undefined && k !== null) map.set(String(k), d);
  }
  return map;
}

function groupBy<T extends Record<string, unknown>>(docs: T[], key: string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const d of docs) {
    const k = d[key];
    if (k === undefined || k === null) continue;
    const arr = map.get(String(k)) ?? [];
    arr.push(d);
    map.set(String(k), arr);
  }
  return map;
}

// ----------------------------------------------------------------------------
// Small helpers
// ----------------------------------------------------------------------------

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDecimalString(value: unknown): string {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

interface Reconciliation {
  collection: string;
  sourceCount: number;
  migrated: number;
  skipped: number;
  skipReasons: Map<string, number>;
}

function newReconciliation(collection: string, sourceCount: number): Reconciliation {
  return { collection, sourceCount, migrated: 0, skipped: 0, skipReasons: new Map() };
}

function recordSkip(rec: Reconciliation, reason: string): void {
  rec.skipped++;
  rec.skipReasons.set(reason, (rec.skipReasons.get(reason) ?? 0) + 1);
}

function printReconciliation(recs: Reconciliation[]): void {
  console.log('\n=== Reconciliation ===');
  for (const r of recs) {
    console.log(`${r.collection}: source=${r.sourceCount} migrated=${r.migrated} skipped=${r.skipped}`);
    for (const [reason, count] of r.skipReasons) {
      console.log(`    skipped (${reason}): ${count}`);
    }
  }
}

// ----------------------------------------------------------------------------
// Phase 1: LoanProduct + LoanProductVersion + PenaltyRule
// Design doc §2.2 — 44 legacy products, one LoanProductVersion each (no retroactive
// version-history reconstruction, per ADR-002/ADR-003).
// ----------------------------------------------------------------------------

const INTEREST_CALC_METHOD_MAP: Record<string, string> = {
  FLAT: 'FLAT',
  DECLINING_BALANCE: 'DECLINING_BALANCE',
  DECLINING_BALANCE_DISCOUNTED: 'DECLINING_BALANCE_DISCOUNTED',
};

const ROUNDING_METHOD_MAP: Record<string, string> = {
  NO_ROUNDING: 'NO_ROUNDING',
  ROUND_REMAINDER_INTO_LAST_REPAYMENT: 'ROUND_REMAINDER_INTO_LAST_REPAYMENT',
};

const PENALTY_CALC_METHOD_MAP: Record<string, string> = {
  NONE: 'NONE',
  PERCENTAGE_PER_DAY: 'OVERDUE_BALANCE_AND_INTEREST',
  ON_REPAYMENT: 'ON_REPAYMENT',
};

/**
 * 2026-07-11: the source `loan_products` document for `id: "CM-Car"` (`_id`
 * `658561a4446af7f39eb85513`) has its `name` field genuinely corrupted at the source — a JSON blob
 * (apparently `{"description":"Chattel mortgage with impounded car as security","addOnRates":[1.75,
 * ..., 2.25]}`) got comma-split across the `description`/`name`/`prepaymant_acceptance` fields
 * (likely a CSV-style import bug in the legacy system, not something this migration introduced).
 * `name` ended up as the literal string `"addOnRates:[1.75"`. Recovered the real product identity
 * from the still-legible `description` fragment and confirmed the replacement name with the user
 * before applying it directly to the DB — recorded here too so a future re-run of this
 * (idempotent-by-design) script doesn't silently revert that fix back to the corrupted value.
 * This product has zero real loan accounts/applications, so no historical data is at risk either
 * way.
 */
const KNOWN_CORRUPTED_PRODUCT_NAMES: Record<string, string> = {
  'CM-Car': 'Chattel Mortgage - Car',
};

async function migrateLoanProducts(): Promise<{ rec: Reconciliation; productVersionIdByLegacyKey: Map<string, string> }> {
  const products = loadAll<any>('loan_products');
  const rec = newReconciliation('loan_products', products.length);
  const productVersionIdByLegacyKey = new Map<string, string>();

  for (const p of products) {
    const uid = String(p.uid ?? p._id);
    const code = String(p.id ?? uid);
    const interestMethod = INTEREST_CALC_METHOD_MAP[String(p.interest_calculation_method)];
    if (!interestMethod) {
      recordSkip(rec, `unmapped interest_calculation_method=${p.interest_calculation_method}`);
      continue;
    }
    const loanAmountMin = p.loan_amount?.minimum ?? p.loan_amount?.default ?? 0;
    const name = KNOWN_CORRUPTED_PRODUCT_NAMES[code] ?? String(p.name ?? code);

    if (APPLY) {
      const product = await prisma.loanProduct.upsert({
        where: { code },
        update: { name },
        create: { code, name, description: null },
      });

      const version = await prisma.loanProductVersion.upsert({
        where: { legacyId: uid },
        update: {},
        create: {
          loanProductId: product.id,
          versionNumber: 1,
          isActive: Boolean(p.active),
          effectiveFrom: toDate(p.createdAt) ?? new Date(),
          interestCalculationMethod: interestMethod as never,
          repaymentScheduleMethod: 'FIXED',
          repaymentPeriodUnit: 'MONTHS',
          settlementOption: 'FULL_DUE_AMOUNTS',
          roundingMethod: (ROUNDING_METHOD_MAP[String(p.rounding_repayment_schedule_method)] ?? 'NO_ROUNDING') as never,
          loanAmountMin: toDecimalString(loanAmountMin),
          loanAmountMax: p.loan_amount?.maximum != null ? toDecimalString(p.loan_amount.maximum) : null,
          loanAmountDefault: p.loan_amount?.default != null ? toDecimalString(p.loan_amount.default) : null,
          installmentCountMin: Number(p.num_installments?.minimum ?? 1),
          installmentCountMax: p.num_installments?.maximum != null ? Number(p.num_installments.maximum) : null,
          installmentCountDefault: p.num_installments?.default != null ? Number(p.num_installments.default) : null,
          gracePeriodType: String(p.grace_period?.type ?? 'NONE'),
          gracePeriodDefaultDays: Number(p.grace_period?.default ?? 0),
          legacyId: uid,
        },
      });
      productVersionIdByLegacyKey.set(uid, version.id);

      const penaltyMethod = PENALTY_CALC_METHOD_MAP[String(p.penalty_calculation_method ?? p.loan_penalty_calculation_method)] ?? 'NONE';
      await prisma.penaltyRule.upsert({
        where: { loanProductVersionId: version.id },
        update: {},
        create: {
          loanProductVersionId: version.id,
          calculationMethod: penaltyMethod as never,
          ratePercent: p.penalty_rate?.default != null ? toDecimalString(p.penalty_rate.default) : null,
          capPercent: p.penalty_rate?.maximum != null ? toDecimalString(p.penalty_rate.maximum) : null,
          gracePeriodDays: Number(p.grace_period?.default ?? 0),
        },
      });
    } else {
      productVersionIdByLegacyKey.set(uid, `dry-run:${uid}`);
    }
    rec.migrated++;
  }

  return { rec, productVersionIdByLegacyKey };
}

// ----------------------------------------------------------------------------
// Phase 2: Borrower + related tables
// Design doc §2.1 — 4,629 legacy clients.
// ----------------------------------------------------------------------------

const BORROWER_STATUS_MAP: Record<string, string> = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  EXITED: 'INACTIVE',
  REJECTED: 'INACTIVE',
};

async function migrateBorrowers(hqBranchId: string): Promise<{ rec: Reconciliation; borrowerIdByLegacyKey: Map<string, string> }> {
  const clients = loadAll<any>('client_accounts');
  const rec = newReconciliation('client_accounts', clients.length);
  const borrowerIdByLegacyKey = new Map<string, string>();

  const incomeByParent = indexBy(loadAll<any>('client_income_details'), 'parent_key');
  const govIdByParent = indexBy(loadAll<any>('client_other_details'), 'parent_key');
  const addressesByParent = groupBy(loadAll<any>('addresses'), 'parent_key');
  const idDocsByClientKey = groupBy(loadAll<any>('identification_documents'), 'client_key');
  const charRefsByParent = groupBy(loadAll<any>('character_references'), 'parent_key');

  for (const c of clients) {
    const uid = String(c.uid ?? c._id);
    const status = BORROWER_STATUS_MAP[String(c.state)];
    if (!status) {
      recordSkip(rec, `unmapped state=${c.state}`);
      continue;
    }
    if (!c.first_name || !c.last_name) {
      recordSkip(rec, 'missing first/last name');
      continue;
    }

    if (APPLY) {
      const borrower = await prisma.borrower.upsert({
        where: { legacyId: uid },
        update: {},
        create: {
          branchId: hqBranchId,
          firstName: String(c.first_name),
          middleName: c.middle_name ? String(c.middle_name) : null,
          lastName: String(c.last_name),
          gender: c.gender ? String(c.gender) : null,
          birthDate: toDate(c.birthdate),
          civilStatus: c.civil_status ? String(c.civil_status) : null,
          mobilePhone1: c.mobile_phone_1 != null ? String(c.mobile_phone_1) : null,
          mobilePhone2: c.mobile_phone_2 != null ? String(c.mobile_phone_2) : null,
          email: c.email_address ? String(c.email_address) : null,
          status: status as never,
          loanCycle: Number(c.loan_cycle ?? 0),
          legacyId: uid,
        },
      });
      borrowerIdByLegacyKey.set(uid, borrower.id);
      borrowerIdByLegacyKey.set(String(c._id), borrower.id);

      const income = incomeByParent.get(String(c._id));
      if (income) {
        await prisma.borrowerIncomeDetail.upsert({
          where: { borrowerId: borrower.id },
          update: {},
          create: {
            borrowerId: borrower.id,
            employmentType: income.employment_type || null,
            employerName: income.employer_name || null,
            employerAddress: income.employer_address || null,
            natureOfBusiness: income.nature_of_business || null,
            position: income.position || null,
            yearsEmployed: income.years_employed != null ? Number(income.years_employed) : null,
          },
        });
      }

      const govId = govIdByParent.get(String(c._id));
      if (govId) {
        await prisma.borrowerGovernmentId.upsert({
          where: { borrowerId: borrower.id },
          update: {},
          create: {
            borrowerId: borrower.id,
            sssNumber: govId.sss_number || null,
            tinNumber: govId.tin_number || null,
          },
        });
      }

      await prisma.address.deleteMany({ where: { ownerType: 'BORROWER', ownerId: borrower.id } });
      for (const addr of addressesByParent.get(String(c._id)) ?? []) {
        await prisma.address.create({
          data: {
            ownerType: 'BORROWER',
            ownerId: borrower.id,
            addressType: addr.address_type || null,
            houseUnitNumber: addr.house_unit_number || null,
            street: addr.street || null,
            barangay: addr.barangay || null,
            cityMunicipality: addr.city_municipality || null,
            province: addr.province || null,
            zipCode: addr.zip_code || null,
            lengthOfStayMonths: addr.length_of_stay != null ? Number(addr.length_of_stay) : null,
            ownershipStatus: addr.status || null,
          },
        });
      }

      await prisma.identificationDocument.deleteMany({ where: { borrowerId: borrower.id } });
      for (const doc of idDocsByClientKey.get(uid) ?? []) {
        if (!doc.document_id || !doc.document_type) continue;
        await prisma.identificationDocument.create({
          data: {
            borrowerId: borrower.id,
            documentType: String(doc.document_type),
            documentNumber: String(doc.document_id),
            issuingAuthority: doc.is_using_authority || null,
            validUntil: toDate(doc.valid_until),
          },
        });
      }

      await prisma.characterReference.deleteMany({ where: { borrowerId: borrower.id } });
      for (const ref of charRefsByParent.get(String(c._id)) ?? []) {
        if (!ref.first_name || !ref.last_name) continue;
        await prisma.characterReference.create({
          data: {
            borrowerId: borrower.id,
            firstName: String(ref.first_name),
            lastName: String(ref.last_name),
            relationship: ref.relationship || null,
            phoneNumber: ref.phone_number != null ? String(ref.phone_number) : null,
            emailAddress: ref.email_address || null,
          },
        });
      }
    } else {
      borrowerIdByLegacyKey.set(uid, `dry-run:${uid}`);
      borrowerIdByLegacyKey.set(String(c._id), `dry-run:${uid}`);
    }
    rec.migrated++;
  }

  return { rec, borrowerIdByLegacyKey };
}

// ----------------------------------------------------------------------------
// Phase 3: LoanAccount + CoBorrower
// Design doc §2.3/§2.5 — 1,799 legacy loans. accountHolderType is 100% CLIENT (verified) so no
// Group-loan handling is needed (ADR-004).
// ----------------------------------------------------------------------------

const LOAN_STATUS_MAP: Record<string, string> = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  ACTIVE: 'ACTIVE',
  ACTIVE_IN_ARREARS: 'ACTIVE_IN_ARREARS',
  // Design doc §5 point 3: confirmed by the MIS Manager — no write-off accounts exist;
  // every legacy CLOSED loan is a normal settled/paid-off closure.
  CLOSED: 'CLOSED',
};

async function migrateLoanAccounts(
  hqBranchId: string,
  productVersionIdByLegacyKey: Map<string, string>,
  borrowerIdByLegacyKey: Map<string, string>,
): Promise<{ rec: Reconciliation; loanAccountIdByLegacyKey: Map<string, string> }> {
  // 2026-08-03 (user-reported): the plain `update: {}` below meant a loan's status/balances froze
  // at whatever they were the FIRST time it was migrated - fine for a one-shot migration, but this
  // script is now re-run regularly against fresh SDevTech snapshots (see scripts/lib/
  // legacyDumpPath.ts), and staff still record everything in SDevTech (the LMS isn't live yet per
  // user confirmation 2026-08-03) - so an already-migrated loan that advances from APPROVED to
  // ACTIVE (or gets new payments) in SDevTech needs that reflected here too. Only safe to do while
  // NO native (non-legacy) activity exists on that loan in the new system - the moment a real
  // ProcessPaymentUseCase/etc. transaction is recorded here, this system becomes the source of
  // truth for that loan and must never again be overwritten by a legacy re-sync.
  const lockedLoanAccountIds = new Set(
    (
      await prisma.loanTransaction.findMany({
        where: { legacyId: null, loanAccount: { legacyId: { not: null } } },
        select: { loanAccountId: true },
        distinct: ['loanAccountId'],
      })
    ).map((t) => t.loanAccountId),
  );

  const loans = loadAll<any>('loan_accounts');
  const rec = newReconciliation('loan_accounts', loans.length);
  const loanAccountIdByLegacyKey = new Map<string, string>();
  // Design doc discovery (2026-07-08 apply run): 12 legacy loan codes are reused across exactly 2
  // real records each (different uid/creationDate — a renewal-style reuse pattern, not a data
  // error), but `LoanAccount.loanCode` is `@unique`. Both records are real financial history and
  // must both migrate — the second occurrence gets a `-LEGACY2` suffix so neither is dropped.
  //
  // 2026-08-01 bug fix: this map used to start empty on every run, so it only knew about reused
  // codes it had itself seen THIS run. Fine for a single one-shot full migration, but this script
  // is also re-run incrementally against newer legacy snapshots (idempotent upserts elsewhere in
  // this file are designed for exactly that) — if occurrence #1 of a reused code was migrated in
  // an earlier run and occurrence #2 only shows up in a later snapshot, this run would see it as
  // "occurrence #1" too and collide on the unique loanCode constraint (P2002). Seed the map from
  // every loanCode already in Postgres so usage counts survive across runs.
  const loanCodeUsageCount = new Map<string, number>();
  if (APPLY) {
    const existing = await prisma.loanAccount.findMany({ select: { loanCode: true } });
    for (const { loanCode } of existing) {
      const match = /^(.*)-LEGACY(\d+)$/.exec(loanCode);
      const base = match ? match[1]! : loanCode;
      const count = match ? Number(match[2]) : 1;
      loanCodeUsageCount.set(base, Math.max(loanCodeUsageCount.get(base) ?? 0, count));
    }
  }

  const disbursementsByUid = indexBy(loadAll<any>('disbursements'), 'uid');
  const coBorrowersByClientId = groupBy(loadAll<any>('co_borrowers'), 'parent_key');
  const clientAccounts = loadAll<any>('client_accounts');
  const clientIdByAccountHolderKey = indexBy(clientAccounts, 'uid');

  // 2026-08-04 (user-confirmed): fallback for `firstRepaymentDate` when `disbursements` is missing
  // it (7 loans, e.g. OTH-COMP_U0O3O) - NOT fabrication, since these loans have a real, already-
  // scheduled `repayments.bson` record with its own genuine `due_date`; that collection was simply
  // never consulted here (only by the separate `migrate-repayment-schedules.ts`). Uses the earliest
  // due_date across each loan's repayment rows, same "anchor = first scheduled installment" concept
  // ADR-045 already uses for `disbursements.first_repayment_date` itself.
  const earliestRepaymentDueDateByUid = new Map<string, Date>();
  for (const r of loadAll<any>('repayments')) {
    const uid = String(r.parent_account_key);
    const due = toDate(r.due_date);
    if (!due) continue;
    const existing = earliestRepaymentDueDateByUid.get(uid);
    if (!existing || due < existing) earliestRepaymentDueDateByUid.set(uid, due);
  }

  for (const la of loans) {
    const legacyId = String(la.uid ?? la._id);
    const status = LOAN_STATUS_MAP[String(la.accountState)];
    if (!status) {
      recordSkip(rec, `unmapped accountState=${la.accountState}`);
      continue;
    }
    const productVersionId = productVersionIdByLegacyKey.get(String(la.productTypeKey));
    if (!productVersionId) {
      recordSkip(rec, 'unresolved loan product');
      continue;
    }
    const client = clientIdByAccountHolderKey.get(String(la.accountHolderKey));
    const borrowerId = client ? borrowerIdByLegacyKey.get(String(client._id)) : undefined;
    if (!borrowerId) {
      recordSkip(rec, 'unresolved borrower');
      continue;
    }
    const disb = disbursementsByUid.get(String(la.disbursementDetailsKey));
    const firstRepaymentDate = toDate(disb?.first_repayment_date) ?? earliestRepaymentDueDateByUid.get(String(la.uid));
    // 2026-07-17 bug fix (user-reported): `activatedAt` - treated everywhere downstream as the
    // official Disbursement Date (ADR-032; read by LoanDocumentMergeDataResolver and the Loan
    // Releases report) - used to be sourced from `la.creationDate` (the loan-account record's
    // creation timestamp, not a disbursement event). Real source is `disb.disbursment_date` [sic,
    // legacy typo]; falls back to `disb.expected_disbursement_date` for the ~23 legacy records
    // missing the real one. See `scripts/backfill-legacy-disbursement-dates.ts`, which corrected
    // the 1,754 already-migrated loans this bug affected (idempotent upserts here don't retouch
    // existing rows - `update: {}` below - so a fix here alone wouldn't have reached them).
    const activatedAt = toDate(disb?.disbursment_date) ?? toDate(disb?.expected_disbursement_date);
    if (!firstRepaymentDate) {
      // Design doc §3 point "firstRepaymentDate": no fabrication rule exists (ADR-045) - skipped
      // rather than guessed, per CLAUDE.md "never fabricate financial logic". Genuinely reachable
      // only when a loan has neither a `disbursements.first_repayment_date` NOR any `repayments`
      // row at all (the fallback above) - i.e. no real source anywhere in the dump for this date.
      recordSkip(rec, 'missing firstRepaymentDate (no fabrication per ADR-045)');
      continue;
    }

    const baseCode = String(la.id ?? legacyId);
    const usageCount = (loanCodeUsageCount.get(baseCode) ?? 0) + 1;
    loanCodeUsageCount.set(baseCode, usageCount);
    const loanCode = usageCount === 1 ? baseCode : `${baseCode}-LEGACY${usageCount}`;

    if (APPLY) {
      // 2026-08-04 bug fix (user-reported, found via a real case - OTH-COMP_00002 showing ₱0
      // balance in the LMS despite owing ₱1.6M+ per SDevTech's own live report): 183 legacy loans
      // have NO account-level balance snapshot fields at all in the source (not zero - absent),
      // same population `flag-missing-balance-loans.ts`/`legacyBalanceDataMissing` already exists
      // for. `recompute-active-loan-balances-from-schedule.ts` correctly derives their real balance
      // from RepaymentSchedule - but every subsequent incremental re-migration run was blindly
      // resyncing these loans' balance fields back to `la.principalBalance ?? 0`, silently
      // destroying that correction and making real, uncollected debt disappear from the LMS again.
      // Balance fields are now excluded from the resync entirely (not defaulted to 0) whenever the
      // source itself has no balance snapshot - `recompute-active-loan-balances-from-schedule.ts`
      // remains the one source of truth for these loans' balance until a real snapshot exists.
      const hasAccountLevelBalanceData = la.principalBalance !== undefined || la.interestBalance !== undefined;

      // Shared between create (first migration) and the resync update (subsequent re-runs) so the
      // two paths can never drift apart - see the "locked" comment above migrateLoanAccounts.
      const balanceFields = {
        principalBalance: toDecimalString(la.principalBalance ?? 0),
        principalPaid: toDecimalString(la.principalPaid ?? 0),
        principalDue: toDecimalString(la.principalDue ?? 0),
        interestBalance: toDecimalString(la.interestBalance ?? 0),
        interestPaid: toDecimalString(la.interestPaid ?? 0),
        interestDue: toDecimalString(la.interestDue ?? 0),
        feesBalance: toDecimalString(la.feesBalance ?? 0),
        feesPaid: toDecimalString(la.feesPaid ?? 0),
        feesDue: toDecimalString(la.feesDue ?? 0),
        penaltyBalance: toDecimalString(la.penaltyBalance ?? 0),
        penaltyPaid: toDecimalString(la.penaltyPaid ?? 0),
        penaltyDue: toDecimalString(la.penaltyDue ?? 0),
      };
      const financialSnapshot = {
        status: status as never,
        ...balanceFields,
        approvedAt: toDate(la.approvedDate),
        activatedAt,
        closedAt: toDate(la.closedDate),
      };
      const resyncSnapshot = hasAccountLevelBalanceData
        ? financialSnapshot
        : { status: status as never, approvedAt: toDate(la.approvedDate), activatedAt, closedAt: toDate(la.closedDate) };

      const existing = await prisma.loanAccount.findUnique({ where: { legacyId }, select: { id: true } });
      const isLocked = existing ? lockedLoanAccountIds.has(existing.id) : false;

      const loanAccount = await prisma.loanAccount.upsert({
        where: { legacyId },
        update: isLocked ? {} : resyncSnapshot,
        create: {
          loanCode,
          borrowerId,
          loanProductVersionId: productVersionId,
          branchId: hqBranchId,
          // 2026-07-17 bug fix (user-reported): without this, Prisma's `@default(now())` recorded
          // the migration run's own timestamp as "created," not the real SDevTech loan-account
          // creation date. See `scripts/backfill-legacy-loan-created-dates.ts`, which corrected
          // the 1,783 already-migrated loans this affected. (An earlier theory - deriving this
          // from a zero-principal DISBURSEMENT transaction - was checked against the data and
          // ruled out: only 21% of loans have one, and 80% of those postdate the real
          // disbursement, so they're some other event, not account creation.)
          createdAt: toDate(la.creationDate) ?? undefined,
          principalAmount: toDecimalString(la.loanAmount ?? la.principalBalance ?? 0),
          interestRate: toDecimalString(la.interestRate ?? 0),
          installmentCount: Number(la.repaymentInstallments ?? 1),
          repaymentPeriodUnit: 'MONTHS',
          gracePeriodDays: Number(la.gracePeriod ?? 0),
          firstRepaymentDate,
          legacyId,
          legacyBalanceDataMissing: !hasAccountLevelBalanceData,
          ...financialSnapshot,
        },
      });
      loanAccountIdByLegacyKey.set(legacyId, loanAccount.id);

      // Design doc §5 point: co_borrowers.parent_key resolves to the Borrower (client), not a
      // specific loan (ADR-015 remains PENDING) — attached to every one of that borrower's
      // migrated loans as a practical default; revisit once ADR-015 is formally decided.
      const legacyClientId = client ? String(client._id) : null;
      if (legacyClientId) {
        for (const cb of coBorrowersByClientId.get(legacyClientId) ?? []) {
          if (!cb.first_name || !cb.last_name) continue;
          const coBorrower = await prisma.coBorrower.upsert({
            where: { legacyId: String(cb.uid ?? cb._id) },
            update: {},
            create: {
              firstName: String(cb.first_name),
              lastName: String(cb.last_name),
              gender: cb.gender || null,
              civilStatus: cb.civil_status || null,
              birthDate: toDate(cb.birth_date),
              phoneNumber: cb.phone_number != null ? String(cb.phone_number) : null,
              emailAddress: cb.email_address || null,
              relationship: cb.relationship || null,
              legacyId: String(cb.uid ?? cb._id),
            },
          });
          await prisma.loanAccountCoBorrower.upsert({
            where: { loanAccountId_coBorrowerId: { loanAccountId: loanAccount.id, coBorrowerId: coBorrower.id } },
            update: {},
            create: { loanAccountId: loanAccount.id, coBorrowerId: coBorrower.id },
          });
        }
      }
    } else {
      loanAccountIdByLegacyKey.set(legacyId, `dry-run:${legacyId}`);
    }
    rec.migrated++;
  }

  return { rec, loanAccountIdByLegacyKey };
}

// ----------------------------------------------------------------------------
// Phase 4: LoanTransaction (524,463 rows — batched)
// Design doc §2.4/§5 point 2 — 30 legacy types -> 10 target types. IMPORT rows excluded (not a
// real financial event, doesn't affect any migrated balance). FEE and FEE_CHARGED both map to
// FEE_CHARGED (confirmed genuinely distinct by the business, but the target schema doesn't carry
// the sub-distinction — amounts are preserved regardless). *_ADJUSTMENT types map to ADJUSTMENT
// (confirmed loan-officer-initiated manual corrections, a real distinct event class).
// ----------------------------------------------------------------------------

const TRANSACTION_TYPE_MAP: Record<string, string> = {
  DISBURSMENT: 'DISBURSEMENT',
  REPAYMENT: 'REPAYMENT',
  FEE_CHARGED: 'FEE_CHARGED',
  FEE: 'FEE_CHARGED',
  PENALTY_APPLIED: 'PENALTY_APPLIED',
  INTEREST_APPLIED: 'INTEREST_APPLIED',
  DEFERRED_INTEREST_APPLIED: 'DEFERRED_INTEREST_APPLIED',
  DEFERRED_INTEREST_PAID: 'DEFERRED_INTEREST_PAID',
  TRANSFER: 'TRANSFER',
  WRITE_OFF: 'ADJUSTMENT',
  REPAYMENT_UNDO: 'ADJUSTMENT',
  FEE_REPAYMENT: 'ADJUSTMENT',
  PENALTY_REPAYMENT: 'ADJUSTMENT',
  FEES_DUE_REDUCED: 'ADJUSTMENT',
  PENALTIES_DUE_REDUCED: 'ADJUSTMENT',
  INTEREST_DUE_REDUCED: 'ADJUSTMENT',
  PENALTY_ADJUSTMENT: 'ADJUSTMENT',
  FEE_ADJUSTMENT: 'ADJUSTMENT',
  FEE_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  INTEREST_APPLIED_ADJUSTMENT: 'ADJUSTMENT',
  INTEREST_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  DEFERRED_INTEREST_APPLIED_ADJUSTMENT: 'ADJUSTMENT',
  DEFERRED_INTEREST_PAID_ADJUSTMENT: 'ADJUSTMENT',
  DISBURSMENT_ADJUSTMENT: 'ADJUSTMENT',
  REPAYMENT_ADJUSTMENT: 'ADJUSTMENT',
  PENALTY_REDUCTION_ADJUSTMENT: 'ADJUSTMENT',
  TRANSFER_ADJUSTMENT: 'ADJUSTMENT',
  WRITE_OFF_ADJUSTMENT: 'ADJUSTMENT',
  // IMPORT deliberately absent — excluded, see design doc §5 point 2.
};

const BATCH_SIZE = 2000;

async function migrateLoanTransactions(hqBranchId: string, loanAccountIdByLegacyKey: Map<string, string>): Promise<Reconciliation> {
  const file = path.join(DUMP_DIR, 'loan_transactions.bson');
  const rec = newReconciliation('loan_transactions', 0);
  let batch: any[] = [];

  async function flush(): Promise<void> {
    if (batch.length === 0) return;
    if (APPLY) {
      await prisma.$transaction(
        batch.map((row) =>
          prisma.loanTransaction.upsert({
            where: { legacyId: row.legacyId },
            update: {},
            create: row,
          }),
        ),
      );
    }
    rec.migrated += batch.length;
    batch = [];
  }

  for (const tx of iterDocs<any>('loan_transactions')) {
    rec.sourceCount++;
    const legacyType = String(tx.type);
    if (legacyType === 'IMPORT') {
      recordSkip(rec, 'IMPORT (not a real financial event)');
      continue;
    }
    const mappedType = TRANSACTION_TYPE_MAP[legacyType];
    if (!mappedType) {
      recordSkip(rec, `unmapped type=${legacyType}`);
      continue;
    }
    const loanAccountId = loanAccountIdByLegacyKey.get(String(tx.parent_account_key));
    if (!loanAccountId) {
      recordSkip(rec, 'unresolved loan account');
      continue;
    }
    const entryDate = toDate(tx.entry_date ?? tx.creation_date);
    if (!entryDate) {
      recordSkip(rec, 'missing entry date');
      continue;
    }

    batch.push({
      loanAccountId,
      type: mappedType,
      amount: toDecimalString(tx.amount ?? 0),
      principalComponent: toDecimalString(tx.principal_amount ?? 0),
      interestComponent: toDecimalString(tx.interest_amount ?? 0),
      feesComponent: toDecimalString(tx.fees_amount ?? 0),
      penaltyComponent: toDecimalString(tx.penalty_amount ?? 0),
      balanceAfter: toDecimalString(tx.balance ?? tx.principal_balance ?? 0),
      branchId: hqBranchId,
      entryDate,
      comment: tx.comment || null,
      legacyId: String(tx.uid ?? tx._id),
    });

    if (batch.length >= BATCH_SIZE) {
      await flush();
      console.log(`  ...${rec.migrated} transactions migrated so far`);
    }
  }
  await flush();

  return rec;
}

// ----------------------------------------------------------------------------
// Phase 5: Attachment metadata (21,104 rows, no physical files — ADR-006)
// ----------------------------------------------------------------------------

async function migrateAttachments(loanAccountIdByLegacyKey: Map<string, string>, borrowerIdByLegacyKey: Map<string, string>): Promise<Reconciliation> {
  const attachments = loadAll<any>('attachments');
  const rec = newReconciliation('attachments', attachments.length);

  for (const a of attachments) {
    const isLoanAttachment = String(a.type) === 'loan_account';
    const ownerId = isLoanAttachment ? loanAccountIdByLegacyKey.get(String(a.uid)) : borrowerIdByLegacyKey.get(String(a.clientUID));
    if (!ownerId) {
      recordSkip(rec, 'unresolved owner');
      continue;
    }
    if (APPLY) {
      await prisma.attachment.upsert({
        where: { legacyId: String(a._id) },
        update: {},
        create: {
          ownerType: isLoanAttachment ? 'LOAN_ACCOUNT' : 'BORROWER',
          ownerId,
          fileName: String(a.fileName ?? 'unknown'),
          fileType: String(a.fileType ?? ''),
          // No physical file was migrated (ADR-006) — storageKey is a placeholder pointing at
          // nothing retrievable yet, per design doc §5 point 4 ("migrate metadata now, backfill
          // storageKey in a future storage-migration pass").
          storageKey: `legacy-unmigrated:${a.path ?? a._id}`,
          uploadedAt: toDate(a.createdAt) ?? new Date(),
          legacyId: String(a._id),
        },
      });
    }
    rec.migrated++;
  }

  return rec;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`CP12 legacy migration — mode: ${APPLY ? 'APPLY (writing to DB)' : 'DRY RUN (no writes)'}`);
  console.log(`Dump directory: ${DUMP_DIR}`);
  if (!fs.existsSync(DUMP_DIR)) {
    throw new Error(`Dump directory not found: ${DUMP_DIR}`);
  }

  const branch = await prisma.branch.findUnique({ where: { code: HQ_BRANCH_CODE } });
  if (!branch) {
    throw new Error(`No Branch with code "${HQ_BRANCH_CODE}" found. Run "npx prisma db seed" first.`);
  }

  const recs: Reconciliation[] = [];

  console.log('\nPhase 1/5: Loan Products...');
  const { rec: productsRec, productVersionIdByLegacyKey } = await migrateLoanProducts();
  recs.push(productsRec);

  console.log('Phase 2/5: Borrowers...');
  const { rec: borrowersRec, borrowerIdByLegacyKey } = await migrateBorrowers(branch.id);
  recs.push(borrowersRec);

  console.log('Phase 3/5: Loan Accounts + Co-Borrowers...');
  const { rec: loansRec, loanAccountIdByLegacyKey } = await migrateLoanAccounts(
    branch.id,
    productVersionIdByLegacyKey,
    borrowerIdByLegacyKey,
  );
  recs.push(loansRec);

  console.log('Phase 4/5: Loan Transactions (this is the big one — 524k+ rows)...');
  const transactionsRec = await migrateLoanTransactions(branch.id, loanAccountIdByLegacyKey);
  recs.push(transactionsRec);

  console.log('Phase 5/5: Attachment metadata...');
  const attachmentsRec = await migrateAttachments(loanAccountIdByLegacyKey, borrowerIdByLegacyKey);
  recs.push(attachmentsRec);

  printReconciliation(recs);

  if (!APPLY) {
    console.log('\nDry run complete — no data was written. Re-run with --apply to write to the database.');
  } else {
    console.log('\nMigration complete.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
