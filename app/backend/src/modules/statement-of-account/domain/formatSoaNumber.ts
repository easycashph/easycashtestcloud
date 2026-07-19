/**
 * `SOA-{5-digit sequence}-{MMDDYYYY}` — matches the legacy Excel/VBA tool's own numbering
 * (2026-07-19, confirmed against a real screenshot of that tool, e.g. `SOA-00001-07192026`).
 * See `GeneratedStatementOfAccount.soaSequenceNumber`'s own doc comment in schema.prisma for why
 * this is a plain "max + 1" counter rather than a Postgres autoincrement column.
 */
export function formatSoaNumber(soaSequenceNumber: number, generatedAt: Date): string {
  const mm = String(generatedAt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(generatedAt.getUTCDate()).padStart(2, '0');
  const yyyy = generatedAt.getUTCFullYear();
  return `SOA-${String(soaSequenceNumber).padStart(5, '0')}-${mm}${dd}${yyyy}`;
}
