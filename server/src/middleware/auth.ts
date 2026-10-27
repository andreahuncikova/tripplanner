import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
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

// Checks JWT for HTTP routes
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = readBearer(req.headers.authorization);
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    (req as AuthRequest).user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Checks JWT for sockets — the client sends it in io({ auth: { token } })
export function socketAuth(socket: AppSocket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) return next(new Error('auth'));
  try {
    // socket.data is the place Socket.IO gives us for our own data on each connection
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error('auth'));
  }
}
