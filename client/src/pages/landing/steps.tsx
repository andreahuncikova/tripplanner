import type { ReactNode } from 'react'

const icon = (d: ReactNode) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

// The six steps of planning a trip in TripPlanner, in order.
export const steps = [
  { title: 'Create a trip', text: 'Name it and choose your dates.', icon: icon(<path d="M12 5v14M5 12h14" />) },
  { title: 'Invite friends', text: 'Share one link, friends join.', icon: icon(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.5 3.5 5.2" /></>) },
  { title: 'Vote on where to go', text: 'Suggest places and vote.', icon: icon(<><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>) },
  { title: 'Find dates', text: 'Mark busy days, find free ones.', icon: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>) },
  { title: 'Choose a stay', text: 'Paste links, like the best.', icon: icon(<><path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" /></>) },
  { title: 'Plan and split costs', text: 'Plan the days and settle up.', icon: icon(<><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></>) },
]
