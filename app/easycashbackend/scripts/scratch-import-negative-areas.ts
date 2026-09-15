/**
 * One-time import of the internal "Negative Areas" reference spreadsheet (2026-09-15, user-
 * provided `Negative areas.xlsx`) into the new NegativeArea table. Idempotent - safe to re-run
 * (upserts on the (city, areaName) unique constraint rather than blind-inserting duplicates).
 *
 * Usage: npx tsx scripts/scratch-import-negative-areas.ts [--apply]
 * Without --apply, only prints what would be written (dry run).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Transcribed directly from the source spreadsheet's one column (city/province header rows in
// ALL CAPS, followed by its specific negative areas, blank row between groups) - see this file's
// own doc comment for provenance.
const NEGATIVE_AREAS: { city: string; areaName: string }[] = [
  { city: 'BULACAN', areaName: 'Sapang Palay, San Jose del Monte' },
  { city: 'BULACAN', areaName: 'FVR Village, Norzagaray' },
  { city: 'BULACAN', areaName: 'Erap Village, Angat' },

  { city: 'CALOOCAN', areaName: 'Pangarap Village' },
  { city: 'CALOOCAN', areaName: 'PNR Compound' },

  { city: 'MAKATI', areaName: 'Palar Village' },
  { city: 'MAKATI', areaName: 'Armor Village' },

  { city: 'MANDALUYONG', areaName: 'Welfareville Compound' },
  { city: 'MANDALUYONG', areaName: 'Correctional Compound' },
  { city: 'MANDALUYONG', areaName: 'National Center for Mental Health Compound' },

  { city: 'MANILA', areaName: 'Parola, Tondo' },
  { city: 'MANILA', areaName: 'Baseco, Tondo' },
  { city: 'MANILA', areaName: 'Road 10 Port/Pier Area' },
  { city: 'MANILA', areaName: 'Capulong St. C-2 Road Tondo' },
  { city: 'MANILA', areaName: 'Angalo St. Binondo' },
  { city: 'MANILA', areaName: 'Oportunidad St. CM Recto' },
  { city: 'MANILA', areaName: 'Mabuhay St. Tondo' },
  { city: 'MANILA', areaName: 'Road 10 Tondo' },
  { city: 'MANILA', areaName: 'Capulong Street Tondo' },
  { city: 'MANILA', areaName: 'Tambunting Compound Sta. Cruz' },

  { city: 'PARAÑAQUE', areaName: 'Bagong Lipunan St.' },
  { city: 'PARAÑAQUE', areaName: 'Bagong Silang St. Baclaran' },
  { city: 'PARAÑAQUE', areaName: 'Bagong Sikat St. Baclaran' },
  { city: 'PARAÑAQUE', areaName: 'Bagong Buhay St. Baclaran' },
  { city: 'PARAÑAQUE', areaName: 'Pag-asa St. Baclaran' },
  { city: 'PARAÑAQUE', areaName: 'Bagong Ilog St. Baclaran' },
  { city: 'PARAÑAQUE', areaName: 'Mabuhay St.' },
  { city: 'PARAÑAQUE', areaName: 'Sitio Libo, Brgy. Sto. Niño' },
  { city: 'PARAÑAQUE', areaName: 'Kalayaan Village, Merville' },

  { city: 'PASAY', areaName: 'Estero de Tripa Gallina' },
  { city: 'PASAY', areaName: 'Electrical Road, Manila Domestic Airport' },
  { city: 'PASAY', areaName: 'Pasay Chest Clinic' },
  { city: 'PASAY', areaName: 'Maricaban' },
  { city: 'PASAY', areaName: 'Tramo (South)' },
  { city: 'PASAY', areaName: 'Don Carlos Revilla St.' },
  { city: 'PASAY', areaName: 'Maginhawa' },
  { city: 'PASAY', areaName: 'Estrella' },

  { city: 'PASIG', areaName: 'Nagpayong' },
  { city: 'PASIG', areaName: 'Centennial Homes' },
  { city: 'PASIG', areaName: 'Kalawaan Resettlement' },

  { city: 'QUEZON CITY', areaName: 'Katuparan St. Brgy. Commonwealth' },
  { city: 'QUEZON CITY', areaName: 'Kaunlaran St. Brgy. Commonwealth' },
  { city: 'QUEZON CITY', areaName: 'Kasunduan St. Brgy. Commonwealth' },
  { city: 'QUEZON CITY', areaName: 'Katarungan St. Batasan Hills' },
  { city: 'QUEZON CITY', areaName: 'Kalinisan St. Brgy. Commonwealth' },
  { city: 'QUEZON CITY', areaName: 'Kalayaan St. Batasan Hills' },
  { city: 'QUEZON CITY', areaName: 'Payatas A & B' },
  { city: 'QUEZON CITY', areaName: 'Litex' },
  { city: 'QUEZON CITY', areaName: 'Freedom Park Batasan Hills' },
  { city: 'QUEZON CITY', areaName: 'Cabalata St. Tatalon' },

  { city: 'TAGUIG', areaName: 'Maharlika Village' },

  { city: 'VALENZUELA', areaName: 'Sitio Bilog Balangkas' },
  { city: 'VALENZUELA', areaName: 'Wawang Pulo' },

  { city: 'MALABON', areaName: 'Gozon Compound' },
  { city: 'MALABON', areaName: 'Kadima' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`${NEGATIVE_AREAS.length} negative areas to import${apply ? '' : ' (dry run - pass --apply to write)'}.`);

  if (!apply) {
    for (const row of NEGATIVE_AREAS) console.log(`  ${row.city} - ${row.areaName}`);
    return;
  }

  let created = 0;
  let skipped = 0;
  for (const row of NEGATIVE_AREAS) {
    const result = await prisma.negativeArea.upsert({
      where: { city_areaName: { city: row.city, areaName: row.areaName } },
      update: {},
      create: row,
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
    else skipped++;
  }
  console.log(`Done. ${created} created, ${skipped} already existed.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
