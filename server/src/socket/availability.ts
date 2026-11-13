import Group from '../models/Group';
import { broadcastState, getOnline, serialize, sameId, hasId, objectId } from './helpers';
import { addSystemMessage } from '../messages';
import { snapMonthEnd, computeDateRanges } from '../utils';
import { cleanUnavailableDays } from '../validation';
import type { AppSocket, Ctx } from '../types';

// The steps where members mark the days they cannot travel: marking, and voting on the free windows
// (someone can still change their days then, and the organiser looks for free windows again)
const MARKING = ['calendar', 'date_vote'];

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // Member updates which days they can't travel
  socket.on('avail:set', async dates => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.datesKnown || !MARKING.includes(g.phase)) return;
      // Only real days inside the trip window are saved, each once — anything else is dropped
      const filtered = cleanUnavailableDays(dates, g.tripWindowStart, g.tripWindowEnd ? snapMonthEnd(g.tripWindowEnd) : null);
      const existing = g.availability.find(a => String(a.userId) === String(userId));
      if (existing) { existing.unavailableDates = filtered; existing.color = color; }
      else g.availability.push({ userId, username, color, unavailableDates: filtered });
      await g.save();
      // Only emit the changed member's data, not the full state
      io.to(s.code).emit('avail:update', { userId, username, color, unavailableDates: filtered });
    } catch (e) { console.error('[avail:set]', (e as Error).message); }
  });

  // Member clicks "I'm done" — adds them to the ready list so admin can see everyone is finished
  socket.on('avail:ready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !MARKING.includes(g.phase)) return;
      if (!hasId(g.readyUserIds, userId)) g.readyUserIds.push(objectId(userId));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[avail:ready]', (e as Error).message); }
  });

  socket.on('avail:unready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !MARKING.includes(g.phase)) return;
      g.set('readyUserIds', g.readyUserIds.filter(id => !sameId(id, userId)));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[avail:unready]', (e as Error).message); }
  });

  // Admin triggers the date calculation — finds all windows where nobody is unavailable
  socket.on('avail:compute', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      // A trip whose dates were known from the start has no free windows to compute
      if (!g || !sameId(g.adminUserId, userId) || g.datesKnown || !MARKING.includes(g.phase)) return;
      // Build a lookup map by user id: { '64b0…': ['2026-05-03', ...] }
      const unavailMap: Record<string, string[]> = {};
      g.availability.forEach(a => { if (a.userId) unavailMap[String(a.userId)] = a.unavailableDates; });
      const memberIds = g.members.flatMap(m => m.userId ? [String(m.userId)] : []);
      // Only windows long enough for the trip, when the organiser has chosen its length
      g.set('dateRanges', computeDateRanges(memberIds, unavailMap, g.tripWindowStart, g.tripWindowEnd, g.tripDuration ?? 1));
      if (g.phase === 'calendar') g.phase = 'date_vote'; // advance phase on first calculation
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', await addSystemMessage(g._id, 'Available dates calculated. Time to vote!'));
    } catch (e) { console.error('[avail:compute]', (e as Error).message); }
  });

  // Admin sets or updates which months the trip can happen in
  socket.on('trip:setWindow', async ({ start, end }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !sameId(g.adminUserId, userId) || g.datesKnown || !MARKING.includes(g.phase)) return;
      if (typeof start !== 'string' || typeof end !== 'string' || !start || !end || start >= end) return;
      g.tripWindowStart = start;
      g.tripWindowEnd   = snapMonthEnd(end);
      // Remove any unavailability that now falls outside the new window
      g.availability.forEach(a => {
        a.unavailableDates = a.unavailableDates.filter(d => d >= start && d <= end);
      });
      await g.save();
      await broadcastState(io, sessions, s.code);
    } catch (e) { console.error('[trip:setWindow]', (e as Error).message); }
  });
}
