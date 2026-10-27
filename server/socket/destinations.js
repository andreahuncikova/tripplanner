const Group = require('../models/Group');
const { ts, serialize, getOnline, broadcastState } = require('./helpers');

module.exports = function register(socket, { io, sessions, userId, username }) {
  // Any member can suggest a new destination
  socket.on('dest:suggest', async name => {
    try {
      const s = sessions[socket.id];
      if (!s || !name?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      g.destinations.push({ name: name.trim(), by: username, votes: [] });
      await g.save();
      // Only emit the new destination instead of the full state — more efficient
      io.to(s.code).emit('dest:new', g.destinations.at(-1));
    } catch (e) { console.error('[dest:suggest]', e.message); }
  });

  socket.on('dest:vote', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const d = g.destinations.id(destId);
      if (!d) return;
      const alreadyVoted = d.votes.includes(username);
      // Remove the user's vote from all destinations first (only one vote allowed at a time)
      g.destinations.forEach(x => { x.votes = x.votes.filter(u => u !== username); });
      // If they hadn't voted for this one yet, add the vote; otherwise it's a toggle-off
      if (!alreadyVoted) d.votes.push(username);
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:vote]', e.message); }
  });

  // Only admin can approve — this also advances the group to the calendar phase
  socket.on('dest:approve', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      const d = g.destinations.id(destId);
      if (!d) return;
      g.approvedDest = d.name;
      if (g.phase === 'destinations') g.phase = 'calendar';
      g.messages.push({ username: 'System', text: `Destination approved: ${d.name}.`, time: ts(), system: true });
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[dest:approve]', e.message); }
  });

  // Only the person who suggested it or the admin can edit/remove
  socket.on('dest:edit', async ({ id, name }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !name?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const dest = g.destinations.find(d => String(d._id) === String(id));
      if (!dest || (dest.by !== username && String(g.adminUserId) !== String(userId))) return;
      dest.name = name.trim();
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:edit]', e.message); }
  });

  socket.on('dest:remove', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const dest = g.destinations.find(d => String(d._id) === String(destId));
      if (!dest || (dest.by !== username && String(g.adminUserId) !== String(userId))) return;
      g.destinations = g.destinations.filter(d => String(d._id) !== String(destId));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:remove]', e.message); }
  });
};
