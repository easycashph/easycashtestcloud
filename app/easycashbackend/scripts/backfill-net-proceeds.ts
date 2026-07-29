/**
 * One-time, idempotent follow-up found 2026-07-14 while wiring up the Disclosure Statement's
 * "NET PROCEEDS" / acknowledgment-paragraph merge fields: every legacy (CP12-migrated) loan
 * account has `netProceeds = 0.00` regardless of principal or fees — the original migration never
 * computed it (the column simply defaulted to 0, same class of gap as
 * `legacyBalanceDataMissing`/`anticipatedDisbursementDate`). `LoanAccount.create()` correctly
 * computes `netProceeds = principalAmount - originationFees.total()` for every loan created going
 * forward through this system; this script applies that same formula retroactively.
 *
 * Idempotent by construction: only updates rows where the stored value doesn't match the
 * recomputed one, so re-running it is a no-op once applied. Never touches principalAmount or any
 * of the fee columns — recomputes and writes only `netProceeds`.
 *
 * Usage: npx tsx scripts/backfill-net-proceeds.ts [--dry-run]
 */
import 'dotenv/config';
import { Money } from '../src/shared/domain/Money';
import { OriginationFees } from '../src/modules/loan-account/domain/valueObjects/OriginationFees';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log(`=== Backfill LoanAccount.netProceeds ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const loanAccounts = await prisma.loanAccount.findMany({
    select: {
      id: true,
      loanCode: true,
      principalAmount: true,
      netProceeds: true,
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
  console.log(`Loan accounts found: ${loanAccounts.length}`);

  let corrected = 0;
  const samples: { loanCode: string; before: string; after: string }[] = [];

  for (const row of loanAccounts) {
    const originationFees = OriginationFees.of({
      processingFee: Money.of(row.processingFee),
      advanceInterestFee: Money.of(row.advanceInterestFee),
      outstandingBalancePayoff: Money.of(row.outstandingBalancePayoff),
      docStampFee: Money.of(row.docStampFee),
      accountManagementFee: Money.of(row.accountManagementFee),
      otherFees: Money.of(row.otherFees),
      notarialFee: Money.of(row.notarialFee),
      webFee: Money.of(row.webFee),
      insuranceFee: Money.of(row.insuranceFee),
    });
    const correctNetProceeds = Money.of(row.principalAmount).subtract(originationFees.total());
    const storedNetProceeds = Money.of(row.netProceeds);

    if (!correctNetProceeds.equals(storedNetProceeds)) {
      samples.push({ loanCode: row.loanCode, before: storedNetProceeds.toString(), after: correctNetProceeds.toString() });
      if (!DRY_RUN) {
        await prisma.loanAccount.update({
          where: { id: row.id },
          data: { netProceeds: correctNetProceeds.toDecimal() },
        });
      }
      corrected++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Corrected: ${corrected} / ${loanAccounts.length}`);
  console.log(`\nFirst 10 examples (loanCode: before -> after):`);
  for (const s of samples.slice(0, 10)) {
    console.log(`  ${s.loanCode}: ${s.before} -> ${s.after}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
