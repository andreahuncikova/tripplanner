import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';
import type { AppSocket, JwtUser } from '../types';

// A request that went through authMiddleware, so req.user is always set
export interface AuthRequest extends Request {
  user: JwtUser;
}

// Checks JWT for HTTP routes
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    (req as AuthRequest).user = jwt.verify(token, JWT_SECRET) as JwtUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Checks JWT for sockets
export function socketAuth(socket: AppSocket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('auth'));
  try {
    // socket.data is the place Socket.IO gives us for our own data on each connection
    socket.data.user = jwt.verify(token, JWT_SECRET) as JwtUser;
    next();
  } catch {
    next(new Error('auth'));
  }
}
