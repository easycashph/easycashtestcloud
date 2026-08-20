/**
 * One-off seed for the AUTO_ROTATION pool (2026-08-20 user request) - imports the 17 usable
 * image+caption pairs from `legacy/reports/Meta Business Suite/` (18 numbered images minus
 * `15(outdated easycash office).png`, whose own file name already marks it stale) as the starting
 * rotation pool for the Portal's daily Facebook-style post. Captions transcribed from
 * `000 Meta Ads captions.docx` in that same folder.
 *
 * Idempotent - safe to re-run: skips any pool item whose `poolOrder` already exists.
 * Run: `npx tsx scripts/seed-mis-post-pool.ts --apply` (dry-run without --apply).
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { prisma } from '@shared/database/prismaClient';
import { LocalFileStorage } from '@modules/document/infrastructure/LocalFileStorage';
import { MisPost } from '@modules/mis-post/domain/MisPost';
import { PrismaMisPostRepository } from '@modules/mis-post/infrastructure/PrismaMisPostRepository';

const MATERIALS_DIR = path.resolve(__dirname, '../../../legacy/reports/Meta Business Suite');

const CTA = 'easycash.ph or call Globe: 09277847091 / Smart: 09475956151. DON’T BE A VICTIM OF FIXERS AND ONLINE SCAMMERS! Easycash Lending Company Inc. DOES NOT COLLECT FEES at any stage of the loan application process.';

/** filename -> caption, in the pool order they should rotate in (1 through 18, skipping the
 * file explicitly marked outdated). */
const POOL: { fileName: string; caption: string }[] = [
  { fileName: '1.png', caption: `Need a secure and trusted loan? Easycash is here to help! Apply now with confidence. 🔐💼 ${CTA}` },
  { fileName: '2.png', caption: `Sana all may safe at maayos na loan approval! Apply now with Easycash and experience peace of mind. ✔️ ${CTA}` },
  { fileName: '3.png', caption: `Don’t risk your finances. Choose a trusted and secure loan partner. Apply now at Easycash. 🔒 ${CTA}` },
  { fileName: '4.png', caption: `Safe. Transparent. Worry-free. That’s how loan applications should be. Apply today at Easycash. ✅ ${CTA}` },
  { fileName: '5.png', caption: `Need funds? Easycash offers a safe and reliable way to get approved. Apply today! 🛡️ ${CTA}` },
  { fileName: '6.png', caption: `Looking for a secure loan process? Easycash is your trusted financial partner. 🔍 ${CTA}` },
  { fileName: '7.png', caption: `No need to stress. Apply today and let Easycash provide a safe and smooth loan experience. 💼✔️ ${CTA}` },
  { fileName: '8.png', caption: `Bills piling up? Easycash is here with secure and dependable loan options. 💳🛡️ ${CTA}` },
  { fileName: '9.png', caption: `Life doesn’t stop, and neither should your finances. Get a safe and worry-free loan with Easycash. 🔐 ${CTA}` },
  { fileName: '10.png', caption: `Need financial help? Easycash offers a trusted, secure way to apply. 🛡️💰 ${CTA}` },
  { fileName: '11.png', caption: `Apply confidently. Easycash offers a safe and honest loan process you can rely on. 💼📲 ${CTA}` },
  { fileName: '12.png', caption: `Skip the worries. Easycash gives you peace of mind with every application. 🔒💸 ${CTA}` },
  { fileName: '13.png', caption: `Money stress? Choose a secure and trusted lender. Apply now with Easycash. 🔐📞 ${CTA}` },
  { fileName: '14.png', caption: `Safe and secure loan approval starts here. Apply today with Easycash. 💵✅ ${CTA}` },
  // 15.png (outdated office photo) deliberately skipped - see file's own name in the materials folder.
  { fileName: '16.png', caption: `Tired of sketchy loan offers? Easycash offers secure and professional loan services. 💸🔐 Apply today! ${CTA}` },
  { fileName: '17.png', caption: `Need cash? Get approved through a safe and reliable process with Easycash. 🛡️💰 ${CTA}` },
  { fileName: '18.png', caption: `Kailangan mo ng pera? Easycash offers maayos at siguradong loan approval. Apply now! 💥💸 ${CTA}` },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const fileStorage = new LocalFileStorage();
  const misPostRepository = new PrismaMisPostRepository();

  const existingPool = await misPostRepository.findAutoRotationPool();
  const existingOrders = new Set(existingPool.map((p) => p.poolOrder));

  console.log(`Found ${existingPool.length} existing AUTO_ROTATION pool item(s).`);

  let created = 0;
  for (let i = 0; i < POOL.length; i++) {
    const item = POOL[i]!;
    if (existingOrders.has(i)) {
      console.log(`[skip] poolOrder ${i} (${item.fileName}) already seeded.`);
      continue;
    }

    const sourcePath = path.join(MATERIALS_DIR, item.fileName);
    const data = await fs.readFile(sourcePath);
    console.log(`[${apply ? 'APPLY' : 'DRY-RUN'}] poolOrder ${i}: ${item.fileName} (${data.length} bytes)`);

    if (!apply) continue;

    const extension = path.extname(item.fileName);
    const storageKey = path.posix.join('mis-posts', 'pool', `${i}${extension}`);
    await fileStorage.save(storageKey, data);

    const post = MisPost.createAutoRotationPost({
      caption: item.caption,
      imageStorageKey: storageKey,
      imageFileName: item.fileName,
      imageFileType: extension === '.jpg' || extension === '.jpeg' ? 'image/jpeg' : 'image/png',
      poolOrder: i,
      createdByUserId: null,
    });
    await misPostRepository.save(post);
    created++;
  }

  // Light up the first pool item if nothing is currently live yet, so the rotation has a starting
  // point instead of showing nothing until the next scheduled 24-hour advance.
  if (apply) {
    const current = await misPostRepository.findCurrentLiveAutoPost();
    if (!current) {
      const pool = await misPostRepository.findAutoRotationPool();
      if (pool.length > 0) {
        pool[0]!.setIsCurrentlyLive(true);
        await misPostRepository.save(pool[0]!);
        console.log(`Lit up poolOrder 0 (${pool[0]!.toProps().imageFileName}) as the first live post.`);
      }
    }
  }

  console.log(`\nDone. ${created} pool item(s) ${apply ? 'created' : 'would be created'}.`);
  if (!apply) console.log('Re-run with --apply to write for real.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
