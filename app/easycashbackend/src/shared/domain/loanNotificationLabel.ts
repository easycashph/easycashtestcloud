/** 2026-09-03 (user request: "para madali malaman kung sinong borrower ito") - shared by every
 * write-time loan-lifecycle notification (Closed, Recovered, Restructured, Rescheduled) so a
 * notification always reads "Loan {code} ({Client Name})" when the borrower's name is available,
 * matching the format the daily-scan notifications (Overdue/Matured/First Amortization) already
 * use - falls back to the bare loan code only if a borrower somehow can't be resolved (never
 * blocks the notification itself over a missing name). */
export function loanNotificationLabel(loanCode: string, borrowerName: string | null | undefined): string {
  return borrowerName ? `${loanCode} (${borrowerName})` : loanCode;
}
