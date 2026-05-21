const Group = require('../models/Group');
const { ts, serialize, getOnline } = require('./helpers');

module.exports = function register(socket, { io, sessions, username }) {
  socket.on('group:leave', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const isAdm = String(g.adminUserId) === String(s.userId);
      g.members = g.members.filter(m => String(m.userId) !== String(s.userId));
      if (isAdm && g.members.length > 0) {
        // Automatically promote the next member to admin
        g.adminUserId   = g.members[0].userId;
        g.adminUsername = g.members[0].username;
        g.messages.push({ username: 'System', text: `${s.username} left. ${g.adminUsername} is now admin.`, time: ts(), system: true });
      } else if (isAdm) {
        // Admin was the last member — delete the group entirely
        await g.deleteOne();
        socket.emit('group:left');
        return;
      } else {
        g.messages.push({ username: 'System', text: `${s.username} left the group.`, time: ts(), system: true });
      }
      await g.save();
      socket.emit('group:left');
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[group:leave]', e.message); }
  });

  socket.on('group:delete', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(s.userId)) return;
      await g.deleteOne();
      io.to(s.code).emit('group:deleted');
    } catch (e) { console.error('[group:delete]', e.message); }
  });

};
