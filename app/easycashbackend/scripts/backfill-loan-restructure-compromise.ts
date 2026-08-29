/**
 * One-time follow-up to migrate-legacy-data.ts (2026-08-29): that script now maps SDevTech's
 * `closureReason` of "Reschedule" -> CLOSED_RESTRUCTURED and "Compromise Agreement" ->
 * CLOSED_COMPROMISED (see that script's `resolveLoanStatus`), but writing the *status* alone
 * leaves the LMS unable to say WHICH new loan a closed one turned into - exactly the "hindi ko alam
 * ang reason kung bakit closed" gap the user reported (investigating BL-SPEC_00028, which turned
 * out to be a Reschedule). This script populates the actual link rows:
 *   - Reschedule (old:new is always 1:1) -> one `LoanRestructure` row per pair, same model/status
 *     the in-app Loan Restructure feature already writes.
 *   - Compromise Agreement (multiple old loans -> ONE new loan, at a negotiated write-down) -> one
 *     `LoanCompromiseSettlement` header row per distinct new loan + one
 *     `LoanCompromiseSettlementItem` per old loan folded into it.
 *
 * Runs AFTER migrate-legacy-data.ts, not as part of it - matching an old loan to its replacement
 * needs BOTH sides already migrated (their Postgres ids), and insertion order during the main
 * migration isn't guaranteed to put the old loan before the new one.
 *
 * Pairing heuristic (the only one available - SDevTech has no explicit old->new link field):
 * for a given borrower (`accountHolderKey`), the chronologically NEXT loan account created after
 * the closed one. Verified against all 20 Reschedule + 8 Compromise Agreement loans in the
 * 2026-08-28 snapshot: found a next loan for every single one (20/20, 8/8) - but the remaining
 * balance only matched the next loan's opening principal EXACTLY for 10/20 Reschedule pairs (all
 * the recent ones); the other 10 (older chains, e.g. BL-REG_00021->22->23->25->26->30) are off by
 * varying amounts, almost certainly because SDevTech's own `balance` field on individual
 * transactions wasn't reliably tracked in its earlier years (one sample transaction from 2018 had
 * `balance: 0` despite being a real partial repayment). Migrated regardless - closureReason itself
 * confirms these ARE real reschedules - but every row this script writes is FLAGGED with a
 * `balanceMatchConfidence` note in its dry-run/apply log line so a human can spot-check the
 * mismatched ones; nothing here is silently trusted as exact.
 *
 * Usage: npx tsx scripts/backfill-loan-restructure-compromise.ts [--apply]
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { BSON } from 'bson';
import { prisma } from '../src/shared/database/prismaClient';
import { legacyDbEasycashDir } from './lib/legacyDumpPath';

const APPLY = process.argv.includes('--apply');
const DUMP_DIR = legacyDbEasycashDir();
const BALANCE_MATCH_TOLERANCE = 1; // pesos - float/rounding slack, not a real discrepancy

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

function toDateMs(value: unknown): number {
  if (!value) return 0;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

interface LegacyLoanAccount {
  _id: unknown;
  uid?: unknown;
  id?: unknown;
  accountState?: unknown;
  closureReason?: unknown;
  accountHolderKey?: unknown;
  creationDate?: unknown;
  loanAmount?: unknown;
  principalBalance?: unknown;
  interestBalance?: unknown;
  feesBalance?: unknown;
  penaltyBalance?: unknown;
}

async function resolveMigrationAttributionUserId(): Promise<string> {
  // No per-record staff attribution exists in the legacy source for who approved a reschedule/
  // compromise decades ago - falls back to the earliest-created MIS user (same "system actor"
  // convention as bootstrap-admin.ts's own account), never fabricated as a specific person.
  const misUser = await prisma.user.findFirst({
    where: { roles: { some: { role: { name: 'MIS' } } } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (misUser) return misUser.id;
  const anyUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!anyUser) throw new Error('No User exists in the database - run prisma db seed / bootstrap-admin.ts first.');
  return anyUser.id;
}

async function main(): Promise<void> {
  console.log(`=== Backfill LoanRestructure / LoanCompromiseSettlement ${APPLY ? '(APPLYING)' : '(DRY RUN — no writes)'} ===`);

  const legacyLoans = loadAll<LegacyLoanAccount>('loan_accounts');
  const byHolder = new Map<string, LegacyLoanAccount[]>();
  for (const la of legacyLoans) {
    const holder = String(la.accountHolderKey ?? '');
    if (!holder) continue;
    const arr = byHolder.get(holder) ?? [];
    arr.push(la);
    byHolder.set(holder, arr);
  }
  for (const arr of byHolder.values()) {
    arr.sort((a, b) => toDateMs(a.creationDate) - toDateMs(b.creationDate));
  }

  const legacyIdOf = (la: LegacyLoanAccount): string => String(la.uid ?? la._id);

  // Resolve every legacy loan's Postgres id/balances up front (one query) rather than one
  // findUnique per row - this script only ever deals with a few dozen rows' worth of legacyIds,
  // but the migrated table itself has 1,800+, so a single indexed IN-list query is still the right
  // shape. Balance comes from the MIGRATED Postgres row, not the raw SDevTech dump - these
  // particular loans have no account-level balance snapshot in the source at all (confirmed: the
  // raw bson record for BL-SPEC_00028 has no principalBalance/interestBalance fields whatsoever),
  // so their real balance only exists post-recompute-active-loan-balances-from-schedule.ts, which
  // runs against Postgres, never against the dump.
  const migrated = await prisma.loanAccount.findMany({
    where: { legacyId: { not: null } },
    select: {
      id: true,
      legacyId: true,
      loanCode: true,
      principalAmount: true,
      principalBalance: true,
      interestBalance: true,
      feesBalance: true,
      penaltyBalance: true,
    },
  });
  const postgresIdByLegacyId = new Map(migrated.map((m) => [m.legacyId as string, m.id]));
  const loanCodeByLegacyId = new Map(migrated.map((m) => [m.legacyId as string, m.loanCode]));
  const collectionsBalanceByLegacyId = new Map(
    migrated.map((m) => [
      m.legacyId as string,
      Number(m.principalBalance) + Number(m.interestBalance) + Number(m.feesBalance) + Number(m.penaltyBalance),
    ]),
  );
  const principalAmountByLegacyId = new Map(migrated.map((m) => [m.legacyId as string, Number(m.principalAmount)]));
  const collectionsBalanceOf = (la: LegacyLoanAccount): number => collectionsBalanceByLegacyId.get(legacyIdOf(la)) ?? 0;
  const principalAmountOf = (la: LegacyLoanAccount): number =>
    principalAmountByLegacyId.get(legacyIdOf(la)) ?? toNumber(la.loanAmount ?? la.principalBalance);

  const attributionUserId = APPLY ? await resolveMigrationAttributionUserId() : '(dry-run, not resolved)';

  // --- Reschedule: 1 old -> 1 new ---
  const rescheduleLoans = legacyLoans.filter((la) => String(la.closureReason ?? '') === 'Reschedule');
  let restructureWritten = 0;
  let restructureSkippedNoNext = 0;
  let restructureSkippedUnresolved = 0;

  console.log(`\n--- Reschedule -> LoanRestructure (${rescheduleLoans.length} candidates) ---`);
  for (const oldLa of rescheduleLoans) {
    const holder = String(oldLa.accountHolderKey ?? '');
    const siblings = byHolder.get(holder) ?? [];
    const idx = siblings.indexOf(oldLa);
    const newLa = idx >= 0 ? siblings[idx + 1] : undefined;
    if (!newLa) {
      restructureSkippedNoNext++;
      console.log(`  SKIP ${legacyIdOf(oldLa)} (${oldLa.id}) - no next loan found for this borrower`);
      continue;
    }
    const oldPgId = postgresIdByLegacyId.get(legacyIdOf(oldLa));
    const newPgId = postgresIdByLegacyId.get(legacyIdOf(newLa));
    if (!oldPgId || !newPgId) {
      restructureSkippedUnresolved++;
      console.log(
        `  SKIP ${oldLa.id} -> ${newLa.id} - one or both sides not migrated yet (old=${!!oldPgId}, new=${!!newPgId})`,
      );
      continue;
    }
    const previousBalance = collectionsBalanceOf(oldLa);
    const newPrincipal = principalAmountOf(newLa);
    const confidence = Math.abs(previousBalance - newPrincipal) <= BALANCE_MATCH_TOLERANCE ? 'EXACT' : 'MISMATCH-review';
    console.log(
      `  ${loanCodeByLegacyId.get(legacyIdOf(oldLa))} -> ${loanCodeByLegacyId.get(legacyIdOf(newLa))}  ` +
        `oldBalance=${previousBalance.toFixed(2)} newPrincipal=${newPrincipal.toFixed(2)}  [${confidence}]`,
    );
    if (APPLY) {
      await prisma.loanRestructure.upsert({
        where: { oldLoanAccountId: oldPgId },
        update: {},
        create: {
          oldLoanAccountId: oldPgId,
          newLoanAccountId: newPgId,
          previousCollectionsBalance: previousBalance.toFixed(2),
          newPrincipalAmount: newPrincipal.toFixed(2),
          reason: `Migrated from SDevTech (closureReason: Reschedule) - balance match: ${confidence}`,
          restructuredByUserId: attributionUserId,
        },
      });
    }
    restructureWritten++;
  }

  // --- Compromise Agreement: N old -> 1 new ---
  const compromiseLoans = legacyLoans.filter((la) => String(la.closureReason ?? '') === 'Compromise Agreement');
  const settlementGroups = new Map<string, { newLa: LegacyLoanAccount; oldLoans: LegacyLoanAccount[] }>();
  let compromiseSkippedNoNext = 0;

  for (const oldLa of compromiseLoans) {
    const holder = String(oldLa.accountHolderKey ?? '');
    const siblings = byHolder.get(holder) ?? [];
    const idx = siblings.indexOf(oldLa);
    const newLa = idx >= 0 ? siblings[idx + 1] : undefined;
    if (!newLa) {
      compromiseSkippedNoNext++;
      console.log(`  SKIP ${oldLa.id} - no next loan found for this borrower`);
      continue;
    }
    const newLegacyId = legacyIdOf(newLa);
    const group = settlementGroups.get(newLegacyId) ?? { newLa, oldLoans: [] };
    group.oldLoans.push(oldLa);
    settlementGroups.set(newLegacyId, group);
  }

  console.log(`\n--- Compromise Agreement -> LoanCompromiseSettlement (${compromiseLoans.length} candidates, ${settlementGroups.size} settlement group(s)) ---`);
  let settlementsWritten = 0;
  let settlementItemsWritten = 0;
  let settlementSkippedUnresolved = 0;

  for (const [newLegacyId, group] of settlementGroups) {
    const newPgId = postgresIdByLegacyId.get(newLegacyId);
    if (!newPgId) {
      settlementSkippedUnresolved++;
      console.log(`  SKIP settlement into ${group.newLa.id} - new loan not migrated yet`);
      continue;
    }
    const resolvedOld = group.oldLoans
      .map((oldLa) => ({ oldLa, oldPgId: postgresIdByLegacyId.get(legacyIdOf(oldLa)) }))
      .filter((x): x is { oldLa: LegacyLoanAccount; oldPgId: string } => !!x.oldPgId);
    if (resolvedOld.length === 0) {
      settlementSkippedUnresolved++;
      console.log(`  SKIP settlement into ${group.newLa.id} - none of its ${group.oldLoans.length} old loans are migrated yet`);
      continue;
    }
    const totalPrevious = resolvedOld.reduce((sum, { oldLa }) => sum + collectionsBalanceOf(oldLa), 0);
    const settlementAmount = principalAmountOf(group.newLa);
    console.log(
      `  ${loanCodeByLegacyId.get(newLegacyId)}: ${resolvedOld.length} old loan(s) folded in, ` +
        `totalPreviousBalance=${totalPrevious.toFixed(2)} settlementAmount=${settlementAmount.toFixed(2)}`,
    );
    for (const { oldLa } of resolvedOld) {
      console.log(`      - ${loanCodeByLegacyId.get(legacyIdOf(oldLa))} (balance ${collectionsBalanceOf(oldLa).toFixed(2)})`);
    }

    if (APPLY) {
      const settlement = await prisma.loanCompromiseSettlement.upsert({
        where: { newLoanAccountId: newPgId },
        update: {},
        create: {
          newLoanAccountId: newPgId,
          totalPreviousBalance: totalPrevious.toFixed(2),
          settlementAmount: settlementAmount.toFixed(2),
          reason: 'Migrated from SDevTech (closureReason: Compromise Agreement)',
          settledByUserId: attributionUserId,
        },
      });
      for (const { oldLa, oldPgId } of resolvedOld) {
        await prisma.loanCompromiseSettlementItem.upsert({
          where: { oldLoanAccountId: oldPgId },
          update: {},
          create: {
            settlementId: settlement.id,
            oldLoanAccountId: oldPgId,
            previousCollectionsBalance: collectionsBalanceOf(oldLa).toFixed(2),
          },
        });
        settlementItemsWritten++;
      }
    } else {
      settlementItemsWritten += resolvedOld.length;
    }
    settlementsWritten++;
  }

  console.log('\n=== Summary ===');
  console.log(
    `LoanRestructure: ${restructureWritten} written, ${restructureSkippedNoNext} skipped (no next loan), ` +
      `${restructureSkippedUnresolved} skipped (side not migrated yet)`,
  );
  console.log(
    `LoanCompromiseSettlement: ${settlementsWritten} settlement(s) / ${settlementItemsWritten} item(s) written, ` +
      `${compromiseSkippedNoNext} old loans skipped (no next loan), ${settlementSkippedUnresolved} settlements skipped (not migrated yet)`,
  );

  if (!APPLY) {
    console.log('\nDry run complete — no data was written. Re-run with --apply to write to the database.');
  } else {
    console.log('\nBackfill complete.');
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
