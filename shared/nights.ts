// Which nights of the trip have a booked stay, used by the bar on the Stays tab.
// A night is named by its evening: the night of 12 June is from 12 to 13 June.
// Days are "YYYY-MM-DD" and counted in UTC, so the time zone cannot move them.

import type { Stay } from './types';

export interface Night {
  day: string
  // The booked stays for this night: none is a gap, two or more means the night is booked twice
  stayIds: string[]
}

export interface NightsCover {
  nights: Night[]
  booked: number          // nights with at least one booked stay
  gaps: DayRange[]        // nights without a booked stay, joined into runs
  doubles: DayRange[]     // nights with more than one booked stay
}

// A run of nights: first and last night, both included
export interface DayRange { first: string; last: string }

export function addDay(day: string, days = 1): string {
  const d = new Date(day + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// The trip is first to last day, so its nights are first … last − 1 (a 6-day trip has 5 nights)
export function nightsCover(trip: { start: string; end: string }, stays: Pick<Stay, '_id' | 'booked' | 'nights'>[]): NightsCover {
  const nights: Night[] = [];
  for (let day = trip.start; day < trip.end; day = addDay(day)) {
    nights.push({
      day,
      stayIds: stays.filter(s => s.booked && s.nights && s.nights.checkIn <= day && day < s.nights.checkOut).map(s => s._id),
    });
  }
  return {
    nights,
    booked: nights.filter(n => n.stayIds.length > 0).length,
    gaps: runs(nights.filter(n => n.stayIds.length === 0).map(n => n.day)),
    doubles: runs(nights.filter(n => n.stayIds.length > 1).map(n => n.day)),
  };
}

// Sorted days joined where they follow each other: 12, 13, 15 → 12–13 and 15
function runs(days: string[]): DayRange[] {
  const out: DayRange[] = [];
  for (const day of days) {
    const last = out[out.length - 1];
    if (last && addDay(last.last) === day) last.last = day;
    else out.push({ first: day, last: day });
  }
  return out;
}
