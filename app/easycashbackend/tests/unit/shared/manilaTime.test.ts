import { describe, expect, it } from 'vitest';
import {
  manilaCalendarDay,
  manilaDayRange,
  manilaDaysBetween,
  manilaDaysInMonth,
  manilaWholeMonthsBetween,
} from '@shared/domain/manilaTime';

/**
 * 2026-08-12 regression suite. The bug these guard against: every date-difference in the codebase
 * read UTC calendar fields, but CP12-migrated rows store Manila midnight as `T16:00:00Z` — so a
 * due date of `2026-06-02T16:00:00.000Z` is June **3** in Manila (what SDevTech printed and what
 * this system's own UI shows), while UTC read it as June 2. That cost one extra day on every
 * affected penalty / accrued-interest figure across 8,033 of 8,822 schedule rows.
 */
describe('manilaTime', () => {
  const MIGRATED_JUNE_3 = new Date('2026-06-02T16:00:00.000Z'); // Manila midnight, June 3
  const NATIVE_JUNE_3 = new Date('2026-06-03T00:00:00.000Z'); // UTC midnight, also June 3 in Manila
  const BARE_DATE_AUG_12 = new Date('2026-08-12T00:00:00.000Z'); // a Prisma @db.Date column

  describe('manilaDaysBetween', () => {
    it('reads a T16:00Z migrated due date as the NEXT calendar day (the original off-by-one)', () => {
      // June 3 -> Aug 12 is 70 days. Reading the stored value as UTC (June 2) gives 71.
      expect(manilaDaysBetween(MIGRATED_JUNE_3, BARE_DATE_AUG_12)).toBe(70);
    });

    it('treats the two storage conventions identically — both are June 3 in Manila', () => {
      expect(manilaDaysBetween(MIGRATED_JUNE_3, BARE_DATE_AUG_12)).toBe(
        manilaDaysBetween(NATIVE_JUNE_3, BARE_DATE_AUG_12),
      );
    });

    it('counts whole calendar days, not 24h multiples, regardless of time of day', () => {
      const lateEvening = new Date('2026-08-12T15:59:00.000Z'); // 23:59 Manila, still Aug 12
      const justAfterMidnight = new Date('2026-08-12T16:01:00.000Z'); // 00:01 Manila, now Aug 13
      expect(manilaDaysBetween(MIGRATED_JUNE_3, lateEvening)).toBe(70);
      expect(manilaDaysBetween(MIGRATED_JUNE_3, justAfterMidnight)).toBe(71);
    });

    it('never returns a negative count', () => {
      expect(manilaDaysBetween(BARE_DATE_AUG_12, MIGRATED_JUNE_3)).toBe(0);
    });

    it('is zero on the due date itself', () => {
      expect(manilaDaysBetween(MIGRATED_JUNE_3, MIGRATED_JUNE_3)).toBe(0);
      expect(manilaDaysBetween(MIGRATED_JUNE_3, new Date('2026-06-03T10:00:00.000Z'))).toBe(0);
    });
  });

  describe('manilaDaysInMonth', () => {
    it('uses the Manila month at a month boundary, not the UTC one', () => {
      // 2026-05-31T16:00Z is June 1 in Manila — the penalty divisor must be June's 30, not May's 31.
      expect(manilaDaysInMonth(new Date('2026-05-31T16:00:00.000Z'))).toBe(30);
    });

    it('handles February in a leap year', () => {
      expect(manilaDaysInMonth(new Date('2028-02-15T00:00:00.000Z'))).toBe(29);
      expect(manilaDaysInMonth(new Date('2026-02-15T00:00:00.000Z'))).toBe(28);
    });

    it('rolls the year over correctly at a December boundary', () => {
      // 2026-12-31T16:00Z is Jan 1, 2027 in Manila.
      expect(manilaDaysInMonth(new Date('2026-12-31T16:00:00.000Z'))).toBe(31);
    });
  });

  describe('manilaWholeMonthsBetween', () => {
    it('does not count a month until the day-of-month is reached', () => {
      expect(manilaWholeMonthsBetween(MIGRATED_JUNE_3, new Date('2026-07-01T00:00:00.000Z'))).toBe(0);
      expect(manilaWholeMonthsBetween(MIGRATED_JUNE_3, new Date('2026-07-03T00:00:00.000Z'))).toBe(1);
    });

    it('uses the Manila day-of-month for the boundary comparison', () => {
      // Both ends are T16:00Z, i.e. the 3rd in Manila — exactly one whole month.
      expect(manilaWholeMonthsBetween(MIGRATED_JUNE_3, new Date('2026-07-02T16:00:00.000Z'))).toBe(1);
    });

    it('never returns a negative count', () => {
      expect(manilaWholeMonthsBetween(BARE_DATE_AUG_12, MIGRATED_JUNE_3)).toBe(0);
    });
  });

  describe('manilaCalendarDay / manilaDayRange', () => {
    it('returns the real instant of Manila midnight (16:00Z the previous day)', () => {
      expect(manilaCalendarDay(new Date('2026-06-03T10:00:00.000Z')).toISOString()).toBe('2026-06-02T16:00:00.000Z');
    });

    it('exposes an exclusive end exactly 24h after the start', () => {
      const { start, end } = manilaDayRange(new Date('2026-06-03T10:00:00.000Z'));
      expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });
});
