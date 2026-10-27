import 'dotenv/config';
import express      from 'express';
import http         from 'http';
import { Server }   from 'socket.io';
import mongoose     from 'mongoose';
import cors         from 'cors';

import { MONGO_URI, PORT, CLIENT_URLS } from './config';
import { socketAuth }      from './middleware/auth';
import registerAllHandlers from './socket';
import authRoutes          from './routes/auth';
import groupRoutes         from './routes/groups';
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

// ── REST API ──────────────────────────────────────────
// The server only serves the API; the frontend is served by Vercel.
// Render puts one proxy in front of the server, so the real visitor IP (used by the login rate limit)
// comes from the X-Forwarded-For header that this proxy sets.
app.set('trust proxy', 1);
app.use(cors({ origin: CLIENT_URLS }));
app.use(express.json());
app.use('/api/auth',   authRoutes);
app.use('/api/groups', groupRoutes);

// ── Currency exchange rates  ─────────────────────
// fallback data if API fails or returns incomplete data
const FX_FALLBACK: Record<string, number> = {
  EUR:1, USD:1.08, GBP:0.86, CHF:0.95, CZK:25.1,
  PLN:4.28, HUF:390, NOK:11.7, SEK:11.4, DKK:7.46,
  JPY:162, CAD:1.47, AUD:1.65,
};
// cache to avoid calling API too often
let _fxCache: Record<string, number> | null = null, _fxCacheTime = 0;

app.get('/api/fx-rates', async (_req, res) => {
  // Return the cached rates if they are less than 1 hour old
  if (_fxCache && Date.now() - _fxCacheTime < 3_600_000) return res.json(_fxCache);
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json() as { rates: Record<string, number> };
    _fxCache = { EUR: 1, ...data.rates };
    _fxCacheTime = Date.now();
    res.json(_fxCache);
  } catch (e) {
    // If the external API fails, return the last cached value or hardcoded fallback
    console.warn('[fx-rates]', (e as Error).message, '— using fallback');
    res.json(_fxCache || FX_FALLBACK);
  }
});

// ── Database connection ───────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(e  => console.error('❌ MongoDB:', e.message));

// ── WebSocket setup ───────────────────────────────────
// socketAuth runs before every new connection — it checks the JWT token and rejects unauthenticated sockets before they can send any events.
io.use(socketAuth);

// sessions keeps track of which socket belongs to which user and group,
// so we can route messages to the correct room.
const sessions: Sessions = {};
registerAllHandlers(io, sessions);

// ── Global error handler ──────────────────────────────
// This catches any unhandled promise rejections anywhere in the code and logs them.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', (err as Error)?.message || err));

server.listen(PORT, () => console.log(`\n✈️  TripPlanner  →  http://localhost:${PORT}\n`));
