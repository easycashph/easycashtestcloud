/**
 * 2026-09-14: reference list of common BSP-supervised Philippine banks, used as suggestions for
 * the Loan Application Detail page's Mode of payment and mitigation "Bank" field (bank/ATM
 * surrendered as security).
 *
 * Not an official BSP registry lookup (none is wired up) - general, stable reference data, kept
 * here as a starting suggestion list only. The Bank field stays free text; a bank not on this list
 * must never be blocked from being recorded as-is.
 */
export const PHILIPPINE_BANKS: string[] = [
  // Universal / Commercial Banks
  'BDO Unibank',
  'Bank of the Philippine Islands (BPI)',
  'Metropolitan Bank & Trust Co. (Metrobank)',
  'Land Bank of the Philippines (LandBank)',
  'Philippine National Bank (PNB)',
  'Security Bank',
  'China Banking Corporation (Chinabank)',
  'Union Bank of the Philippines (UnionBank)',
  'Rizal Commercial Banking Corporation (RCBC)',
  'Development Bank of the Philippines (DBP)',
  'East West Banking Corporation (EastWest Bank)',
  'Asia United Bank (AUB)',
  'Philippine Bank of Communications (PBCOM)',
  'Robinsons Bank',
  'Maybank Philippines',
  'Bank of Commerce',
  'Philippine Veterans Bank',
  'Philippine Trust Company (Philtrust Bank)',
  'Al-Amanah Islamic Investment Bank',
  // Thrift / Savings Banks
  'Philippine Savings Bank (PSBank)',
  'BPI Family Savings Bank',
  'Sterling Bank of Asia',
  'Producers Savings Bank',
  // Digital Banks
  'CIMB Bank Philippines',
  'Tonik Digital Bank',
  'GoTyme Bank',
  'Maya Bank',
  'UnionDigital Bank',
  'UNObank',
];
