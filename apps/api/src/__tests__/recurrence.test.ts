import { describe, it, expect } from 'bun:test';
import { computeNextRecurrenceDate } from '../utils/recurrence';

// Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6

describe('computeNextRecurrenceDate', () => {
  describe('when recurrenceType is null', () => {
    it('returns null', () => {
      const result = computeNextRecurrenceDate(
        { recurrenceType: null, recurrenceIntervalDays: null, recurrenceWeekday: null },
        new Date('2024-01-15')
      );
      expect(result).toBeNull();
    });
  });

  describe('daily_interval', () => {
    it('adds the interval days to completedAt', () => {
      const completedAt = new Date('2024-01-15');
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: 3, recurrenceWeekday: null },
        completedAt
      );
      expect(result).not.toBeNull();
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-18');
    });

    it('works for an interval of 1 day', () => {
      const completedAt = new Date('2024-01-31');
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: 1, recurrenceWeekday: null },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-02-01');
    });

    it('works for a 30-day interval spanning months', () => {
      const completedAt = new Date('2024-01-15');
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: 30, recurrenceWeekday: null },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-02-14');
    });

    it('returns null when intervalDays is null', () => {
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: null, recurrenceWeekday: null },
        new Date('2024-01-15')
      );
      expect(result).toBeNull();
    });

    it('returns null when intervalDays is 0', () => {
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: 0, recurrenceWeekday: null },
        new Date('2024-01-15')
      );
      expect(result).toBeNull();
    });

    it('does not mutate completedAt', () => {
      const completedAt = new Date('2024-01-15');
      const original = completedAt.toISOString();
      computeNextRecurrenceDate(
        { recurrenceType: 'daily_interval', recurrenceIntervalDays: 7, recurrenceWeekday: null },
        completedAt
      );
      expect(completedAt.toISOString()).toBe(original);
    });
  });

  describe('weekly', () => {
    // 2024-01-15 is a Monday (Monday=0)
    // 2024-01-16 is a Tuesday (Tuesday=1)
    // 2024-01-20 is a Saturday (Saturday=5)

    it('returns the next occurrence of the target weekday when it is ahead', () => {
      // completed on Monday (0), target is Wednesday (2) → next Wednesday in 2 days
      const completedAt = new Date('2024-01-15'); // Monday
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 2 },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-17'); // Wednesday
    });

    it('wraps to next week when target weekday is behind or same as current', () => {
      // completed on Wednesday (2), target is Monday (0) → next Monday in 5 days
      const completedAt = new Date('2024-01-17'); // Wednesday
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 0 },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-22'); // next Monday
    });

    it('wraps to next week when target is same weekday as completedAt', () => {
      // completed on Monday (0), target is also Monday (0) → next Monday in 7 days
      const completedAt = new Date('2024-01-15'); // Monday
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 0 },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-22'); // next Monday
    });

    it('handles Sunday correctly (Sunday = 6 in Monday-based encoding)', () => {
      // completed on Friday (4), target is Sunday (6) → in 2 days
      const completedAt = new Date('2024-01-19'); // Friday
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 6 },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-21'); // Sunday
    });

    it('handles completedAt on Sunday (JS getDay()=0)', () => {
      // completed on Sunday (JS=0 → Monday-based=6), target is Monday (0) → in 1 day
      const completedAt = new Date('2024-01-21'); // Sunday
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 0 },
        completedAt
      );
      expect(result!.toISOString().slice(0, 10)).toBe('2024-01-22'); // Monday
    });

    it('returns null when recurrenceWeekday is null', () => {
      const result = computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: null },
        new Date('2024-01-15')
      );
      expect(result).toBeNull();
    });

    it('does not mutate completedAt', () => {
      const completedAt = new Date('2024-01-15');
      const original = completedAt.toISOString();
      computeNextRecurrenceDate(
        { recurrenceType: 'weekly', recurrenceIntervalDays: null, recurrenceWeekday: 3 },
        completedAt
      );
      expect(completedAt.toISOString()).toBe(original);
    });
  });
});
