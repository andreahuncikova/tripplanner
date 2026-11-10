import type { Stay, StayPlatform } from '@shared/types'
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
