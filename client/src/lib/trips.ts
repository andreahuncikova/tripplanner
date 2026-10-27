import type { Phase, TripSummary } from '@shared/types'

// How each planning phase is shown on the trip cards, and how far the trip is (step 1–4)
export const phases: Record<Phase, { label: string; now: string; step: number }> = {
  destinations: { label: 'Choosing destination', now: 'Now choosing the destination', step: 1 },
  calendar:     { label: 'Marking free days',    now: 'Now marking free days',        step: 2 },
  date_vote:    { label: 'Voting on dates',      now: 'Now voting on dates',          step: 3 },
  done:         { label: 'Ready to go',          now: 'Dates are confirmed',          step: 4 },
}
export const STEPS = 4

export const people = (n: number) => `${n} ${n === 1 ? 'person' : 'people'}`

// "YYYY-MM-DD" read at noon local time, so the time zone cannot move it to another day
const toDate = (key: string) => new Date(key + 'T12:00:00')
const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' })
const month = new Intl.DateTimeFormat('en-GB', { month: 'short' })

// The dates on a trip card: the confirmed dates, the months the trip could happen in, or "Dates not set"
export function tripDates(t: Pick<TripSummary, 'finalDateLabel' | 'tripWindowStart' | 'tripWindowEnd'>): string {
  if (t.finalDateLabel) return t.finalDateLabel
  if (t.tripWindowStart && t.tripWindowEnd) {
    const s = toDate(t.tripWindowStart)
    const e = toDate(t.tripWindowEnd)
    if (s.getFullYear() !== e.getFullYear()) return `${monthYear.format(s)} – ${monthYear.format(e)}`
    if (s.getMonth() !== e.getMonth()) return `${month.format(s)} – ${monthYear.format(e)}`
    return monthYear.format(s)
  }
  return 'Dates not set'
}

// "In 75 days", "Tomorrow", "Today", "On the trip now" or "Trip is over", for trips with confirmed dates
export function countdown(t: Pick<TripSummary, 'finalDate' | 'tripDuration'>, today = new Date()): string | null {
  if (!t.finalDate) return null
  const noon = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
  const days = Math.round((toDate(t.finalDate).getTime() - noon.getTime()) / 86_400_000)
  if (days > 1) return `In ${days} days`
  if (days === 1) return 'Tomorrow'
  if (days === 0) return 'Today'
  return -days < (t.tripDuration ?? 1) ? 'On the trip now' : 'Trip is over'
}

// Invite codes are 8 capital letters and numbers. A pasted invite link ("…?code=A3BF92C1") works too.
export function cleanCode(value: string): string {
  const fromLink = value.match(/code=([A-Za-z0-9]{8})/)
  return (fromLink ? fromLink[1] : value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}
