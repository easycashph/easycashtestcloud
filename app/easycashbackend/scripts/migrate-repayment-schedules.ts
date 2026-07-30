/**
 * CP12 migration follow-up #3 (2026-07-09) — migrates the legacy `repayments.bson` collection
 * (31,106 documents) into `RepaymentSchedule`, which the original CP12 migration left empty
 * because it checked the wrong, differently-named legacy collection (`payment_schedules.bson`,
 * which genuinely is empty in this export — 0 documents). `repayments.bson` is the real,
 * populated per-installment schedule: confirmed by direct verification against a real screenshot
 * of the legacy production system's own Payment Schedule tab for SML-MAX_00002 (Vincent Mark
 * Jardeniano Gemolaga) — every Principal/Interest/Fees/Penalty Due/Paid total matched exactly.
 *
 * Covers 1,804 of 1,805 migrated loan accounts (near-total). Ordering: installment number is
 * assigned by sorting each loan's records by `due_date` ascending — confirmed reliable (zero
 * duplicate due_dates within any loan in this export), and matches the legacy `index` field's own
 * ordering wherever `index` happens to be present (only ~16% of records have it).
 *
 * Idempotent: upserts on `legacyId` (the raw `_id`). Read-only against the legacy source.
 *
 * Usage: npx tsx scripts/migrate-repayment-schedules.ts [--dry-run]
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const DUMP_DIR = legacyDbEasycashDir();
const DRY_RUN = process.argv.includes('--dry-run');

interface LegacyRepayment {
  _id: unknown;
  parent_account_key: string;
  due_date: string;
  principal_due: number;
  principal_paid: number;
  interest_due: number;
  interest_paid: number;
  fees_due: number;
  fees_paid: number;
  penalty_due: number;
  penalty_paid: number;
  state: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';
  last_paid_date: string | null;
}

function readAll<T = any>(file: string): T[] {
  const buf = fs.readFileSync(path.join(DUMP_DIR, file));
  let offset = 0;
  const docs: T[] = [];
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    docs.push(BSON.deserialize(buf.subarray(offset, offset + size), { promoteValues: true }) as T);
    offset += size;
  }
  return docs;
}

function toDecimalString(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

async function main(): Promise<void> {
  console.log(`=== Migrate repayment schedules ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const legacyLoans = readAll<{ uid: string }>('loan_accounts.bson');
  const loanUidSet = new Set(legacyLoans.map((l) => l.uid));

  const repayments = readAll<LegacyRepayment>('repayments.bson');
  console.log(`repayments.bson: ${repayments.length} read`);

  const byLoanUid = new Map<string, LegacyRepayment[]>();
  for (const r of repayments) {
    if (!loanUidSet.has(r.parent_account_key)) continue;
    if (!byLoanUid.has(r.parent_account_key)) byLoanUid.set(r.parent_account_key, []);
    byLoanUid.get(r.parent_account_key)!.push(r);
  }
  console.log(`Loans with at least one repayment installment: ${byLoanUid.size}`);

  let installmentsWritten = 0, loansProcessed = 0, loansSkippedNoAccount = 0;

  for (const [loanUid, records] of byLoanUid) {
    const loanAccount = await prisma.loanAccount.findUnique({ where: { legacyId: loanUid }, select: { id: true } });
    if (!loanAccount) { loansSkippedNoAccount++; continue; }

    records.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    for (let i = 0; i < records.length; i++) {
      const r = records[i]!;
      const legacyId = String(r._id);
      if (!DRY_RUN) {
        await prisma.repaymentSchedule.upsert({
          where: { legacyId },
          create: {
            legacyId,
            loanAccountId: loanAccount.id,
            installmentNumber: i + 1,
            dueDate: new Date(r.due_date),
            principalDue: toDecimalString(r.principal_due),
            interestDue: toDecimalString(r.interest_due),
            feesDue: toDecimalString(r.fees_due),
            penaltyDue: toDecimalString(r.penalty_due),
            principalPaid: toDecimalString(r.principal_paid),
            interestPaid: toDecimalString(r.interest_paid),
            feesPaid: toDecimalString(r.fees_paid),
            penaltyPaid: toDecimalString(r.penalty_paid),
            status: r.state,
            lastPaidAt: r.last_paid_date ? new Date(r.last_paid_date) : null,
          },
          update: {},
        });
      }
      installmentsWritten++;
    }
    loansProcessed++;
  }

  console.log('\n=== Summary ===');
  console.log(`Loans processed: ${loansProcessed}`);
  console.log(`Loans skipped (no matching migrated LoanAccount): ${loansSkippedNoAccount}`);
  console.log(`Installments upserted: ${installmentsWritten}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
