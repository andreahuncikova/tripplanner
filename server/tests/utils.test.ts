import { describe, it, expect } from 'vitest';
import { computeDateRanges, formatTripLabel, snapMonthEnd } from '../src/utils';

describe('snapMonthEnd', () => {
  it('returns the last day of the month', () => {
    expect(snapMonthEnd('2026-06-01')).toBe('2026-06-30');
    expect(snapMonthEnd('2026-12-05')).toBe('2026-12-31');
  });

  it('knows February in normal and leap years', () => {
    expect(snapMonthEnd('2027-02-01')).toBe('2027-02-28');
    expect(snapMonthEnd('2028-02-10')).toBe('2028-02-29');
  });
});

describe('formatTripLabel', () => {
  it('writes a trip inside one month', () => {
    expect(formatTripLabel('2027-05-02', 5)).toBe('2 – 6 May (5 days)');
  });

  it('writes a trip that crosses into the next month', () => {
    expect(formatTripLabel('2027-05-30', 5)).toBe('30 May – 3 June (5 days)');
  });

  it('uses "day" for a one-day trip', () => {
    expect(formatTripLabel('2027-05-02', 1)).toBe('2 – 2 May (1 day)');
  });
});

describe('computeDateRanges', () => {
  it('splits the trip window around the days someone cannot travel', () => {
    const ranges = computeDateRanges(['Anna', 'Ben'], { Ben: ['2027-05-10', '2027-05-11'] }, '2027-05-01', '2027-05-31');
    expect(ranges.map(r => [r.start, r.end])).toEqual([
      ['2027-05-01', '2027-05-09'],
      ['2027-05-12', '2027-05-31'],
    ]);
    expect(ranges[0].label).toBe('1 – 9 May (9 days)');
  });

  it('starts every range with no votes and not selected', () => {
    const [range] = computeDateRanges(['Anna'], {}, '2027-05-01', '2027-05-31');
    expect(range.votes).toEqual([]);
    expect(range.selected).toBe(false);
  });

  it('returns the whole window when nobody is blocked', () => {
    const ranges = computeDateRanges(['Anna'], {}, '2027-05-01', '2027-06-30');
    expect(ranges).toHaveLength(1);
    expect(ranges[0].label).toBe('1 May – 30 June (61 days)');
  });

  it('scans to the real end of the last month, even when the window end is earlier in the month', () => {
    const [range] = computeDateRanges(['Anna'], {}, '2027-06-01', '2027-06-01');
    expect(range.end).toBe('2027-06-30');
  });

  it('ignores days marked by someone who is not a member any more', () => {
    const ranges = computeDateRanges(['Anna'], { Ex: ['2027-05-10'] }, '2027-05-01', '2027-05-31');
    expect(ranges).toHaveLength(1);
  });

  it('without a window, scans only the months where someone marked a day', () => {
    const ranges = computeDateRanges(['Anna'], { Anna: ['2027-06-15'] });
    expect(ranges.map(r => [r.start, r.end])).toEqual([
      ['2027-06-01', '2027-06-14'],
      ['2027-06-16', '2027-06-30'],
    ]);
  });

  it('returns nothing without a window and without marked days', () => {
    expect(computeDateRanges(['Anna'], {})).toEqual([]);
  });

  it('returns at most 8 ranges', () => {
    // Every second day in May is blocked, which would give 16 free ranges
    const everySecondDay = Array.from({ length: 16 }, (_, i) => `2027-05-${String(i * 2 + 2).padStart(2, '0')}`);
    const ranges = computeDateRanges(['Anna'], { Anna: everySecondDay }, '2027-05-01', '2027-05-31');
    expect(ranges).toHaveLength(8);
  });
});
