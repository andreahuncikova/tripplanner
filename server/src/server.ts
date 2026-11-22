import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http         from 'http';
import { Server }   from 'socket.io';
import cors         from 'cors';

import { PORT, CLIENT_URLS }  from './config';
import { connectWithRetry, isDbReady } from './db';
import { socketAuth }      from './middleware/auth';
import { fxRates }        from './fx';
import registerAllHandlers from './socket';
import authRoutes          from './routes/auth';
import groupRoutes         from './routes/groups';
import previewRoutes       from './routes/preview';
import placesRoutes        from './routes/places';
import fileRoutes          from './routes/files';
import type { ClientToServerEvents, ServerToClientEvents, SocketData, Sessions } from './types';

// Create the Express app and wrap it in a plain HTTP server.
// Socket.io needs access to the raw HTTP server, not just Express, so we pass the same server instance to both.
const app    = express();
const server = http.createServer(app);
// The React client runs on another domain (Vercel), so the browser only lets it call this server
// if the server allows that domain (CORS). Only the addresses in CLIENT_URL are allowed.
const io     = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(server, {
  cors: { origin: CLIENT_URLS },
});

// sessions keeps track of which socket belongs to which user and group,
// so we can route messages to the correct room.
const sessions: Sessions = {};
// The REST routes need them too, so a change made in Trip settings reaches everyone who has the trip open
app.locals.live = { io, sessions };

// ── REST API ──────────────────────────────────────────
// The server only serves the API; the frontend is served by Vercel.
// Render puts one proxy in front of the server, so the real visitor IP (used by the login rate limit)
// comes from the X-Forwarded-For header that this proxy sets.
app.set('trust proxy', 1);
app.use(cors({ origin: CLIENT_URLS }));
app.use(express.json());

// While the database is not connected, answer straight away with 503 (Service Unavailable),
// instead of letting the request wait and then fail with a general server error.
function requireDb(_req: Request, res: Response, next: NextFunction) {
  if (isDbReady()) return next();
  res.status(503).json({ error: 'The database is not available right now — please try again in a moment' });
}

// Shows if the server and the database are working, e.g. https://<server>/api/health
app.get('/api/health', (_req, res) => {
  const db = isDbReady();
  res.status(db ? 200 : 503).json({ ok: db, database: db ? 'connected' : 'not connected' });
});

app.use('/api/auth',   requireDb, authRoutes);
app.use('/api/groups', requireDb, groupRoutes);
app.use('/api/preview', requireDb, previewRoutes);   // reads photo, title, price and location from a stay link
app.use('/api/places',  requireDb, placesRoutes);    // photos from Google Maps for stays without one
app.use('/api/files',   requireDb, fileRoutes);      // chat photos and files, profile photos (files.ts)

// ── Currency exchange rates  ─────────────────────
// Every currency the budget can convert, from ExchangeRate-API or Frankfurter (see fx.ts)
app.get('/api/fx-rates', async (_req, res) => {
  res.json(await fxRates.get());
});

// ── Database connection ───────────────────────────────
// Keeps trying until the database answers (see db.ts). The server starts listening right away,
// so /api/health and the 503 answers work while it is still connecting.
connectWithRetry();

// ── WebSocket setup ───────────────────────────────────
// socketAuth runs before every new connection — it checks the JWT token and rejects unauthenticated sockets before they can send any events.
io.use(socketAuth);

registerAllHandlers(io, sessions);

// ── Global error handler ──────────────────────────────
// This catches any unhandled promise rejections anywhere in the code and logs them.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', (err as Error)?.message || err));

server.listen(PORT, () => console.log(`\n✈️  TripPlanner  →  http://localhost:${PORT}\n`));
