/**
 * Product Type -> Product Class grouping (2026-07-14), keyed off each product's `name` prefix
 * (e.g. "BL-Regular" -> Business Loan) - not `code`, which doesn't consistently carry the same
 * prefix (e.g. code "SML_Seacon" vs name "SML-SEACON"). Order here is display order. Any product
 * whose name doesn't match one of these five prefixes falls into a trailing "Other" group instead
 * of being silently dropped - e.g. legacy-only lines like Chattel Mortgage, OFW, PL-/CL-/REL-/SP-,
 * that were never confirmed to belong to one of these five named types. Shared between the Loan
 * Products catalog page and the Create Loan Account form's Product Type -> Product Class picker.
 */
const PRODUCT_TYPE_DEFS: { type: string; prefix: string }[] = [
  { type: 'Business Loan', prefix: 'BL-' },
  { type: 'Purchase Financing Loan', prefix: 'PFL-' },
  { type: 'Salary Loan', prefix: 'SL-' },
  { type: 'Seafarer Loan', prefix: 'SML-' },
  { type: 'Small and Medium-sized Enterprises Loan', prefix: 'SME-' },
];
export const OTHER_PRODUCT_TYPE = 'Other';
export const PRODUCT_TYPE_ORDER = [...PRODUCT_TYPE_DEFS.map((d) => d.type), OTHER_PRODUCT_TYPE];

export function classifyProductType(name: string): string {
  const upper = name.toUpperCase();
  return PRODUCT_TYPE_DEFS.find((d) => upper.startsWith(d.prefix))?.type ?? OTHER_PRODUCT_TYPE;
}

export function groupByProductType<T extends { productType: string }>(rows: T[]): { type: string; rows: T[] }[] {
  const byType = new Map<string, T[]>();
  for (const row of rows) {
    const arr = byType.get(row.productType) ?? [];
    arr.push(row);
    byType.set(row.productType, arr);
  }
  return PRODUCT_TYPE_ORDER.map((type) => ({ type, rows: byType.get(type) ?? [] })).filter((g) => g.rows.length > 0);
}
