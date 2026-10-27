import Group from '../models/Group';
import { ts, serialize, getOnline, broadcastState } from './helpers';
import { snapMonthEnd, computeDateRanges } from '../utils';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // Member updates which days they can't travel
  socket.on('avail:set', async dates => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      // Only save dates that fall inside the trip window — discard anything outside
      const ws       = g.tripWindowStart;
      const we       = g.tripWindowEnd ? snapMonthEnd(g.tripWindowEnd) : null;
      const filtered = (ws && we)
        ? dates.filter(d => d >= ws && d <= we)
        : dates;
      const existing = g.availability.find(a => String(a.userId) === String(userId));
      if (existing) { existing.unavailableDates = filtered; existing.color = color; }
      else g.availability.push({ userId, username, color, unavailableDates: filtered });
      await g.save();
      // Only emit the changed member's data, not the full state
      io.to(s.code).emit('avail:update', { username, color, unavailableDates: filtered });
    } catch (e) { console.error('[avail:set]', (e as Error).message); }
  });

  // Member clicks "I'm done" — adds them to the ready list so admin can see everyone is finished
  socket.on('avail:ready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      if (!g.availabilityReady.includes(username)) g.availabilityReady.push(username);
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[avail:ready]', (e as Error).message); }
  });

  socket.on('avail:unready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      g.availabilityReady = g.availabilityReady.filter(u => u !== username);
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
      if (!g || String(g.adminUserId) !== String(userId) || !['calendar', 'date_vote', 'done'].includes(g.phase)) return;
      // Build a lookup map: { username: ['2026-05-03', ...] }
      const unavailMap: Record<string, string[]> = {};
      g.availability.forEach(a => { if (a.username) unavailMap[a.username] = a.unavailableDates; });
      const memberNames = g.members.flatMap(m => m.username ? [m.username] : []);
      g.set('dateRanges', computeDateRanges(memberNames, unavailMap, g.tripWindowStart, g.tripWindowEnd));
      if (g.phase === 'calendar') g.phase = 'date_vote'; // advance phase on first calculation
      g.messages.push({ username: 'System', text: 'Available dates calculated. Time to vote!', time: ts(), system: true });
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[avail:compute]', (e as Error).message); }
  });

  // Admin sets or updates which months the trip can happen in
  socket.on('trip:setWindow', async ({ start, end }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      if (!start || !end || start >= end) return;
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
