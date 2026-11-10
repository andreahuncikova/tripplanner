import type { Types } from 'mongoose';
import Message from './models/Message';
import { ts } from './utils';
import type { ChatMessage, LinkPreview } from '../../shared/types';

type GroupId = Types.ObjectId | string;

// How many of the newest messages the client gets when it opens a trip
const HISTORY = 60;

// What the client sees of a message: its id (to add the link preview later), no groupId or createdAt
function toChat(m: {
  _id?: unknown; userId?: unknown; username?: string | null; color?: string | null; text: string; time?: string | null;
  system?: boolean | null; preview?: unknown;
}): ChatMessage {
  return {
    ...(m._id != null && { _id: String(m._id) }),
    ...(m.userId != null && { userId: String(m.userId) }),
    ...(m.username != null && { username: m.username }),
    ...(m.color != null && { color: m.color }),
    text: m.text,
    time: m.time ?? '',
    ...(m.system && { system: true }),
    ...(m.preview != null && { preview: m.preview as LinkPreview }),
  };
}

// Saves the link preview of a message once the server has read the page
async function setPreview(messageId: string, preview: LinkPreview) {
  await Message.updateOne({ _id: messageId }, { preview });
}

// Saves a message someone wrote and returns it as the client sees it
async function addMessage(groupId: GroupId, from: { userId: string; username: string; color: string }, text: string) {
  const m = await Message.create({ groupId, ...from, text, time: ts() });
  return toChat(m);
}

// Saves a message from the server itself (e.g. "Mia joined the trip.") and returns it
async function addSystemMessage(groupId: GroupId, text: string) {
  const m = await Message.create({ groupId, username: 'System', text, time: ts(), system: true });
  return toChat(m);
}

// The newest messages of a trip, oldest first, as the chat shows them
async function lastMessages(groupId: GroupId, limit = HISTORY) {
  const list = await Message.find({ groupId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  return list.reverse().map(toChat);
}

// Called when a trip is deleted, so its messages do not stay behind
async function deleteMessages(groupId: GroupId) {
  await Message.deleteMany({ groupId });
}

export { addMessage, addSystemMessage, lastMessages, deleteMessages, setPreview, toChat };
