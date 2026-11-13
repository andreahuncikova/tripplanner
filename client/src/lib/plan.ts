import type { DateRange, Destination, Member, TripState } from '@shared/types'

// Days are "YYYY-MM-DD" and read at noon local time, so the time zone cannot move them to another day
const pad = (n: number) => String(n).padStart(2, '0')
export const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const fromKey = (key: string) => new Date(key + 'T12:00:00')
export const addDays = (key: string, days: number) => { const d = fromKey(key); d.setDate(d.getDate() + days); return dayKey(d) }
// Both days count: 10 – 24 March is 15 days
export const daysIn = (start: string, end: string) => Math.round((fromKey(end).getTime() - fromKey(start).getTime()) / 86_400_000) + 1

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' })
const longDay = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
export const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

// "10 – 24 March" or "28 March – 2 April"
export function rangeText(start: string, end: string) {
  const s = fromKey(start), e = fromKey(end)
  return s.getMonth() === e.getMonth() ? `${s.getDate()} – ${dayMonth.format(e)}` : `${dayMonth.format(s)} – ${dayMonth.format(e)}`
}
// "Wednesday 10 March", for screen readers on the calendar
export const dayLabel = (key: string) => longDay.format(fromKey(key))

export const votesText = (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`
// "Leo", "Leo and Ema", "Leo, Ema and Sara"
export function names(people: Pick<Member, 'username'>[]) {
  const list = people.map(p => p.username)
  return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`
}

// The months of the trip window, as "YYYY-MM"
export function windowMonths(start: string, end: string): string[] {
  const months: string[] = []
  const d = fromKey(start.slice(0, 7) + '-01')
  while (dayKey(d).slice(0, 7) <= end.slice(0, 7)) {
    months.push(dayKey(d).slice(0, 7))
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

// One month as calendar cells, Monday first. null is an empty cell before the 1st.
export function monthGrid(month: string): (string | null)[] {
  const first = fromKey(month + '-01')
  const blanks = (first.getDay() + 6) % 7
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  return [...Array<null>(blanks).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)]
}

// The destination the organiser is asked to confirm: the most votes. A tie goes to the one the organiser
// voted for, then to the one suggested first. None while nobody has voted.
export function leadingDestination(destinations: Destination[], adminUserId: string): Destination | null {
  let best: Destination | null = null
  for (const d of destinations) {
    if (!d.voterIds.length) continue
    const more = !best || d.voterIds.length > best.voterIds.length
    const tieForAdmin = best && d.voterIds.length === best.voterIds.length && d.voterIds.includes(adminUserId) && !best.voterIds.includes(adminUserId)
    if (more || tieForAdmin) best = d
  }
  return best
}

// A free window is too short when the organiser has chosen a longer trip
export const fits = (r: DateRange, tripDays: number | null) => !tripDays || daysIn(r.start, r.end) >= tripDays

// The free window with the most votes among the long enough ones, as an index into dateRanges; -1 while nobody has voted
export function leadingRange(ranges: DateRange[], tripDays: number | null): number {
  let best = -1
  ranges.forEach((r, i) => {
    if (fits(r, tripDays) && r.voterIds.length && (best < 0 || r.voterIds.length > ranges[best].voterIds.length)) best = i
  })
  return best
}

// What "Go back a step" does, for the organiser's question. Steps the group skipped when the trip was created
// are skipped going back too (as on the server), so some steps have nothing to go back to.
export function backStep(t: Pick<TripState, 'phase' | 'datesKnown' | 'destinationKnown'>): { title: string; text: string } | null {
  if (t.phase === 'calendar' && !t.destinationKnown)
    return { title: 'Back to the destination poll?', text: 'The group chooses the destination again, and the days everyone marked are deleted.' }
  if (t.phase === 'date_vote')
    return { title: 'Back to marking days?', text: 'The free dates and their votes are deleted. The days everyone marked stay.' }
  if (t.phase === 'done' && !t.datesKnown)
    return { title: 'Back to voting on dates?', text: 'The confirmed dates are removed, and the activities in the itinerary are deleted.' }
  if (t.phase === 'done' && !t.destinationKnown)
    return { title: 'Back to the destination poll?', text: 'The destination is removed, and the activities in the itinerary are deleted.' }
  return null
}
