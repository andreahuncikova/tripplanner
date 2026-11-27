import { checkMessage } from '../validation';
import { addMessage, setPreview } from '../messages';
import { allowPreview, checkLink, firstLink, getPreview } from '../preview';
import { fileUrl, findFile, isFileId } from '../files';
import type { ChatFile } from '../../../shared/types';
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

// The file of a message: a chat file this person uploaded to this trip (POST /api/files?kind=chat),
// so nobody can show another trip's file, or a profile photo, in the chat. Null when it is not one.
async function chatFile(id: unknown, userId: string, groupId: string): Promise<ChatFile | null> {
  if (!isFileId(id)) return null;
  const f = await findFile(id);
  if (!f || f.meta.kind !== 'chat' || String(f.meta.groupId) !== groupId || String(f.meta.uploadedByUserId) !== userId) return null;
  return { url: fileUrl(id), type: f.meta.type, name: f.meta.name, size: f.length };
}

export default function register(socket: AppSocket, { io, sessions, userId, username, color }: Ctx) {
  // User sends a chat message — save it to the DB and broadcast to the whole room, the sender included.
  // A plain string is text only; { text, file } also carries a photo or PDF, and the text may then be empty.
  socket.on('msg', async data => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const input = typeof data === 'object' && data !== null ? data : { text: data };
      const fileId = input.file;

      let file: ChatFile | undefined;
      if (fileId != null) {
        const found = await chatFile(fileId, userId, String(s.groupId));
        if (!found) { socket.emit('err', 'The file could not be sent — please choose it again'); return; }
        file = found;
      }

      let text = '';
      if (!file || String(input.text ?? '').trim()) {
        const check = checkMessage(input.text);
        if (!check.ok) { socket.emit('err', check.error); return; }
        text = check.value;
      }

      // Saved in the messages collection; the trip document itself does not change
      const msg = await addMessage(s.groupId, { userId, username, color }, text, file);
      io.to(s.code).emit('msg', msg);
      if (msg._id && text) await addLinkPreview(io, s.code, userId, msg._id, text);
    } catch (e) { console.error('[msg]', (e as Error).message); }
  });

  // Typing indicator — sent to everyone except the sender (socket.to skips the sender)
  socket.on('typing', () => {
    const s = sessions[socket.id];
    if (s) socket.to(s.code).emit('typing', username);
  });

}
