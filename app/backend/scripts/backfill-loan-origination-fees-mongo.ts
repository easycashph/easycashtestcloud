/**
 * DRY-RUN by default. Second, wider-coverage backfill pass using the actual SDevTech production
 * MongoDB export (`legacy/MongoDB dump/extracted/.../db-easycash/monthly_loan_releases.bson`,
 * 3,710 docs / 1,231 unique accountIds, disbursement dates 2009-2026) - found 2026-07-17 while
 * investigating why SML-REG_00372 (disbursed July 1, 2026) had no fees: it postdates MIS Nomer's
 * personal Excel LMS's own cutoff (May 28, 2026), which is what `backfill-loan-origination-fees.ts`
 * used. This MongoDB collection is the real production system's own release-report data, not a
 * personal tool - wider coverage, more authoritative.
 *
 * Same safety rule as the first pass: only touches LoanAccounts whose fee columns are ALL
 * currently zero - never overwrites data (including what the first pass already backfilled).
 *
 * Usage:
 *   npx tsx scripts/backfill-loan-origination-fees-mongo.ts          (dry run)
 *   npx tsx scripts/backfill-loan-origination-fees-mongo.ts --apply  (writes to the database)
 */
import * as fs from 'fs';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';

const BSON_PATH =
  'C:/ECLC CLAUDE CODE/legacy/MongoDB dump/extracted/07092026_ 92543/db-easycash/monthly_loan_releases.bson';

interface MongoReleaseDoc {
  accountId: string;
  processingFee?: string;
  advanceInterestFee?: string;
  accountManagementFee?: string;
  insuranceFee?: string;
  notarialFee?: string;
  webFee?: string;
  docStampFee?: string;
  outstandingLoanBalanceFee?: string;
  miscellaneousFee?: string;
  updatedAt?: string;
}

function pesoToNumber(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[₱,]/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readBsonDocs(path: string): MongoReleaseDoc[] {
  const buf = fs.readFileSync(path);
  const docs: MongoReleaseDoc[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const size = buf.readInt32LE(offset);
    docs.push(BSON.deserialize(buf.subarray(offset, offset + size)) as MongoReleaseDoc);
    offset += size;
  }
  return docs;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const allDocs = readBsonDocs(BSON_PATH);
  console.log(`Read ${allDocs.length} docs from monthly_loan_releases.bson.`);

  // Multiple docs can share the same accountId (near-duplicate re-saves) - keep the most recently updated.
  const byAccountId = new Map<string, MongoReleaseDoc>();
  for (const doc of allDocs) {
    if (!doc.accountId) continue;
    const existing = byAccountId.get(doc.accountId);
    if (!existing || (doc.updatedAt ?? '') > (existing.updatedAt ?? '')) {
      byAccountId.set(doc.accountId, doc);
    }
  }
  console.log(`Unique accountIds: ${byAccountId.size}`);

  const loans = await prisma.loanAccount.findMany({
    where: { loanCode: { in: [...byAccountId.keys()] } },
    select: {
      id: true,
      loanCode: true,
      processingFee: true,
      advanceInterestFee: true,
      outstandingBalancePayoff: true,
      docStampFee: true,
      accountManagementFee: true,
      otherFees: true,
      notarialFee: true,
      webFee: true,
      insuranceFee: true,
    },
  });

  let matched = 0;
  let alreadyHasFees = 0;
  const toApply: { loanCode: string; id: string; data: Record<string, number> }[] = [];

  for (const loan of loans) {
    const doc = byAccountId.get(loan.loanCode);
    if (!doc) continue;
    matched++;

    const currentlyAllZero =
      Number(loan.processingFee) === 0 &&
      Number(loan.advanceInterestFee) === 0 &&
      Number(loan.outstandingBalancePayoff) === 0 &&
      Number(loan.docStampFee) === 0 &&
      Number(loan.accountManagementFee) === 0 &&
      Number(loan.otherFees) === 0 &&
      Number(loan.notarialFee) === 0 &&
      Number(loan.webFee) === 0 &&
      Number(loan.insuranceFee) === 0;

    if (!currentlyAllZero) {
      alreadyHasFees++;
      continue;
    }

    const data = {
      processingFee: pesoToNumber(doc.processingFee),
      advanceInterestFee: pesoToNumber(doc.advanceInterestFee),
      outstandingBalancePayoff: pesoToNumber(doc.outstandingLoanBalanceFee),
      docStampFee: pesoToNumber(doc.docStampFee),
      accountManagementFee: pesoToNumber(doc.accountManagementFee),
      otherFees: pesoToNumber(doc.miscellaneousFee),
      notarialFee: pesoToNumber(doc.notarialFee),
      webFee: pesoToNumber(doc.webFee),
      insuranceFee: pesoToNumber(doc.insuranceFee),
    };
    const allZeroToo = Object.values(data).every((v) => v === 0);
    if (allZeroToo) continue;

    toApply.push({ loanCode: loan.loanCode, id: loan.id, data });
  }

  console.log(`Matched by loanCode (in our DB): ${matched}`);
  console.log(`Already have real fee data (skipped, not touched - includes the first backfill pass): ${alreadyHasFees}`);
  console.log(`Would backfill now: ${toApply.length}`);
  console.log('');
  console.log('Sample (first 10):');
  for (const row of toApply.slice(0, 10)) {
    console.log(`  ${row.loanCode}:`, row.data);
  }

  if (!apply) {
    console.log('\nDRY RUN ONLY - no changes written. Re-run with --apply to write these changes.');
    await prisma.$disconnect();
    return;
  }

  console.log(`\nAPPLYING ${toApply.length} updates...`);
  for (const row of toApply) {
    await prisma.loanAccount.update({ where: { id: row.id }, data: row.data });
  }
  console.log('Done.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
