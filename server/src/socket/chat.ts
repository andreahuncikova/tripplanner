import Group from '../models/Group';
import { ts } from './helpers';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // User sends a chat message — save it to the DB and broadcast to the whole room
  socket.on('msg', async text => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const msg = { userId, username, color, text: text.trim(), time: ts() };
      // $push appends to the messages array without loading the whole document
      await Group.updateOne({ inviteCode: s.code }, { $push: { messages: msg } });
      io.to(s.code).emit('msg', msg);
    } catch (e) { console.error('[msg]', (e as Error).message); }
  });

  // Typing indicator — sent to everyone except the sender (socket.to skips the sender)
  socket.on('typing', () => {
    const s = sessions[socket.id];
    if (s) socket.to(s.code).emit('typing', username);
  });

}
