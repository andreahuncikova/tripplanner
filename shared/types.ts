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
  _id?: string
  // Messages from the server itself, e.g. "Bali was chosen".
  system?: boolean
  // Filled in by the server a moment after a message with a link was sent ('msg:preview')
  preview?: LinkPreview
}

// People are identified by user id, because two members can have the same name.
// Names and colours for the screen come from TripState.members (find the member with that userId).

export interface Destination {
  _id: string
  name: string
  // Name of who suggested it, for display; byUserId is who it really is (may edit or remove it).
  by: string
  byUserId: string
  // User ids of the members who voted for it.
  voterIds: string[]
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
  // User ids of the members who voted for this window.
  voterIds: string[]
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
  // User ids: who paid, who shares the cost, and who added it (may edit or remove it).
  paidByUserId: string
  splitAmongUserIds: string[]
  addedByUserId: string
  createdAt: string
}

// The order a trip moves through.
export type Phase = 'destinations' | 'calendar' | 'date_vote' | 'done'

// The whole trip as the server sends it in 'state' (serialize() in socket/helpers.js).
export interface TripState {
  // Which trip this is, so a screen can ignore an update meant for a trip it just closed
  inviteCode: string
  name: string
  phase: Phase
  tripDuration: number | null
  tripWindowStart: string | null
  tripWindowEnd: string | null
  // Chosen when the trip was created: a known destination skips the destination poll,
  // known dates skip availability and the date vote.
  destinationKnown: boolean
  datesKnown: boolean
  // The group's currency for the budget, e.g. "EUR"
  currency: string
  adminUserId: string
  adminUsername: string
  members: Member[]
  destinations: Destination[]
  approvedDest: string | null
  availability: Availability[]
  // User ids of the members who said they are done marking days.
  readyUserIds: string[]
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
  // User ids of members of the trip. An empty split means the whole group.
  paidByUserId: string
  splitAmongUserIds: string[]
}

// What the client sends.
export interface ClientToServerEvents {
  // Opening a trip screen. Only members get in; anyone else gets 'err'.
  join: (data: { code: string }) => void
  // Leaving the trip screen: stops its messages and takes the user off its online list.
  'trip:close': () => void

  msg: (text: string) => void
  // Sent while the user types; the client sends it at most every few seconds.
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

  // Stays tab. The server answers stay:add when the stay is saved, or with the reason it was not.
  'stay:add': (data: { url: string; areaId: string | null }, done: (result: { ok: true } | { error: string }) => void) => void
  'stay:like': (stayId: string) => void
  'stay:move': (data: { id: string; areaId: string | null }) => void
  'stay:remove': (stayId: string) => void
  'area:add': (name: string, done: (result: { ok: true; id: string } | { error: string }) => void) => void
  'area:rename': (data: { id: string; name: string }) => void

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

  // Everyone with the trip open, once per person even with several tabs.
  online: (users: OnlineUser[]) => void
  msg: (message: ChatMessage) => void
  // The link preview of a message that was just sent, once the server has read the page
  'msg:preview': (data: { id: string; preview: LinkPreview }) => void
  // Someone else is typing; the client hides it again after a few seconds without a new one.
  typing: (username: string) => void

  // Smaller updates sent instead of the whole state.
  'dest:new': (destination: Destination) => void
  'avail:update': (data: Pick<Availability, 'userId' | 'username' | 'color' | 'unavailableDates'>) => void
  'range:votes': (ranges: DateRange[]) => void
  'activity:new': (activity: Activity) => void
  'expense:new': (expense: Expense) => void
  'expense:removed': (expenseId: string) => void

  // All stays and areas of the trip, after joining and after every change to them
  stays: (data: StaysState) => void

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
  // The organiser: may change the trip in Trip settings and delete it
  adminUserId: string
  adminUsername: string
  tripWindowStart: string | null
  tripWindowEnd: string | null
  // Set when the trip dates are confirmed: "YYYY-MM-DD" and a label like "3 – 12 April (10 days)"
  finalDate: string | null
  finalDateLabel: string | null
  currency: string
  approvedDest: string | null
  // The dates were entered when the trip was created, so the organiser can change them in Trip settings
  datesKnown: boolean
  // How many stays the trip has saved; only in the list (GET /api/groups), for the planning steps on the cards
  stayCount?: number
}

// PATCH /api/groups/:code, Trip settings (organiser only). Only the fields that are sent change.
export interface TripChangesInput {
  name?: string
  currency?: string
  // Only for trips whose dates were known when they were created
  dates?: { start: string; end: string }
}

// POST /api/groups, the "New trip" screen. Answer: { inviteCode }.
export interface NewTripInput {
  name: string
  // Empty: the group suggests places and votes
  destination?: string
  dates:
    | { mode: 'known'; start: string; end: string }          // "YYYY-MM-DD", first and last day
    | { mode: 'find'; fromMonth: string; toMonth: string }   // "YYYY-MM", the months the trip could happen in
  currency: string
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

// Where a saved stay link comes from, read from its address
export type StayPlatform = 'booking' | 'airbnb' | 'vrbo' | 'hostelworld' | 'expedia' | 'agoda' | 'other'

// Answer of POST /api/preview: what the server could read from a stay link.
// Booking and Airbnb often show servers a bot check instead of the page, so any field can be missing;
// complete is false then and the client offers the form to fill in the details by hand.
export interface LinkPreview {
  url: string                 // the link after redirects
  platform: StayPlatform
  title?: string
  image?: string              // the main photo: an absolute https address, the same as images[0]
  images?: string[]           // every photo found, at most 6, for the photo browser on the stay card
  price?: { amount: number; currency: string }
  location?: string           // e.g. "Lisbon, Portugal"
  // When the photos come from Google Maps instead of the page: they are then our own /api/places/… addresses,
  // placeId is the Google place, and imageCredits[i] must be shown with images[i]
  placeId?: string
  imageCredits?: string[]
  complete: boolean           // title, photo, price and location were all found
}

// ── Stays ─────────────────────────────────────────────

// A part of the destination the group may stay in, e.g. Ubud or Uluwatu in Bali
export interface Area {
  _id: string
  name: string
}

// One saved stay link. The details come from the link preview (LinkPreview), so any of them can be missing.
export interface Stay {
  _id: string
  areaId: string | null       // null: not in an area yet
  url: string
  platform: StayPlatform
  title?: string
  image?: string
  images?: string[]           // see LinkPreview
  price?: { amount: number; currency: string }
  location?: string
  placeId?: string            // the photos are from Google Maps (see LinkPreview)
  imageCredits?: string[]
  complete: boolean           // the preview found title, photo, price and location
  addedByUserId: string       // may remove it, as may the organiser
  likeUserIds: string[]       // members who like it
  createdAt: string
}

export interface StaysState {
  areas: Area[]
  stays: Stay[]               // newest first
}
