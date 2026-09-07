const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Asia/Manila is fixed UTC+8 year-round (no DST), so shifting the instant by the offset before
 * reading UTC Y/M/D fields gives the correct Manila wall-clock date - then Date.UTC's own
 * month/day overflow normalization handles any month/year rollover from `targetDate` for free.
 *
 * `end` is EXCLUSIVE (the start of the next Manila day) - callers doing an inclusive `<=` bound
 * should use `end.getTime() - 1`.
 */
export function manilaDayRange(targetDate: Date): { start: Date; end: Date } {
  const manilaWallClock = new Date(targetDate.getTime() + MANILA_OFFSET_MS);
  const manilaMidnightUtcMs =
    Date.UTC(manilaWallClock.getUTCFullYear(), manilaWallClock.getUTCMonth(), manilaWallClock.getUTCDate(), 0, 0, 0) - MANILA_OFFSET_MS;
  return { start: new Date(manilaMidnightUtcMs), end: new Date(manilaMidnightUtcMs + 24 * 60 * 60 * 1000) };
}

/** The Asia/Manila calendar-day start for `targetDate`. */
export function manilaCalendarDay(targetDate: Date): Date {
  return manilaDayRange(targetDate).start;
}

/**
 * Whole Asia/Manila calendar days from `from` to `to` (never negative).
 *
 * 2026-08-12 (user-reported, via SML-REG_00323's Accrued Interest showing 71 days where the
 * borrower-facing schedule says 70): every date-difference in this codebase used to read UTC
 * calendar fields directly. That silently disagreed with the data for every CP12-migrated row,
 * which stores Manila midnight as `T16:00:00Z` — so `2026-06-02T16:00:00.000Z` is June **3** in
 * Manila (what SDevTech printed, and what this system's own UI shows), but UTC reads it as June 2,
 * costing an extra day on every affected figure. 8,033 of 8,822 schedule rows use that convention.
 *
 * Uses `manilaCalendarDay` on both ends, so it is also correct for a bare `@db.Date` column (which
 * arrives as UTC midnight and lands on the same Manila calendar day) and for a natively-created
 * `T00:00:00Z` date — one helper, no per-caller special-casing.
 */
export function manilaDaysBetween(from: Date, to: Date): number {
  const fromDay = manilaCalendarDay(from).getTime();
  const toDay = manilaCalendarDay(to).getTime();
  return Math.max(0, Math.round((toDay - fromDay) / (24 * 60 * 60 * 1000)));
}

/**
 * Number of days (28/29/30/31) in the Asia/Manila calendar month `targetDate` falls in — the
 * divisor `PenaltyCalculator` prorates by (`ADR-050` §9). Manila-based for the same reason as
 * `manilaDaysBetween`: a `T16:00:00Z` due date at a month boundary (e.g. `2026-05-31T16:00:00.000Z`
 * = June 1 in Manila) would otherwise be prorated against the wrong month's length.
 */
export function manilaDaysInMonth(targetDate: Date): number {
  const wall = manilaWallClock(targetDate);
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + 1, 0)).getUTCDate();
}

/**
 * Whole Manila calendar months elapsed from `start` to `end` (`end` assumed >= `start`) — the
 * "hasn't had its birthday yet this month" arithmetic used for age-in-years, applied to months.
 * Used by `PenaltyCalculator.calculateSimple` (ADR-053 / SEC MC 3, which is charged per whole month
 * rather than daily).
 */
export function manilaWholeMonthsBetween(start: Date, end: Date): number {
  const s = manilaWallClock(start);
  const e = manilaWallClock(end);
  let months = (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth());
  if (e.getUTCDate() < s.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * An instant re-based so that reading its **UTC** Y/M/D/H fields yields the Asia/Manila wall-clock
 * values. Never expose or persist this — it is a deliberately "wrong" instant, useful only as an
 * intermediate for reading calendar fields. (Contrast `manilaCalendarDay`, which returns a real,
 * correct instant.)
 */
function manilaWallClock(targetDate: Date): Date {
  return new Date(targetDate.getTime() + MANILA_OFFSET_MS);
}

/**
 * 2026-09-07 (user-reported): the Loan Releases Excel export showed Aug 31 for a loan the on-screen
 * report (and SDevTech itself) correctly showed as Sep 1 - `activatedAt` is stored as
 * `2026-08-31T16:00:00.000Z` (real UTC instant = Manila midnight Sep 1), but ExcelJS/Excel has no
 * timezone concept: it reads a JS Date's **UTC** Y/M/D straight through as the displayed calendar
 * date, the same way it would for a UTC-naive `numFmt`-formatted cell. Passing the real instant
 * (`2026-08-31T16:00:00.000Z`) therefore always displays one day early for any Manila-midnight
 * timestamp.
 *
 * This is the one legitimate use of the "wrong instant" trick `manilaWallClock` above deliberately
 * warns never to expose: exported specifically for feeding a timezone-naive UTC-field-reading
 * renderer (ExcelJS, or any other library/format with the same limitation) so the calendar date it
 * displays matches Manila wall-clock reality. Never use this for arithmetic, storage, or comparison
 * - `manilaCalendarDay`/`manilaDaysBetween` above remain correct for those.
 */
export function manilaExcelDisplayDate(targetDate: Date): Date {
  return manilaWallClock(targetDate);
}
