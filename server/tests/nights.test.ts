import { describe, it, expect } from 'vitest';
import { addDay, nightsCover } from '../../shared/nights';

// A 6-day trip, 10 – 15 June: the nights of 10, 11, 12, 13 and 14 June
const trip = { start: '2027-06-10', end: '2027-06-15' };
const stay = (id: string, checkIn: string, checkOut: string, booked = true) => ({ _id: id, booked, nights: { checkIn, checkOut } });

describe('nightsCover', () => {
  it('finds every night of the trip as a gap when nothing is booked', () => {
    const c = nightsCover(trip, []);
    expect(c.nights.map(n => n.day)).toEqual(['2027-06-10', '2027-06-11', '2027-06-12', '2027-06-13', '2027-06-14']);
    expect(c.booked).toBe(0);
    expect(c.gaps).toEqual([{ first: '2027-06-10', last: '2027-06-14' }]);
  });

  it('counts the check-in night but not the check-out day', () => {
    const c = nightsCover(trip, [stay('a', '2027-06-10', '2027-06-12'), stay('b', '2027-06-13', '2027-06-15')]);
    expect(c.booked).toBe(4);
    expect(c.gaps).toEqual([{ first: '2027-06-12', last: '2027-06-12' }]);
    expect(c.doubles).toEqual([]);
  });

  it('leaves out stays that are not booked or have no nights', () => {
    const c = nightsCover(trip, [stay('a', '2027-06-10', '2027-06-15', false), { _id: 'b', booked: true }]);
    expect(c.booked).toBe(0);
  });

  it('finds nights booked twice', () => {
    const c = nightsCover(trip, [stay('a', '2027-06-10', '2027-06-13'), stay('b', '2027-06-12', '2027-06-15')]);
    expect(c.booked).toBe(5);
    expect(c.gaps).toEqual([]);
    expect(c.doubles).toEqual([{ first: '2027-06-12', last: '2027-06-12' }]);
    expect(c.nights[2].stayIds).toEqual(['a', 'b']);
  });

  it('joins gaps that follow each other, across a month end', () => {
    const c = nightsCover({ start: '2027-06-28', end: '2027-07-04' }, [stay('a', '2027-07-01', '2027-07-02')]);
    expect(c.gaps).toEqual([{ first: '2027-06-28', last: '2027-06-30' }, { first: '2027-07-02', last: '2027-07-03' }]);
  });
});

describe('addDay', () => {
  it('moves across months and leap days', () => {
    expect(addDay('2028-02-28')).toBe('2028-02-29');
    expect(addDay('2027-12-31')).toBe('2028-01-01');
    expect(addDay('2027-06-15', -5)).toBe('2027-06-10');
  });
});
