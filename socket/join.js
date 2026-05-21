const Group = require('../models/Group');
const { serialize, getOnline } = require('./helpers');

module.exports = function register(socket, { io, sessions, userId, username, color }) {
  socket.on('join', async ({ code }) => {
    try {
      const inviteCode = code.toUpperCase();
      const g = await Group.findOne({ inviteCode });
      if (!g) { socket.emit('err', 'Group not found'); return; }

      // Auto-join: if this user isn't in the members list yet, add them
      if (!g.members.find(m => String(m.userId) === String(userId))) {
        g.members.push({ userId, username, color });
        await g.save();
      }

      // Store the session so we can find this user's socket later (e.g. to approve back-requests)
      sessions[socket.id] = { userId, username, color, code: inviteCode };
      // Join the Socket.io room so broadcasts to this group reach this socket
      socket.join(inviteCode);

      // Send the full group state + last 60 messages to the joining client
      socket.emit('joined', {
        ...serialize(g, getOnline(sessions, inviteCode)),
        messages: g.messages.slice(-60),
      });

      // Tell everyone else in the room that someone new joined
      io.to(inviteCode).emit('online', getOnline(sessions, inviteCode).map(s => ({ username: s.username, color: s.color })));
    } catch (e) { console.error('[join]', e.message); }
  });

  socket.on('disconnect', () => {
    const s = sessions[socket.id];
    if (s) {
      // Clean up the session and update the online list for the room
      delete sessions[socket.id];
      io.to(s.code).emit('online', getOnline(sessions, s.code).map(x => ({ username: x.username, color: x.color })));
    }
  });
};
