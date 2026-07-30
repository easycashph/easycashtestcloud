/**
 * One-time, idempotent seed (2026-07-15, user-confirmed business rule): every "SL"-prefixed loan
 * product (SL-CORP, SL-LAZ*, SL-OL*, SL-REG*, SL-Snap*, etc. - NOT "SML"-prefixed, a different
 * product family already mapped by map-sml-document-templates.ts) gets 2 conditional documents:
 * Deed of Assignment - Salary and Loan Agreement - Salary.
 *
 * The user also asked for Promissory Note, Disclosure Statement, Data Privacy Consent, and
 * Acknowledgement Receipt to apply to SL products - those 4 are already `isRequired = true`
 * DocumentTemplate rows, which GenerateLoanDocumentUseCase makes available to every loan product
 * regardless of DocumentTemplateMapping, so they need no mapping row here.
 *
 * Uses `createMany({ skipDuplicates: true })` so re-running is a no-op once applied.
 *
 * Usage: npx tsx scripts/map-sl-document-templates.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

const DOCUMENT_TEMPLATE_CODES = ['DEED_OF_ASSIGNMENT_SALARY', 'LOAN_AGREEMENT_SALARY'];

async function main(): Promise<void> {
  console.log(`=== Map SL loan products to conditional document templates ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const slProducts = await prisma.loanProduct.findMany({
    where: { code: { startsWith: 'SL-', mode: 'insensitive' } },
    select: { id: true, code: true, name: true },
  });
  console.log(`SL loan products found: ${slProducts.length}`);
  slProducts.forEach((p) => console.log(`  ${p.code} — ${p.name}`));

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

  const rows = slProducts.flatMap((product) => templates.map((template) => ({ loanProductId: product.id, documentTemplateId: template.id })));
  console.log(`\nMappings to ensure: ${rows.length} (${slProducts.length} products × ${templates.length} templates)`);

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
