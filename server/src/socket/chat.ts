import { checkMessage } from '../validation';
import { addMessage } from '../messages';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // User sends a chat message — save it to the DB and broadcast to the whole room, the sender included
  socket.on('msg', async text => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const check = checkMessage(text);
      if (!check.ok) { socket.emit('err', check.error); return; }
      // Saved in the messages collection; the trip document itself does not change
      const msg = await addMessage(s.groupId, { userId, username, color }, check.value);
      io.to(s.code).emit('msg', msg);
    } catch (e) { console.error('[msg]', (e as Error).message); }
  });

  // Typing indicator — sent to everyone except the sender (socket.to skips the sender)
  socket.on('typing', () => {
    const s = sessions[socket.id];
    if (s) socket.to(s.code).emit('typing', username);
  });

}
