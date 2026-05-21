const Group = require('../models/Group');
const { serialize, getOnline } = require('./helpers');
const { ACTIVITY_SUGGESTIONS } = require('../config');

module.exports = function register(socket, { io, sessions, userId, username }) {
  socket.on('activity:add', async ({ text, calDate, calTime }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      g.activities.push({ text: text.trim(), addedBy: username, userId, calDate: calDate || null, calTime: calTime || null });
      await g.save();
      io.to(s.code).emit('activity:new', g.activities.at(-1));
    } catch (e) { console.error('[activity:add]', e.message); }
  });

  // Only the person who added it or the admin can edit or remove
  socket.on('activity:edit', async ({ id, text, calDate, calTime }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const act = g.activities.find(a => String(a._id) === String(id));
      if (!act || (String(act.userId) !== String(userId) && String(g.adminUserId) !== String(userId))) return;
      act.text = text; act.calDate = calDate || null; act.calTime = calTime || null;
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[activity:edit]', e.message); }
  });

  socket.on('activity:remove', async actId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const act = g.activities.find(a => String(a._id) === String(actId));
      if (!act || (String(act.userId) !== String(userId) && String(g.adminUserId) !== String(userId))) return;
      g.activities = g.activities.filter(a => String(a._id) !== String(actId));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[activity:remove]', e.message); }
  });

  // Returns pre-written suggestions based on the approved destination.
  // Falls back to generic suggestions if the city isn't in our list.
  socket.on('activity:suggest', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      // .select() loads only the approvedDest field — no need to load the whole document
      const g = await Group.findOne({ inviteCode: s.code }).select('approvedDest');
      if (!g) return;
      const dest = g.approvedDest;
      const suggestions = ACTIVITY_SUGGESTIONS[dest] ||
        ACTIVITY_SUGGESTIONS[Object.keys(ACTIVITY_SUGGESTIONS).find(k => dest?.includes(k))] ||
        ['🗺️ City sightseeing tour', '🍽️ Local food experience', '🏛️ Historic city centre', '📸 Photo walk', '🛍️ Local market'];
      socket.emit('activity:suggestions', { dest, suggestions });
    } catch (e) { console.error('[activity:suggest]', e.message); }
  });
};
