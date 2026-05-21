const Group = require('../models/Group');
const { ts, broadcastState } = require('./helpers');
const { formatTripLabel } = require('../utils');

module.exports = function register(socket, { io, sessions, userId, username }) {
  // Admin sets how many days the trip will last — this filters the date windows shown
  socket.on('trip:setDuration', async dur => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['date_vote', 'done'].includes(g.phase)) return;
      g.tripDuration = Math.max(1, parseInt(dur) || 1);
      await g.save();
      await broadcastState(io, sessions, s.code);
    } catch (e) { console.error('[trip:setDuration]', e.message); }
  });

  socket.on('range:vote', async idx => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !['date_vote', 'done'].includes(g.phase)) return;
      const alreadyVoted = g.dateRanges[idx]?.votes.includes(username);
      // Clear the user's previous vote across all ranges — one vote at a time
      g.dateRanges.forEach(r => { r.votes = r.votes.filter(u => u !== username); });
      if (!alreadyVoted && g.dateRanges[idx]) g.dateRanges[idx].votes.push(username);
      await g.save();
      io.to(s.code).emit('range:votes', g.dateRanges);
    } catch (e) { console.error('[range:vote]', e.message); }
  });

  // Admin confirms the final trip date — moves the group to the done phase
  socket.on('range:confirm', async ({ idx, start }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['date_vote', 'done'].includes(g.phase)) return;
      const r = g.dateRanges[idx];
      if (!r) return;
      const chosenStart = start || r.start;
      const label = g.tripDuration ? formatTripLabel(chosenStart, g.tripDuration) : r.label;
      g.dateRanges.forEach((x, i) => { x.selected = i === idx; });
      g.finalDate      = chosenStart;
      g.finalDateLabel = label;
      g.phase          = 'done';
      g.messages.push({ username: 'System', text: `Trip confirmed: ${label}! Start adding activities.`, time: ts(), system: true });
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[range:confirm]', e.message); }
  });

  // Admin moves the whole group back one phase — each step also clears the data from that phase
  socket.on('phase:back', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      let msg = '';
      if (g.phase === 'done') {
        g.phase = 'date_vote'; g.finalDate = null; g.finalDateLabel = null;
        g.activities = []; g.dateRanges.forEach(r => { r.selected = false; });
        msg = 'Trip unconfirmed — back to date voting.';
      } else if (g.phase === 'date_vote') {
        g.phase = 'calendar'; g.dateRanges = [];
        msg = 'Back to availability calendar.';
      } else if (g.phase === 'calendar') {
        g.phase = 'destinations'; g.availability = [];
        msg = 'Back to destination selection.';
      } else { return; }
      g.messages.push({ username: 'System', text: msg, time: ts(), system: true });
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[phase:back]', e.message); }
  });
};
