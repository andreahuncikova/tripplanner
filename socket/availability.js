const Group = require('../models/Group');
const { ts, serialize, getOnline, broadcastState } = require('./helpers');
const { snapMonthEnd, computeDateRanges } = require('../utils');

module.exports = function register(socket, { io, sessions, userId, username, color }) {
  // Member updates which days they can't travel
  socket.on('avail:set', async dates => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      // Only save dates that fall inside the trip window — discard anything outside
      const weSnapped = snapMonthEnd(g.tripWindowEnd);
      const filtered  = (g.tripWindowStart && weSnapped)
        ? dates.filter(d => d >= g.tripWindowStart && d <= weSnapped)
        : dates;
      const existing = g.availability.find(a => String(a.userId) === String(userId));
      if (existing) { existing.unavailableDates = filtered; existing.color = color; }
      else g.availability.push({ userId, username, color, unavailableDates: filtered });
      await g.save();
      // Only emit the changed member's data, not the full state
      io.to(s.code).emit('avail:update', { username, color, unavailableDates: filtered });
    } catch (e) { console.error('[avail:set]', e.message); }
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
    } catch (e) { console.error('[avail:ready]', e.message); }
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
    } catch (e) { console.error('[avail:unready]', e.message); }
  });

  // Admin triggers the date calculation — finds all windows where nobody is unavailable
  socket.on('avail:compute', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['calendar', 'date_vote', 'done'].includes(g.phase)) return;
      // Build a lookup map: { username: ['2026-05-03', ...] }
      const unavailMap = {};
      g.availability.forEach(a => { unavailMap[a.username] = a.unavailableDates; });
      g.dateRanges = computeDateRanges(g.members.map(m => m.username), unavailMap, g.tripWindowStart, g.tripWindowEnd);
      if (g.phase === 'calendar') g.phase = 'date_vote'; // advance phase on first calculation
      g.messages.push({ username: 'System', text: 'Available dates calculated. Time to vote!', time: ts(), system: true });
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[avail:compute]', e.message); }
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
    } catch (e) { console.error('[trip:setWindow]', e.message); }
  });
};
