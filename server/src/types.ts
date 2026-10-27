import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, User } from '../../shared/types';

// The events and the data sent between client and server live in shared/types.ts,
// so the React client and the server always use the same definitions.
// This file only adds the types that the server needs for itself.
export type * from '../../shared/types';

// The data we put inside the JWT when a user logs in — the same fields as the user the client gets
export type JwtUser = User;

// One connected socket — which user it belongs to and which group room it is in
export interface Session {
  userId: string;
  username: string;
  color: string;
  code: string;
}

// All connected sockets, keyed by socket.id
export type Sessions = Record<string, Session>;

// Data stored on each socket by the socketAuth middleware
export interface SocketData {
  user: JwtUser;
}

export type IO        = Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

// ctx bundles everything the socket handlers need
export interface Ctx {
  io: IO;
  sessions: Sessions;
  userId: string;
  username: string;
  color: string;
}
