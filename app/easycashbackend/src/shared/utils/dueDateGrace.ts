import { manilaDaysBetween } from '@shared/domain/manilaTime';

/**
 * 2026-08-20 (user-reported, BL-SPEC_00028): `RepaymentSchedule.dueDate` is stored as Asia/Manila
 * midnight encoded as a UTC instant (e.g. "2026-08-19T16:00:00.000Z" = August 20 00:00 PHT - see
 * PrismaReportingRepository.ts's `daysLateOf()` doc comment for the same convention, confirmed
 * there via a real migrated loan, and `manilaTime.ts`'s own doc comments for the general
 * Manila-calendar-day handling this reuses). Comparing that raw timestamp against `now` with a
 * plain `<` meant an installment due "today" was already flagged overdue/LATE/matured the instant
 * midnight ticked over, with zero grace for the rest of its own due day - found via a real account
 * (BL-SPEC_00028) showing "Matured" while its due date (today) hadn't actually finished yet.
 *
 * `isDueDatePast`/`overdueCutoff` give the account/borrower the FULL Manila calendar day of the
 * due date to pay - only becomes overdue starting the day AFTER, matching `daysLateOf()`'s existing
 * `Math.floor(diffMs / 86_400_000)` day-count (which already implicitly granted this same grace -
 * a same-day due date floors to 0 days late there). Deliberately does NOT touch penalty accrual
 * itself (`CurrentPenaltyResolver`/`resolveComputedPenalty`), which already keys off that same
 * day-floor math and was not reported as wrong.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** True once at least one FULL Manila calendar day has elapsed since `dueDate` - not merely once
 * its midnight instant has passed. `now` defaults to the real clock; pass an explicit value in
 * tests/report "as of" runs. */
export function isDueDatePast(dueDate: Date, now: Date = new Date()): boolean {
  return manilaDaysBetween(dueDate, now) >= 1;
}

/** For a Prisma `dueDate: { lt: cutoff }` filter meaning "the due date's full day has already
 * elapsed" - equivalent to `isDueDatePast(dueDate, now)` but usable as a query-level bound instead
 * of a per-row JS check. */
export function overdueCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ONE_DAY_MS);
}
