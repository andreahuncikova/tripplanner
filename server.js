require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const mongoose     = require('mongoose');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { MONGO_URI, PORT } = require('./config');
const { socketAuth }      = require('./middleware/auth');
const registerAllHandlers = require('./socket');

// Create the Express app and wrap it in a plain HTTP server.
// Socket.io needs access to the raw HTTP server, not just Express, so we pass the same server instance to both.
const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

// ── Static files & REST API ───────────────────────────
// Serve everything in /public directly to the browser.
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));

// ── Currency exchange rates  ─────────────────────
// fallback data if API fails or returns incomplete data
const FX_FALLBACK = {
  EUR:1, USD:1.08, GBP:0.86, CHF:0.95, CZK:25.1,
  PLN:4.28, HUF:390, NOK:11.7, SEK:11.4, DKK:7.46,
  JPY:162, CAD:1.47, AUD:1.65,
};
// cache to avoid calling API too often
let _fxCache = null, _fxCacheTime = 0;

app.get('/api/fx-rates', async (req, res) => {
  // Return the cached rates if they are less than 1 hour old
  if (_fxCache && Date.now() - _fxCacheTime < 3_600_000) return res.json(_fxCache);
  try {
    const r = await fetch('https://api.frankfurter.app/latest?from=EUR');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _fxCache = { EUR: 1, ...data.rates };
    _fxCacheTime = Date.now();
    res.json(_fxCache);
  } catch (e) {
    // If the external API fails, return the last cached value or hardcoded fallback
    console.warn('[fx-rates]', e.message, '— using fallback');
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
const sessions = {};
registerAllHandlers(io, sessions);

// ── Global error handler ──────────────────────────────
// This catches any unhandled promise rejections anywhere in the code and logs them.
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err?.message || err));

server.listen(PORT, () => console.log(`\n✈️  TripPlanner  →  http://localhost:${PORT}\n`));
