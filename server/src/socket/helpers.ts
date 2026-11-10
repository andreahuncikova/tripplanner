import { Types } from 'mongoose';
import Group, { GroupDoc, IGroup } from '../models/Group';
import { ts } from '../utils';
import { addSystemMessage, deleteMessages } from '../messages';
import { deleteStays, removeLikes } from '../stays';
import type { ChatMessage, IO, OnlineUser, Session, Sessions, TripState } from '../types';

// Returns the list of users currently connected to a specific group room.
// We filter the global sessions map by the invite code.
function getOnline(sessions: Sessions, code: string): Session[] {
  return Object.values(sessions).filter(s => s.code === code);
}

// What the client sees of the online list: username and colour, once per person,
// even when someone has the trip open in two tabs (two sockets, so two sessions).
function toOnline(list: Session[]): OnlineUser[] {
  const byUser = new Map<string, OnlineUser>();
  for (const s of list) byUser.set(String(s.userId), { username: s.username, color: s.color });
  return [...byUser.values()];
}

// User ids come as ObjectIds from the database and as strings from the token, so they are compared as text
type Id = { toString(): string } | null | undefined;
const sameId = (a: Id, b: Id) => a != null && b != null && String(a) === String(b);
const hasId  = (list: Id[], id: Id) => list.some(x => sameId(x, id));
// The user id from the token is text; lists in the database hold ObjectIds
const objectId = (id: string) => new Types.ObjectId(id);

// Keeps only the ids of people who are members of the trip, each once (e.g. who shares an expense)
function memberIds(g: Pick<IGroup, 'members'>, ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const members = new Set(g.members.map(m => String(m.userId)));
  return [...new Set(ids.map(String))].filter(id => members.has(id));
}

// When someone leaves a trip, their votes and "I'm done" no longer count.
// Expenses stay, because money they paid or owe is still part of the trip.
function removeMemberTraces(g: IGroup, userId: Id) {
  const without = (list: Id[]) => list.filter(x => !sameId(x, userId));
  g.destinations.forEach(d => { d.voterIds = without(d.voterIds) as typeof d.voterIds; });
  g.dateRanges.forEach(r => { r.voterIds = without(r.voterIds) as typeof r.voterIds; });
  g.readyUserIds = without(g.readyUserIds) as typeof g.readyUserIds;
}

// Deletes a trip together with its chat messages and stays
async function deleteTrip(g: GroupDoc) {
  await g.deleteOne();
  await deleteMessages(g._id);
  await deleteStays(g._id);
}

// Takes someone out of a trip and saves it. When the organiser leaves, the next member becomes the organiser;
// the last one out deletes the trip. Used by "Leave trip" in Trip settings and by the old socket event.
// Returns the chat message about it for the others, or null when the trip was deleted.
async function leaveTrip(g: GroupDoc, userId: Id, username: string): Promise<ChatMessage | null> {
  const wasAdmin = sameId(g.adminUserId, userId);
  g.set('members', g.members.filter(m => !sameId(m.userId, userId)));
  removeMemberTraces(g, userId);
  await removeLikes(g._id, userId);
  if (!g.members.length) {
    await deleteTrip(g);
    return null;
  }
  if (wasAdmin) {
    g.adminUserId   = g.members[0].userId;
    g.adminUsername = g.members[0].username;
  }
  await g.save();
  return addSystemMessage(g._id, wasAdmin
    ? `${username} left. ${g.adminUsername} is now the organiser.`
    : `${username} left the trip.`);
}

// Takes sockets out of a trip's room, so they get no more of its messages and cannot send to it:
// one person's sockets after they left, or everyone's (no userId) after the trip was deleted.
function closeRoom(io: IO, sessions: Sessions, code: string, userId?: Id) {
  for (const [socketId, s] of Object.entries(sessions)) {
    if (s.code !== code || (userId != null && !sameId(s.userId, userId))) continue;
    delete sessions[socketId];
    io.in(socketId).socketsLeave(code);
  }
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
    inviteCode:        g.inviteCode,
    name:              g.name,
    phase:             g.phase,
    tripDuration:      g.tripDuration,
    tripWindowStart:   g.tripWindowStart,
    tripWindowEnd:     g.tripWindowEnd,
    destinationKnown:  g.destinationKnown,
    datesKnown:        g.datesKnown,
    currency:          g.currency,
    adminUserId:       g.adminUserId,
    adminUsername:     g.adminUsername,
    members:           g.members,
    destinations:      g.destinations,
    approvedDest:      g.approvedDest,
    availability:      g.availability,
    readyUserIds:      g.readyUserIds,
    dateRanges:        g.dateRanges,
    finalDate:         g.finalDate,
    finalDateLabel:    g.finalDateLabel,
    activities:        g.activities,
    expenses:          g.expenses,
    // Only send username and color for online users, not their full session data
    online:            toOnline(onlineList || []),
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

export { ts, toClient, getOnline, toOnline, serialize, broadcastState, sameId, hasId, objectId, memberIds, removeMemberTraces, leaveTrip, deleteTrip, closeRoom };
