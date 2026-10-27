import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import User from '../models/User';
import type { AppSocket, JwtUser } from '../types';

// A request that went through authMiddleware, so req.user is always set
export interface AuthRequest extends Request {
  user: JwtUser;
}

// Reads the token from an "Authorization: Bearer <token>" header.
// The token is only accepted from this header — not from cookies — because the client on Vercel
// cannot send a cookie from the Render domain, and a header is never sent by the browser on its own (no CSRF).
export function readBearer(header: string | undefined): string | null {
  const [type, token] = (header || '').split(' ');
  return type === 'Bearer' && token ? token : null;
}

// Checks the signature and the expiry date of a token.
// The algorithm is fixed to HS256, so a token that claims another algorithm (for example "none") is rejected.
export function verifyToken(token: string): JwtUser {
  return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as JwtUser;
}

// A correctly signed token is still refused when its version is older than the user's tokenVersion
// (the password was changed after the token was made) or when the user no longer exists.
// Tokens from before tokenVersion existed have no tv and count as version 0.
export async function isCurrentToken(payload: JwtUser): Promise<boolean> {
  const user = await User.findById(payload._id).select('tokenVersion').lean();
  return !!user && (user.tokenVersion ?? 0) === (payload.tv ?? 0);
}

// Checks JWT for HTTP routes
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = readBearer(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  let user: JwtUser;
  try {
    user = verifyToken(token);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (!(await isCurrentToken(user))) return res.status(401).json({ error: 'Your session has ended — please log in again' });
  } catch (e) {
    // A database problem is not the user's fault, so it must not look like a bad token
    console.error('[auth]', (e as Error).message);
    return res.status(503).json({ error: 'The database is not available right now — please try again in a moment' });
  }

  (req as AuthRequest).user = user;
  next();
}

// Checks JWT for sockets — the client sends it in io({ auth: { token } })
export async function socketAuth(socket: AppSocket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return next(new Error('auth'));
  try {
    const user = verifyToken(token);
    if (!(await isCurrentToken(user))) return next(new Error('auth'));
    // socket.data is the place Socket.IO gives us for our own data on each connection
    socket.data.user = user;
    next();
  } catch {
    next(new Error('auth'));
  }
}
