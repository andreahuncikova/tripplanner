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
export const ChevronDownIcon = () => <svg {...base} width={24} height={24} strokeWidth={2.2}><path d="M6 9l6 6 6-6" /></svg>
export const SendIcon = () => <svg {...base} width={20} height={20}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
// The logo: a TP monogram, the P drawn like a map pin (round head with a dot, tapering into the stem), both letters the same height (also public/logo.svg and the app icons).
// light: a white square with a blue TP, for dark backgrounds such as the landing photo.
export const Logo = ({ light, size = 28 }: { light?: boolean; size?: number }) => {
  const mark = light ? '#485978' : '#fff'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="10" className={light ? 'fill-white' : 'fill-sommet'} />
      <g fill="none" stroke={mark} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.5 9h8M9.5 9v14" />
        <path d="M18 23V9h3a4.75 4.75 0 0 1 4.75 4.75c0 3.2-3.4 5.3-7.75 6.25" />
      </g>
      <circle cx="21.6" cy="13.75" r="1.4" fill={mark} />
    </svg>
  )
}
