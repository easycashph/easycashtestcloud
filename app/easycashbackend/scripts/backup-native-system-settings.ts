/**
 * 2026-08-20 (user request): "buong system setting naka save hindi lang User accounts" - extends
 * the native-data safety net (§26 loan applications, §27 users, §31/§32 role permissions) to three
 * more admin-configurable settings a full `prisma migrate reset --force` wipes with no way to
 * rebuild:
 * - `DocumentTemplate` customizations (`isRequired`/`requiresBorrowerSignature`/
 *   `requiresCoBorrowerSignature`) - `seed.ts` recreates these rows with ITS OWN defaults, silently
 *   reverting any admin change made through the Document Templates settings tab.
 * - `DocumentTemplateMapping` rows beyond what the migration's own steps 10-12
 *   (map-bl/sl/sml-document-templates.ts) auto-regenerate - those scripts only ensure a fixed
 *   default set exists, they don't know about an EXTRA product an admin manually mapped via the UI.
 * - `ReminderSettings` (the SMS/Email toggle singleton row) - `seed.ts` doesn't create this row at
 *   all, so a reset leaves it completely missing, not just reverted to a default.
 * - `SystemAnnouncement` - pure runtime content with no seed/migration source whatsoever; a reset
 *   deletes every announcement permanently with nothing to regenerate it from.
 *
 * Deliberately excludes Loan Products/Product Versions/penalty & fee rules - those interact
 * directly with the financial ledger (already-disbursed loans reference a specific
 * LoanProductVersion snapshot) and need more careful, separate handling, not a blind restore.
 *
 * Run this BEFORE the reset, alongside the other backup-native-*.ts scripts. Pairs with
 * restore-native-system-settings.ts, run AFTER the fresh migration completes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

async function main() {
  const [templates, mappings, reminderSettings, announcements] = await Promise.all([
    prisma.documentTemplate.findMany({
      select: { code: true, isRequired: true, requiresBorrowerSignature: true, requiresCoBorrowerSignature: true },
    }),
    prisma.documentTemplateMapping.findMany({
      include: { documentTemplate: { select: { code: true } }, loanProduct: { select: { code: true } } },
    }),
    prisma.reminderSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.systemAnnouncement.findMany(),
  ]);

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = path.join(BACKUP_DIR, `native-system-settings-${timestamp}.json`);

  const payload = {
    createdAt: new Date().toISOString(),
    documentTemplates: templates.map((t) => ({
      code: t.code,
      isRequired: t.isRequired,
      requiresBorrowerSignature: t.requiresBorrowerSignature,
      requiresCoBorrowerSignature: t.requiresCoBorrowerSignature,
    })),
    documentTemplateMappings: mappings.map((m) => ({
      templateCode: m.documentTemplate.code,
      productCode: m.loanProduct.code,
    })),
    reminderSettings: reminderSettings
      ? {
          smsEnabled: reminderSettings.smsEnabled,
          emailEnabled: reminderSettings.emailEnabled,
          signingSmsEnabled: reminderSettings.signingSmsEnabled,
          signingEmailEnabled: reminderSettings.signingEmailEnabled,
          portalEmailEnabled: reminderSettings.portalEmailEnabled,
          portalSmsEnabled: reminderSettings.portalSmsEnabled,
        }
      : null,
    announcements: announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      type: a.type,
      showOnLms: a.showOnLms,
      showOnPortal: a.showOnPortal,
      active: a.active,
      expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
      createdByUserId: a.createdByUserId,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(
    `Na-backup: ${payload.documentTemplates.length} document template(s), ${payload.documentTemplateMappings.length} mapping(s), ` +
      `${reminderSettings ? '1' : '0'} reminder settings row, ${payload.announcements.length} announcement(s).`,
  );
  console.log(`Saved to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
