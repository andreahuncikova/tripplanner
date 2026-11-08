import Group from '../models/Group';
import { normalizeInviteCode } from '../validation';
import { getOnline, serialize, toClient, toOnline } from './helpers';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // Counts joins and closes on this socket, so a join that is still loading when the user
  // has already closed the trip (or opened another one) does not put them back in that room
  let latest = 0;

  // Takes this socket out of the trip it has open, if any, and updates the online list there
  function leaveRoom() {
    const s = sessions[socket.id];
    if (!s) return;
    delete sessions[socket.id];
    socket.leave(s.code);
    io.to(s.code).emit('online', toOnline(getOnline(sessions, s.code)));
  }

  socket.on('join', async data => {
    const n = ++latest;
    try {
      const inviteCode = normalizeInviteCode(data?.code);
      // Only members open a trip. New members join through POST /api/groups/:code/join,
      // which is rate-limited so nobody can try out codes here instead
      const g = inviteCode && await Group.findOne({ inviteCode, 'members.userId': userId });
      if (n !== latest) return;
      if (!g || !inviteCode) { socket.emit('err', 'Trip not found'); return; }

      // One socket serves the whole app, so a trip opened before this one is left first
      if (sessions[socket.id]?.code !== inviteCode) leaveRoom();

      // Store the session so we can find this user's socket later (e.g. to approve back-requests)
      sessions[socket.id] = { userId, username, color, code: inviteCode };
      // Join the Socket.io room so broadcasts to this group reach this socket
      socket.join(inviteCode);

      // Send the full group state + last 60 messages to the joining client
      socket.emit('joined', {
        ...serialize(g, getOnline(sessions, inviteCode)),
        messages: toClient(g.messages.slice(-60)),
      });

      // Tell everyone else in the room that someone new joined
      io.to(inviteCode).emit('online', toOnline(getOnline(sessions, inviteCode)));
    } catch (e) { console.error('[join]', (e as Error).message); }
  });

  // The user left the trip screen (e.g. went back to the dashboard)
  socket.on('trip:close', () => {
    latest++;
    leaveRoom();
  });

  socket.on('disconnect', leaveRoom);
}
