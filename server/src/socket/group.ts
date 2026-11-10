import Group from '../models/Group';
import { serialize, getOnline, toClient, sameId, leaveTrip, closeRoom } from './helpers';
import type { AppSocket, Ctx } from '../types';

// Leaving and deleting a trip over the socket (the old app). The new client uses the REST routes
// from Trip settings, which do the same with leaveTrip() and closeRoom().
export default function register(socket: AppSocket, { io, sessions }: Ctx) {
  socket.on('group:leave', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const result = await leaveTrip(g, s.userId, s.username);
      closeRoom(io, sessions, s.code, s.userId);
      socket.emit('group:left');
      if (result === 'left') {
        io.to(s.code).emit('msg', toClient(g.messages.at(-1)));
        io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
      }
    } catch (e) { console.error('[group:leave]', (e as Error).message); }
  });

  socket.on('group:delete', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !sameId(g.adminUserId, s.userId)) return;
      await g.deleteOne();
      io.to(s.code).emit('group:deleted');
      closeRoom(io, sessions, s.code);
    } catch (e) { console.error('[group:delete]', (e as Error).message); }
  });
}
