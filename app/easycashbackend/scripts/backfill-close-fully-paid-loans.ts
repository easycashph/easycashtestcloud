/**
 * One-time, idempotent follow-up to the ProcessPaymentUseCase auto-close fix (2026-07-15):
 * before that fix existed, a payment that brought a loan's balance to zero never transitioned the
 * loan out of ACTIVE/ACTIVE_IN_ARREARS, leaving it stuck showing as an open loan with a ₱0
 * Collections Balance in the loan list. This backs those already-fully-paid loans out to CLOSED,
 * matching what the fix now does automatically for every payment going forward.
 *
 * A loan qualifies only if it's ACTIVE/ACTIVE_IN_ARREARS AND every one of its four balance
 * components (principal/interest/fees/penalty) is exactly zero - mirrors `LoanAccount.isFullyPaid`
 * exactly, so this never touches a loan that's merely low-balance or mid-payment.
 *
 * Idempotent: only updates rows currently in ACTIVE/ACTIVE_IN_ARREARS, so re-running is a no-op
 * once applied. Never writes to any balance column - only `status` and `closedAt`.
 *
 * Usage: npx tsx scripts/backfill-close-fully-paid-loans.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  console.log(`=== Backfill: close already-fully-paid ACTIVE/ACTIVE_IN_ARREARS loans ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const candidates = await prisma.loanAccount.findMany({
    where: {
      status: { in: ['ACTIVE', 'ACTIVE_IN_ARREARS'] },
      principalBalance: 0,
      interestBalance: 0,
      feesBalance: 0,
      penaltyBalance: 0,
    },
    select: { id: true, loanCode: true, status: true },
  });

  console.log(`Fully-paid loans still open: ${candidates.length}`);
  candidates.forEach((l) => console.log(`  ${l.loanCode} (${l.status})`));

  if (!DRY_RUN) {
    const result = await prisma.loanAccount.updateMany({
      where: { id: { in: candidates.map((l) => l.id) } },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    console.log(`\nClosed: ${result.count} loan(s).`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
