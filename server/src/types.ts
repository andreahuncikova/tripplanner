import type { Server, Socket } from 'socket.io';

// The data we put inside the JWT when a user logs in
export interface JwtUser {
  _id: string;
  email: string;
  username: string;
  color: string;
}

// One connected socket — which user it belongs to and which group room it is in
export interface Session {
  userId: string;
  username: string;
  color: string;
  code: string;
}

// All connected sockets, keyed by socket.id
export type Sessions = Record<string, Session>;

// Short info about who is online, sent to the clients
export interface OnlineUser {
  username: string;
  color: string;
}

// ── Socket.IO events ──────────────────────────────────
// Every event the browser can send to the server, with the data it sends.
// If a handler uses a wrong event name or reads a field that is not here, TypeScript shows an error.
export interface ClientToServerEvents {
  'join':             (data: { code: string }) => void;
  'msg':              (text: string) => void;
  'typing':           () => void;

  'dest:suggest':     (name: string) => void;
  'dest:vote':        (destId: string) => void;
  'dest:approve':     (destId: string) => void;
  'dest:edit':        (data: { id: string; name: string }) => void;
  'dest:remove':      (destId: string) => void;

  'avail:set':        (dates: string[]) => void;
  'avail:ready':      () => void;
  'avail:unready':    () => void;
  'avail:compute':    () => void;
  'trip:setWindow':   (data: { start: string; end: string }) => void;

  'trip:setDuration': (days: number) => void;
  'range:vote':       (idx: number) => void;
  'range:confirm':    (data: { idx: number; start?: string }) => void;
  'phase:back':       () => void;

  'activity:add':     (data: { text: string; calDate?: string; calTime?: string }) => void;
  'activity:edit':    (data: { id: string; text: string; calDate?: string; calTime?: string }) => void;
  'activity:remove':  (actId: string) => void;

  'expense:add':      (data: ExpenseInput) => void;
  'expense:edit':     (data: ExpenseInput & { id: string }) => void;
  'expense:remove':   (expenseId: string) => void;

  'group:leave':      () => void;
  'group:delete':     () => void;
}

export interface ExpenseInput {
  description: string;
  amount: number;
  currency?: string;
  paidBy: string;
  splitAmong?: string[];
}

// Every event the server sends to the browser.
// Group data is typed as `unknown` here for now — it will get real types when the React client shares them.
export interface ServerToClientEvents {
  'err':             (message: string) => void;
  'joined':          (state: unknown) => void;
  'state':           (state: unknown) => void;
  'online':          (list: OnlineUser[]) => void;
  'msg':             (msg: unknown) => void;
  'typing':          (username: string) => void;
  'dest:new':        (dest: unknown) => void;
  'avail:update':    (data: { username: string; color: string; unavailableDates: string[] }) => void;
  'range:votes':     (ranges: unknown) => void;
  'activity:new':    (act: unknown) => void;
  'expense:new':     (exp: unknown) => void;
  'expense:removed': (expenseId: string) => void;
  'group:left':      () => void;
  'group:deleted':   () => void;
}

// Data stored on each socket by the socketAuth middleware
export interface SocketData {
  user: JwtUser;
}

export type IO       = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

// ctx bundles everything the socket handlers need
export interface Ctx {
  io: IO;
  sessions: Sessions;
  userId: string;
  username: string;
  color: string;
}
