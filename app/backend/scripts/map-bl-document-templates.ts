/**
 * One-time, idempotent seed (2026-07-15, user-confirmed business rule): every "BL"-prefixed loan
 * product (BL-REG, BL-REG(OLD), BL-SPEC) gets 1 conditional document: Manulife.
 *
 * Uses `createMany({ skipDuplicates: true })` so re-running is a no-op once applied.
 *
 * Usage: npx tsx scripts/map-bl-document-templates.ts [--dry-run]
 */
import 'dotenv/config';
import { prisma } from '../src/shared/database/prismaClient';

const DRY_RUN = process.argv.includes('--dry-run');

const DOCUMENT_TEMPLATE_CODES = ['MANULIFE'];

async function main(): Promise<void> {
  console.log(`=== Map BL loan products to conditional document templates ${DRY_RUN ? '(DRY RUN — no writes)' : ''} ===`);

  const blProducts = await prisma.loanProduct.findMany({
    where: { code: { startsWith: 'BL', mode: 'insensitive' } },
    select: { id: true, code: true, name: true },
  });
  console.log(`BL loan products found: ${blProducts.length}`);
  blProducts.forEach((p) => console.log(`  ${p.code} — ${p.name}`));

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

  const rows = blProducts.flatMap((product) => templates.map((template) => ({ loanProductId: product.id, documentTemplateId: template.id })));
  console.log(`\nMappings to ensure: ${rows.length} (${blProducts.length} products × ${templates.length} templates)`);

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
