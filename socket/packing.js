const Group = require('../models/Group');

module.exports = function register(socket, { io, sessions, userId, username }) {
  socket.on('pack:add', async text => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'done') return;
      g.packingList.push({ text: text.trim(), addedBy: username });
      await g.save();
      io.to(s.code).emit('pack:new', g.packingList.at(-1));
    } catch (e) { console.error('[pack:add]', e.message); }
  });

  // Toggles the packed state — tracks who checked it off
  socket.on('pack:toggle', async itemId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const item = g.packingList.id(itemId);
      if (!item) return;
      item.packed   = !item.packed;
      item.packedBy = item.packed ? username : null;
      await g.save();
      io.to(s.code).emit('pack:toggled', { id: itemId, packed: item.packed, packedBy: item.packedBy });
    } catch (e) { console.error('[pack:toggle]', e.message); }
  });

  socket.on('pack:remove', async itemId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const item = g.packingList.id(itemId);
      if (!item || (item.addedBy !== username && g.adminUsername !== username)) return;
      item.deleteOne();
      await g.save();
      io.to(s.code).emit('pack:removed', itemId);
    } catch (e) { console.error('[pack:remove]', e.message); }
  });
};
