import type { Types } from 'mongoose';
import Message from './models/Message';
import { ts } from './utils';
import type { ChatMessage } from '../../shared/types';

type GroupId = Types.ObjectId | string;

// How many of the newest messages the client gets when it opens a trip
const HISTORY = 60;

// What the client sees of a message: no _id, groupId or createdAt
function toChat(m: { userId?: unknown; username?: string | null; color?: string | null; text: string; time?: string | null; system?: boolean | null }): ChatMessage {
  return {
    ...(m.userId != null && { userId: String(m.userId) }),
    ...(m.username != null && { username: m.username }),
    ...(m.color != null && { color: m.color }),
    text: m.text,
    time: m.time ?? '',
    ...(m.system && { system: true }),
  };
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

export { addMessage, addSystemMessage, lastMessages, deleteMessages, toChat };
