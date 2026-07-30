/**
 * One-time, idempotent seed (2026-07-14, user-confirmed business rule): every "SML"-prefixed loan
 * product carries the same 5 conditional documents (on top of the always-required Disclosure
 * Statement / Promissory Note / Acknowledgement Receipt / Data Privacy Consent, which need no
 * mapping): Loan Agreement - Seafarer, Special Power of Attorney, Deed of Assignment - Borrower,
 * Deed of Assignment - Co-Borrower, and Manulife.
 *
 * Uses `createMany({ skipDuplicates: true })` so re-running is a no-op once applied.
 *
 * Usage: npx tsx scripts/map-sml-document-templates.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

const DOCUMENT_TEMPLATE_CODES = [
  'LOAN_AGREEMENT_SEAFARER',
  'SPECIAL_POWER_OF_ATTORNEY',
  'DEED_OF_ASSIGNMENT_BORROWER',
  'DEED_OF_ASSIGNMENT_CO_BORROWER',
  'MANULIFE',
];

async function main(): Promise<void> {
  console.log(`=== Map SML loan products to conditional document templates ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const smlProducts = await prisma.loanProduct.findMany({
    where: { code: { startsWith: 'SML', mode: 'insensitive' } },
    select: { id: true, code: true, name: true },
  });
  console.log(`SML loan products found: ${smlProducts.length}`);
  smlProducts.forEach((p) => console.log(`  ${p.code} — ${p.name}`));

  const templates = await prisma.documentTemplate.findMany({
    where: { code: { in: DOCUMENT_TEMPLATE_CODES } },
    select: { id: true, code: true },
  });
  const missing = DOCUMENT_TEMPLATE_CODES.filter((code) => !templates.some((t) => t.code === code));
  if (missing.length > 0) {
    console.error(`Missing DocumentTemplate rows for: ${missing.join(', ')} — run prisma/seed.ts first.`);
    process.exitCode = 1;
    return;
  }

  const rows = smlProducts.flatMap((product) => templates.map((template) => ({ loanProductId: product.id, documentTemplateId: template.id })));
  console.log(`\nMappings to ensure: ${rows.length} (${smlProducts.length} products × ${templates.length} templates)`);

  if (!DRY_RUN) {
    const result = await prisma.documentTemplateMapping.createMany({ data: rows, skipDuplicates: true });
    console.log(`Inserted: ${result.count} new mapping(s) (skipped any already present).`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exitCode = 1;
});
