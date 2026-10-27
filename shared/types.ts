// Types shared by the client and the server: the data they send each other and every socket event.
// Written from the current server (models/Group.js and socket/*.js); extend it whenever an event or field changes.
// Ids and dates arrive as strings, because everything is sent as JSON.

// ── Data ──────────────────────────────────────────────

// The user as the server sends it (User.toSafe()).
export interface User {
  _id: string
  email: string
  username: string
  color: string
}

// Someone with the trip open right now.
export interface OnlineUser {
  username: string
  color: string
}

export interface Member {
  userId: string
  username: string
  color: string
  joinedAt: string
}

export interface ChatMessage {
  userId?: string
  username?: string
  color?: string
  text: string
  time: string
  // Messages from the server itself, e.g. "Bali was chosen".
  system?: boolean
}

export interface Destination {
  _id: string
  name: string
  by: string
  // Usernames of the people who voted for it.
  votes: string[]
}

export interface Availability {
  userId: string
  username: string
  color: string
  // Days this person cannot travel, as "YYYY-MM-DD".
  unavailableDates: string[]
}

// A free window computed from everyone's availability, which the group then votes on.
export interface DateRange {
  label: string
  start: string
  end: string
  votes: string[]
  selected: boolean
}

export interface Activity {
  _id: string
  text: string
  addedBy: string
  userId: string
  // Optional place on the trip calendar.
  calDate?: string
  calTime?: string
  createdAt: string
}

export interface Expense {
  _id: string
  description: string
  amount: number
  currency: string
  paidBy: string
  paidByColor: string
  splitAmong: string[]
  addedBy: string
  createdAt: string
}

// The order a trip moves through.
export type Phase = 'destinations' | 'calendar' | 'date_vote' | 'done'

// The whole trip as the server sends it in 'state' (serialize() in socket/helpers.js).
export interface TripState {
  name: string
  phase: Phase
  tripDuration: number | null
  tripWindowStart: string | null
  tripWindowEnd: string | null
  adminUsername: string
  members: Member[]
  destinations: Destination[]
  approvedDest: string | null
  availability: Availability[]
  availabilityReady: string[]
  dateRanges: DateRange[]
  finalDate: string | null
  finalDateLabel: string | null
  activities: Activity[]
  expenses: Expense[]
  online: OnlineUser[]
}

// ── Socket events ─────────────────────────────────────
// Used as Socket<ServerToClientEvents, ClientToServerEvents> on the client
// and Server<ClientToServerEvents, ServerToClientEvents> on the server.

export interface ActivityInput {
  text: string
  calDate?: string
  calTime?: string
}

export interface ExpenseInput {
  description: string
  amount: number
  currency: string
  paidBy: string
  splitAmong: string[]
}

// What the client sends.
export interface ClientToServerEvents {
  join: (data: { code: string }) => void

  msg: (text: string) => void
  typing: () => void

  'dest:suggest': (name: string) => void
  'dest:vote': (destId: string) => void
  'dest:approve': (destId: string) => void
  'dest:edit': (data: { id: string; name: string }) => void
  'dest:remove': (destId: string) => void

  'trip:setWindow': (data: { start: string; end: string }) => void
  'avail:set': (dates: string[]) => void
  'avail:ready': () => void
  'avail:unready': () => void
  'avail:compute': () => void

  'trip:setDuration': (days: number) => void
  'range:vote': (index: number) => void
  'range:confirm': (data: { idx: number; start?: string }) => void
  'phase:back': () => void

  'activity:add': (data: ActivityInput) => void
  'activity:edit': (data: ActivityInput & { id: string }) => void
  'activity:remove': (activityId: string) => void

  'expense:add': (data: ExpenseInput) => void
  'expense:edit': (data: ExpenseInput & { id: string }) => void
  'expense:remove': (expenseId: string) => void

  'group:leave': () => void
  'group:delete': () => void
}

// What the server sends.
export interface ServerToClientEvents {
  // Answer to 'join': the whole trip plus the last 60 messages.
  joined: (data: TripState & { messages: ChatMessage[] }) => void
  // The whole trip again, after most changes.
  state: (data: TripState) => void
  err: (message: string) => void

  online: (users: OnlineUser[]) => void
  msg: (message: ChatMessage) => void
  typing: (username: string) => void

  // Smaller updates sent instead of the whole state.
  'dest:new': (destination: Destination) => void
  'avail:update': (data: Pick<Availability, 'username' | 'color' | 'unavailableDates'>) => void
  'range:votes': (ranges: DateRange[]) => void
  'activity:new': (activity: Activity) => void
  'expense:new': (expense: Expense) => void
  'expense:removed': (expenseId: string) => void

  'group:left': () => void
  'group:deleted': () => void
}

// ── REST ──────────────────────────────────────────────

// One trip in GET /api/groups (the dashboard and the sidebar).
export interface TripSummary {
  _id: string
  name: string
  inviteCode: string
  phase: Phase
  members: Member[]
  createdAt: string
  tripDuration: number | null
  adminUsername: string
  tripWindowStart: string | null
  tripWindowEnd: string | null
  // Set when the trip dates are confirmed: "YYYY-MM-DD" and a label like "3 – 12 April (10 days)"
  finalDate: string | null
  finalDateLabel: string | null
}

// GET /api/groups/:code, public, also used for the invite preview.
export interface TripPreview {
  name: string
  inviteCode: string
  phase: Phase
  memberCount: number
  // Who organises the trip and when it is, shown before someone joins with the code
  adminUsername: string
  finalDateLabel: string | null
}
