import { checkMessage } from '../validation';
import { addMessage, setPreview } from '../messages';
import { allowPreview, checkLink, firstLink, getPreview } from '../preview';
import type { AppSocket, Ctx, IO } from '../types';

// A message with a link gets a preview card in the chat, like in WhatsApp. The server reads the page once,
// after the message was already sent, so the message never waits for another website; the card follows
// with 'msg:preview' and is saved with the message for everyone who opens the chat later.
async function addLinkPreview(io: IO, code: string, userId: string, messageId: string, text: string) {
  const url = firstLink(text);
  if (!url) return;
  let link: URL;
  try { link = checkLink(url); } catch { return; }        // a link that may not be opened gets no card
  if (!allowPreview(userId)) return;                        // many links at once: the messages go, without cards
  const preview = await getPreview(link);
  // Nothing to show beyond the address: no card
  if (!preview.title && !preview.image && preview.platform === 'other') return;
  await setPreview(messageId, preview);
  io.to(code).emit('msg:preview', { id: messageId, preview });
}

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
      if (msg._id) await addLinkPreview(io, s.code, userId, msg._id, check.value);
    } catch (e) { console.error('[msg]', (e as Error).message); }
  });

  // Typing indicator — sent to everyone except the sender (socket.to skips the sender)
  socket.on('typing', () => {
    const s = sessions[socket.id];
    if (s) socket.to(s.code).emit('typing', username);
  });

}
