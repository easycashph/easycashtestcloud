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
