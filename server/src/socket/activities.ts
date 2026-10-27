import Group from '../models/Group';
import { serialize, getOnline } from './helpers';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username }: Ctx) {
  socket.on('activity:add', async ({ text, calDate, calTime }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      g.activities.push({ text: text.trim(), addedBy: username, userId, calDate: calDate || null, calTime: calTime || null });
      await g.save();
      io.to(s.code).emit('activity:new', g.activities.at(-1));
    } catch (e) { console.error('[activity:add]', (e as Error).message); }
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
    } catch (e) { console.error('[activity:edit]', (e as Error).message); }
  });

  socket.on('activity:remove', async actId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const act = g.activities.find(a => String(a._id) === String(actId));
      if (!act || (String(act.userId) !== String(userId) && String(g.adminUserId) !== String(userId))) return;
      act.deleteOne();
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[activity:remove]', (e as Error).message); }
  });

}
