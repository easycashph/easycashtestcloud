/* eslint-disable no-console */
/**
 * Backfills `InterestRateChart` (Add-On Rate + Term -> Contractual Rate lookup, used by the
 * Create Loan Account form to auto-fill Contractual Rate) - the table has been empty since the
 * model was added, so that auto-fill has never actually worked; every combination showed
 * "not on file". Source: the "Interest Rate Chart" sheet of the legacy
 * `legacy/reports/201 Loan Docs Generator/201 Loan Docs Encode.xlsx` workbook (the same source the
 * MIS team uses to prepare loan documents), extracted once into
 * `scripts/reference-data/interest-rate-chart.json`.
 *
 * 132 of the sheet's 135 data rows are imported - a 3-row block for Add-On Rate 10.0% (Contractual
 * Rate 0.1/0.1307/0.1436, terms 1-3 only) was excluded: those contractual values are on a
 * completely different scale than every other row (all other rates run 1.5-6%, matching their
 * Add-On Rate's scale) and don't extend to a full term range like every other Add-On Rate block
 * does - looks like leftover scratch/test data in the sheet, not a confirmed real rate.  Per
 * CLAUDE.md "never fabricate financial logic", left out rather than guessed at; revisit if MIS
 * confirms it's real.
 *
 * Idempotent: upserts on the (addOnRatePercent, termMonths) unique constraint, so re-running is
 * always safe.
 *
 * Usage:
 *   npx tsx scripts/import-interest-rate-chart.ts            # dry run - reports counts, writes nothing
 *   npx tsx scripts/import-interest-rate-chart.ts --apply     # actually writes to the configured DATABASE_URL
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { prisma } from '../src/shared/database/prismaClient';

const APPLY = process.argv.includes('--apply');
const DATA_PATH = path.resolve(__dirname, 'reference-data/interest-rate-chart.json');

interface ChartEntry {
  termMonths: number;
  addOnRatePercent: number;
  contractualRatePercent: number;
}

async function main(): Promise<void> {
  const entries = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8')) as ChartEntry[];
  console.log(`Loaded ${entries.length} entries from the reference file.`);

  if (!APPLY) {
    console.log('Sample of first 5:');
    for (const e of entries.slice(0, 5)) console.log(' ', e);
    console.log('\nDry run complete - no data was written. Re-run with --apply to write to the database.');
    await prisma.$disconnect();
    return;
  }

  let written = 0;
  for (const e of entries) {
    await prisma.interestRateChart.upsert({
      where: { addOnRatePercent_termMonths: { addOnRatePercent: e.addOnRatePercent, termMonths: e.termMonths } },
      update: { contractualRatePercent: e.contractualRatePercent },
      create: {
        addOnRatePercent: e.addOnRatePercent,
        termMonths: e.termMonths,
        contractualRatePercent: e.contractualRatePercent,
      },
    });
    written++;
  }
  console.log(`Applied: ${written} rows upserted.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
