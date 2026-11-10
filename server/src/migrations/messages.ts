// One-time change of old trips: chat messages used to be an array inside the trip document,
// now each one is its own document in the messages collection (models/Message.ts).
// This turns one old group document into the messages to insert. It only reads the document,
// so it can be tested without a database.
// Run it on the database with: npm run migrate:messages   (add -- --apply to really write)

type Doc = Record<string, unknown>;

export interface MovedMessage {
  groupId: unknown;
  userId?: unknown;
  username?: string;
  color?: string;
  text: string;
  time: string;
  system: boolean;
  createdAt: Date;
}

// Old messages only have "HH:MM", not a date. To keep their order, each one gets the trip's
// creation time plus its place in the array in milliseconds, so they all sort before new messages.
export function messagesToMove(g: Doc): MovedMessage[] {
  if (!Array.isArray(g.messages)) return [];
  const start = g.createdAt instanceof Date ? g.createdAt.getTime() : 0;
  return (g.messages as Doc[])
    .filter(m => typeof m?.text === 'string' && m.text !== '')
    .map((m, i) => ({
      groupId: g._id,
      ...(m.userId != null && { userId: m.userId }),
      ...(typeof m.username === 'string' && { username: m.username }),
      ...(typeof m.color === 'string' && { color: m.color }),
      text: m.text as string,
      time: typeof m.time === 'string' ? m.time : '',
      system: m.system === true,
      createdAt: new Date(start + i),
    }));
}
