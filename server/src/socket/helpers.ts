import Group, { IGroup } from '../models/Group';
import { ts } from '../utils';
import type { IO, Session, Sessions, TripState } from '../types';

// Returns the list of users currently connected to a specific group room.
// We filter the global sessions map by the invite code.
function getOnline(sessions: Sessions, code: string): Session[] {
  return Object.values(sessions).filter(s => s.code === code);
}

// Socket.IO turns every Mongoose document into JSON before it sends it, so ObjectIds and dates
// arrive at the client as strings. shared/types.ts describes that JSON.
// Our schemas still allow empty fields, so TypeScript cannot prove that a document matches the shared type.
// This is the one place where we tell it that it does.
function toClient<T>(doc: unknown): T {
  return doc as T;
}

// Converts a full MongoDB group document into a safe object we can send to clients.
// We pick only the fields the frontend needs — we never expose internal DB fields
// like _id, __v, or raw MongoDB ObjectIds.
function serialize(g: IGroup, onlineList?: Session[]): TripState {
  return toClient<TripState>({
    name:              g.name,
    phase:             g.phase,
    tripDuration:      g.tripDuration,
    tripWindowStart:   g.tripWindowStart,
    tripWindowEnd:     g.tripWindowEnd,
    adminUsername:     g.adminUsername,
    members:           g.members,
    destinations:      g.destinations,
    approvedDest:      g.approvedDest,
    availability:      g.availability,
    availabilityReady: g.availabilityReady,
    dateRanges:        g.dateRanges,
    finalDate:         g.finalDate,
    finalDateLabel:    g.finalDateLabel,
    activities:        g.activities,
    expenses:          g.expenses,
    // Only send username and color for online users, not their full session data
    online:            (onlineList || []).map(s => ({ username: s.username, color: s.color })),
  });
}

// Fetches the latest group data from the database and sends it to everyone
// in that group's room. We use .lean() to get a plain JS object instead of
// a Mongoose document, which is faster and enough for serialization.
async function broadcastState(io: IO, sessions: Sessions, code: string) {
  const g = await Group.findOne({ inviteCode: code }).lean();
  if (!g) return;
  io.to(code).emit('state', serialize(g, getOnline(sessions, code)));
}

export { ts, toClient, getOnline, serialize, broadcastState };
