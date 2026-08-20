/**
 * 2026-08-20 (user request): restores whatever backup-native-system-settings.ts saved right
 * before the reset, back into the freshly-migrated database. See that script's own doc comment
 * for the full reasoning/scope (Document Template customizations + extra mappings, Reminder
 * Settings, System Announcements - deliberately excludes Loan Products).
 *
 * Run this AFTER the fresh migration completes, alongside restore-native-users.ts/
 * restore-native-role-permissions.ts/restore-native-loan-applications.ts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '@shared/database/prismaClient';

const BACKUP_DIR = path.join(__dirname, '..', '..', '..', 'legacy', 'native-backups');

interface BackedUpPayload {
  documentTemplates: { code: string; isRequired: boolean; requiresBorrowerSignature: boolean; requiresCoBorrowerSignature: boolean }[];
  documentTemplateMappings: { templateCode: string; productCode: string }[];
  reminderSettings: {
    smsEnabled: boolean;
    emailEnabled: boolean;
    signingSmsEnabled: boolean;
    signingEmailEnabled: boolean;
    portalEmailEnabled: boolean;
    portalSmsEnabled: boolean;
  } | null;
  announcements: {
    id: string;
    title: string;
    body: string;
    type: string;
    showOnLms: boolean;
    showOnPortal: boolean;
    active: boolean;
    expiresAt: string | null;
    createdByUserId: string;
    createdAt: string;
  }[];
}

function findLatestBackup(): string | null {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('native-system-settings-') && f.endsWith('.json'))
    .sort()
    .reverse();
  return files.length > 0 ? path.join(BACKUP_DIR, files[0]!) : null;
}

async function main() {
  const backupPath = findLatestBackup();
  if (!backupPath) {
    console.log('Walang nahanap na native-system-settings backup - walang irerestore.');
    return;
  }
  console.log(`Gagamitin: ${backupPath}`);
  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as BackedUpPayload;

  // --- Document Templates (isRequired / signature requirements) ---
  let templatesUpdated = 0;
  let templatesSkipped = 0;
  for (const t of payload.documentTemplates) {
    const existing = await prisma.documentTemplate.findUnique({ where: { code: t.code } });
    if (!existing) {
      console.warn(`  ! Document template "${t.code}" hindi nahanap pagkatapos ng migration - nalaktawan.`);
      templatesSkipped++;
      continue;
    }
    if (
      existing.isRequired !== t.isRequired ||
      existing.requiresBorrowerSignature !== t.requiresBorrowerSignature ||
      existing.requiresCoBorrowerSignature !== t.requiresCoBorrowerSignature
    ) {
      await prisma.documentTemplate.update({
        where: { code: t.code },
        data: {
          isRequired: t.isRequired,
          requiresBorrowerSignature: t.requiresBorrowerSignature,
          requiresCoBorrowerSignature: t.requiresCoBorrowerSignature,
        },
      });
      templatesUpdated++;
    }
  }
  console.log(`Document templates: ${templatesUpdated} na-update, ${templatesSkipped} nalaktawan.`);

  // --- Document Template Mappings (extras beyond the migration's own auto-regenerated defaults) ---
  const allTemplates = await prisma.documentTemplate.findMany({ select: { id: true, code: true } });
  const templateIdByCode = new Map(allTemplates.map((t) => [t.code, t.id]));
  const allProducts = await prisma.loanProduct.findMany({ select: { id: true, code: true } });
  const productIdByCode = new Map(allProducts.map((p) => [p.code, p.id]));

  const mappingRows: { documentTemplateId: string; loanProductId: string }[] = [];
  let mappingsSkipped = 0;
  for (const m of payload.documentTemplateMappings) {
    const documentTemplateId = templateIdByCode.get(m.templateCode);
    const loanProductId = productIdByCode.get(m.productCode);
    if (!documentTemplateId || !loanProductId) {
      console.warn(
        `  ! Nalaktawan ang mapping "${m.templateCode}" -> "${m.productCode}" - ${!documentTemplateId ? 'template' : 'product'} hindi nahanap.`,
      );
      mappingsSkipped++;
      continue;
    }
    mappingRows.push({ documentTemplateId, loanProductId });
  }
  const mappingResult =
    mappingRows.length > 0 ? await prisma.documentTemplateMapping.createMany({ data: mappingRows, skipDuplicates: true }) : { count: 0 };
  console.log(
    `Document template mappings: ${mappingResult.count} bagong mapping (${mappingRows.length - mappingResult.count} nasa DB na), ${mappingsSkipped} nalaktawan.`,
  );

  // --- Reminder Settings (singleton) ---
  if (payload.reminderSettings) {
    await prisma.reminderSettings.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', ...payload.reminderSettings },
      update: { ...payload.reminderSettings },
    });
    console.log('Reminder settings: na-restore.');
  } else {
    console.log('Reminder settings: walang laman sa backup - nalaktawan.');
  }

  // --- System Announcements ---
  const existingUserIds = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id));
  let announcementsRestored = 0;
  let announcementsSkipped = 0;
  for (const a of payload.announcements) {
    if (!existingUserIds.has(a.createdByUserId)) {
      console.warn(`  ! Nalaktawan ang announcement "${a.title}" - hindi nahanap ang creator user pagkatapos ng migration.`);
      announcementsSkipped++;
      continue;
    }
    try {
      await prisma.systemAnnouncement.create({
        data: {
          id: a.id,
          title: a.title,
          body: a.body,
          type: a.type as never,
          showOnLms: a.showOnLms,
          showOnPortal: a.showOnPortal,
          active: a.active,
          expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
          createdByUserId: a.createdByUserId,
          createdAt: new Date(a.createdAt),
        },
      });
      announcementsRestored++;
    } catch (error) {
      console.warn(`  ! Nalaktawan ang announcement "${a.title}" - ${(error as Error).message.split('\n')[0]}`);
      announcementsSkipped++;
    }
  }
  console.log(`Announcements: ${announcementsRestored}/${payload.announcements.length} na-restore.`);
  if (announcementsSkipped > 0) {
    console.log(`Nalaktawan: ${announcementsSkipped} announcement(s) - see mga warning sa itaas.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
