import type { Stay, StayNights, StayPlatform } from '@shared/types'
import { daysIn, fromKey } from '../../lib/plan'
import { API_URL } from '../../lib/api'

// How a stay link is shown, in the Stays tab and in the chat's link cards

const PLATFORM: Record<StayPlatform, string> = {
  booking: 'Booking.com', airbnb: 'Airbnb', vrbo: 'Vrbo', hostelworld: 'Hostelworld',
  expedia: 'Expedia', agoda: 'Agoda', other: '',
}

// "Booking.com", or the site's own address for other links, e.g. "smallhotel.pt"
export function platformName(stay: Pick<Stay, 'platform' | 'url'>) {
  if (PLATFORM[stay.platform]) return PLATFORM[stay.platform]
  try { return new URL(stay.url).hostname.replace(/^www\./, '') } catch { return 'Link' }
}

export function formatPrice(p: NonNullable<Stay['price']>) {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: p.currency, maximumFractionDigits: 0 }).format(p.amount) }
  catch { return `${p.amount} ${p.currency}` }
}

// Photos from Google Maps come from our own server (/api/places/…), which is on Render, not on Vercel
export function imageSrc(image: string) {
  return image.startsWith('/') ? API_URL + image : image
}

// Check-in to check-out: 17 – 20 June is 3 nights
export const nightCount = (n: StayNights) => daysIn(n.checkIn, n.checkOut) - 1
export const nightsWord = (count: number) => `${count} ${count === 1 ? 'night' : 'nights'}`

const shortDay = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
// "17 – 20 Jun" or "29 Jun – 2 Jul"
export function nightsRange(n: StayNights) {
  const a = fromKey(n.checkIn), b = fromKey(n.checkOut)
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${shortDay.format(b)}` : `${shortDay.format(a)} – ${shortDay.format(b)}`
}

// The price of a stay is per night, so the whole stay costs price × nights
export function stayTotal(price: NonNullable<Stay['price']>, n: StayNights) {
  return { amount: price.amount * nightCount(n), currency: price.currency }
}
