// Line icons from the mockups (24×24, drawn with the current text colour).
const base = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const

export const PlanIcon = () => <svg {...base}><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9" /></svg>
export const StaysIcon = () => <svg {...base}><path d="M3 21V10l9-6 9 6v11" /><path d="M9 21v-6h6v6" /></svg>
export const ItineraryIcon = () => <svg {...base}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
export const BudgetIcon = () => <svg {...base}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
export const ChatIcon = () => <svg {...base}><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.5A8 8 0 1 1 21 12z" /></svg>
export const BackIcon = () => <svg {...base} width={24} height={24}><path d="M15 18l-6-6 6-6" /></svg>
export const MoreIcon = () => <svg {...base}><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
export const AllTripsIcon = () => <svg {...base} width={18} height={18}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>
export const CloseIcon = () => <svg {...base} width={20} height={20}><path d="M6 6l12 12M18 6L6 18" /></svg>
export const Logo = () => (
  <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="10" className="fill-sommet" />
    <path d="M9 20l14-8-5 12-2-5z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)
