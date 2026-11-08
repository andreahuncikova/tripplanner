import Group from '../models/Group';
import { checkMessage } from '../validation';
import { ts } from './helpers';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // User sends a chat message — save it to the DB and broadcast to the whole room, the sender included
  socket.on('msg', async text => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const check = checkMessage(text);
      if (!check.ok) { socket.emit('err', check.error); return; }
      const msg = { userId, username, color, text: check.value, time: ts() };
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
