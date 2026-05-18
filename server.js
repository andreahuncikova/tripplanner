require('dotenv').config();
const express      = require('express');
const http         = require('http');
const { Server }   = require('socket.io');
const mongoose     = require('mongoose');
const cookieParser = require('cookie-parser');
const path         = require('path');

const { MONGO_URI, PORT, DEST_EMOJIS, ACTIVITY_SUGGESTIONS } = require('./config');
const { socketAuth } = require('./middleware/auth');
const { computeDateRanges, formatTripLabel } = require('./utils');
const Group = require('./models/Group');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));

// ── FX rates proxy (caches 1 h, avoids browser CORS) ─────
const FX_FALLBACK = {
  EUR:1, USD:1.08, GBP:0.86, CHF:0.95, CZK:25.1,
  PLN:4.28, HUF:390, NOK:11.7, SEK:11.4, DKK:7.46,
  JPY:162, CAD:1.47, AUD:1.65,
};
let _fxCache = null, _fxCacheTime = 0;
app.get('/api/fx-rates', async (req, res) => {
  if (_fxCache && Date.now() - _fxCacheTime < 3_600_000) return res.json(_fxCache);
  try {
    const r    = await fetch('https://api.frankfurter.app/latest?from=EUR');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    _fxCache     = { EUR: 1, ...data.rates };
    _fxCacheTime = Date.now();
    res.json(_fxCache);
  } catch (e) {
    console.warn('[fx-rates] fetch failed:', e.message, '— using fallback');
    res.json(_fxCache || FX_FALLBACK);
  }
});

// ── DB ────────────────────────────────────────────────
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(e  => console.error('❌ MongoDB:', e.message));

// ── Socket auth ───────────────────────────────────────
io.use(socketAuth);

// ── Online sessions ───────────────────────────────────
// socketId → { userId, username, color, code }
const sessions = {};
function getOnline(code) {
  return Object.values(sessions).filter(s => s.code === code);
}

function ts() {
  const d = new Date();
  return d.getHours() + ':' + String(d.getMinutes()).padStart(2,'0');
}

async function broadcastState(code) {
  const g = await Group.findOne({ inviteCode: code }).lean();
  if (!g) return;
  io.to(code).emit('state', serialize(g, getOnline(code)));
}

function serialize(g, onlineList) {
  return {
    name:              g.name,
    phase:             g.phase,
    tripDuration:      g.tripDuration,
    tripWindowStart:   g.tripWindowStart,
    tripWindowEnd:     g.tripWindowEnd,
    adminUsername:     g.adminUsername,
    members:           g.members,
    destinations:      g.destinations,
    approvedDest:      g.approvedDest,
    availability:      g.availability,
    dateRanges:        g.dateRanges,
    finalDate:         g.finalDate,
    finalDateLabel:    g.finalDateLabel,
    activities:        g.activities,
    expenses:          g.expenses,
    online:            (onlineList||[]).map(s => ({ username: s.username, color: s.color })),
  };
}

// ── Socket events ─────────────────────────────────────
io.on('connection', socket => {
  const { _id: userId, username, color } = socket.user;

  // JOIN ──────────────────────────────────────────────
  socket.on('join', async ({ code }) => {
    const inviteCode = code.toUpperCase();
    const g = await Group.findOne({ inviteCode });
    if (!g) { socket.emit('err', 'Group not found'); return; }

    // Add member if not already in it
    if (!g.members.find(m => String(m.userId) === String(userId))) {
      g.members.push({ userId, username, color });
      await g.save();
    }

    sessions[socket.id] = { userId, username, color, code: inviteCode };
    socket.join(inviteCode);

    // Send full state + last 60 messages to this socket
    socket.emit('joined', {
      ...serialize(g, getOnline(inviteCode)),
      messages: g.messages.slice(-60),
    });

    // Update online list for room
    io.to(inviteCode).emit('online', getOnline(inviteCode).map(s=>({ username:s.username, color:s.color })));
  });

  // CHAT ──────────────────────────────────────────────
  socket.on('msg', async text => {
    const s = sessions[socket.id];
    if (!s || !text?.trim()) return;
    const msg = { userId, username, color, text: text.trim(), time: ts() };
    await Group.updateOne({ inviteCode: s.code }, { $push: { messages: msg } });
    io.to(s.code).emit('msg', msg);
  });

  // SUGGEST DESTINATION ───────────────────────────────
  socket.on('dest:suggest', async name => {
    const s = sessions[socket.id];
    if (!s || !name?.trim()) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || g.phase !== 'destinations') return;
    const dest = { name: name.trim(), by: username, votes: [] };
    g.destinations.push(dest);
    await g.save();
    io.to(s.code).emit('dest:new', g.destinations.at(-1));
  });

  // VOTE DESTINATION ──────────────────────────────────
  socket.on('dest:vote', async destId => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || g.phase !== 'destinations') return;
    const d = g.destinations.id(destId);
    if (!d) return;
    const i = d.votes.indexOf(username);
    i === -1 ? d.votes.push(username) : d.votes.splice(i, 1);
    await g.save();
    io.to(s.code).emit('dest:votes', { destId, votes: d.votes });
  });

  // ADMIN: APPROVE DESTINATION ────────────────────────
  socket.on('dest:approve', async destId => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId) || g.phase !== 'destinations') return;
    const d = g.destinations.id(destId);
    if (!d) return;
    g.approvedDest = d.name;
    g.phase = 'calendar';
    g.messages.push({ username:'System', text:`Destination approved: ${d.name}. Mark the days you can't go.`, time:ts(), system:true });
    await g.save();
    await broadcastState(s.code);
    io.to(s.code).emit('msg', g.messages.at(-1));
  });

  // SET UNAVAILABILITY ────────────────────────────────
  socket.on('avail:set', async dates => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return;
    const filtered = (g.tripWindowStart && g.tripWindowEnd)
      ? dates.filter(d => d >= g.tripWindowStart && d <= g.tripWindowEnd)
      : dates;
    const existing = g.availability.find(a => String(a.userId) === String(userId));
    if (existing) { existing.unavailableDates = filtered; existing.color = color; }
    else g.availability.push({ userId, username, color, unavailableDates: filtered });
    await g.save();
    io.to(s.code).emit('avail:update', { username, color, unavailableDates: dates });
  });

  // ADMIN: COMPUTE DATE RANGES ────────────────────────
  socket.on('avail:compute', async () => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId) || g.phase !== 'calendar') return;
    const unavailMap = {};
    g.availability.forEach(a => { unavailMap[a.username] = a.unavailableDates; });
    const ranges = computeDateRanges(g.members.map(m=>m.username), unavailMap, g.tripWindowStart, g.tripWindowEnd);
    g.dateRanges = ranges;
    g.phase = 'date_vote';
    g.messages.push({ username:'System', text:`Available dates calculated. Time to vote!`, time:ts(), system:true });
    await g.save();
    await broadcastState(s.code);
    io.to(s.code).emit('msg', g.messages.at(-1));
  });

  // ADMIN: SET TRIP WINDOW ─────────────────────────────
  socket.on('trip:setWindow', async ({ start, end }) => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId)) return;
    if (!start || !end || start >= end) return;
    g.tripWindowStart = start;
    g.tripWindowEnd   = end;
    // Clear any unavailability outside the new window
    g.availability.forEach(a => {
      a.unavailableDates = a.unavailableDates.filter(d => d >= start && d <= end);
    });
    await g.save();
    await broadcastState(s.code);
  });

  // ADMIN: SET TRIP DURATION (after seeing free windows) ─────
  socket.on('trip:setDuration', async dur => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId) || g.phase !== 'date_vote') return;
    const d = Math.max(1, parseInt(dur) || 1);
    g.tripDuration = d;
    await g.save();
    await broadcastState(s.code);
  });

  // VOTE DATE RANGE ───────────────────────────────────────────
  socket.on('range:vote', async idx => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || g.phase !== 'date_vote') return;
    g.dateRanges.forEach(r => { r.votes = r.votes.filter(u => u !== username); });
    if (g.dateRanges[idx]) g.dateRanges[idx].votes.push(username);
    await g.save();
    io.to(s.code).emit('range:votes', g.dateRanges);
  });

  // ADMIN: CONFIRM DATE ───────────────────────────────
  socket.on('range:confirm', async ({ idx, start }) => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId) || g.phase !== 'date_vote') return;
    const r = g.dateRanges[idx];
    if (!r) return;
    const chosenStart = start || r.start;
    const label = (g.tripDuration && chosenStart !== r.start)
      ? formatTripLabel(chosenStart, g.tripDuration)
      : (g.tripDuration ? formatTripLabel(chosenStart, g.tripDuration) : r.label);
    g.dateRanges.forEach((x,i) => { x.selected = i===idx; });
    g.finalDate      = chosenStart;
    g.finalDateLabel = label;
    g.phase = 'done';
    g.messages.push({ username:'System', text:`Trip confirmed: ${label}! Start adding activities.`, time:ts(), system:true });
    await g.save();
    await broadcastState(s.code);
    io.to(s.code).emit('msg', g.messages.at(-1));
  });

  // ADMIN: GO BACK ONE PHASE ─────────────────────────
  socket.on('phase:back', async () => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(userId)) return;
    let msg = '';
    if (g.phase === 'done') {
      g.phase          = 'date_vote';
      g.finalDate      = null;
      g.finalDateLabel = null;
      g.activities     = [];
      g.dateRanges.forEach(r => { r.selected = false; });
      msg = 'Trip unconfirmed — back to date voting.';
    } else if (g.phase === 'date_vote') {
      g.phase      = 'calendar';
      g.dateRanges = [];
      msg = 'Back to availability calendar.';
    } else if (g.phase === 'calendar') {
      g.phase        = 'destinations';
      g.availability = [];
      msg = 'Back to destination selection.';
    } else {
      return;
    }
    g.messages.push({ username: 'System', text: msg, time: ts(), system: true });
    await g.save();
    await broadcastState(s.code);
    io.to(s.code).emit('msg', g.messages.at(-1));
  });

  // ADD ACTIVITY ──────────────────────────────────────
  socket.on('activity:add', async ({ text, calDate, calTime }) => {
    const s = sessions[socket.id];
    if (!s || !text?.trim()) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return;
    const act = { text: text.trim(), addedBy: username, userId, calDate: calDate||null, calTime: calTime||null };
    g.activities.push(act);
    await g.save();
    io.to(s.code).emit('activity:new', g.activities.at(-1));
  });

  // ADD EXPENSE ───────────────────────────────────────
  socket.on('expense:add', async ({ description, amount, currency, paidBy, splitAmong }) => {
    const s = sessions[socket.id];
    if (!s || !description?.trim() || !amount || amount <= 0) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || g.phase !== 'done') return;
    const member = g.members.find(m => m.username === paidBy);
    g.expenses.push({
      description: description.trim(),
      amount:      parseFloat(amount),
      currency:    currency || 'EUR',
      paidBy,
      paidByColor: member?.color || '#888',
      splitAmong:  splitAmong || g.members.map(m => m.username),
      addedBy:     username,
    });
    await g.save();
    io.to(s.code).emit('expense:new', g.expenses.at(-1));
  });

  // REMOVE EXPENSE ────────────────────────────────────
  socket.on('expense:remove', async expenseId => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return;
    const exp = g.expenses.id(expenseId);
    if (!exp) return;
    if (exp.addedBy !== username && g.adminUsername !== username) return;
    exp.deleteOne();
    await g.save();
    io.to(s.code).emit('expense:removed', expenseId);
  });

  // SHARE ACTIVITY TO CHAT ────────────────────────────
  socket.on('activity:share', async text => {
    const s = sessions[socket.id];
    if (!s) return;
    const msg = { userId, username, color, text, time:ts() };
    await Group.updateOne({ inviteCode: s.code }, { $push: { messages: msg } });
    io.to(s.code).emit('msg', msg);
  });

  // GET AI ACTIVITY SUGGESTIONS ───────────────────────
  socket.on('activity:suggest', async () => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code }).select('approvedDest');
    if (!g) return;
    const dest = g.approvedDest;
    const suggestions = ACTIVITY_SUGGESTIONS[dest] ||
      ACTIVITY_SUGGESTIONS[Object.keys(ACTIVITY_SUGGESTIONS).find(k=>dest?.includes(k))] ||
      ['🗺️ City sightseeing tour','🍽️ Local food experience','🏛️ Historic city centre','📸 Photo walk','🛍️ Local market'];
    socket.emit('activity:suggestions', { dest, suggestions });
  });

  // LEAVE GROUP ───────────────────────────────────────
  socket.on('group:leave', async () => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return;
    const isAdm = String(g.adminUserId) === String(s.userId);
    g.members = g.members.filter(m => String(m.userId) !== String(s.userId));
    if (isAdm && g.members.length > 0) {
      g.adminUserId   = g.members[0].userId;
      g.adminUsername = g.members[0].username;
      g.messages.push({ username:'System', text:`${s.username} left. ${g.adminUsername} is now admin.`, time:ts(), system:true });
    } else if (isAdm) {
      await g.deleteOne();
      socket.emit('group:left');
      return;
    } else {
      g.messages.push({ username:'System', text:`${s.username} left the group.`, time:ts(), system:true });
    }
    await g.save();
    socket.emit('group:left');
    io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
  });

  // DELETE GROUP (admin) ──────────────────────────────
  socket.on('group:delete', async () => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || String(g.adminUserId) !== String(s.userId)) return;
    await g.deleteOne();
    io.to(s.code).emit('group:deleted');
  });

  // REMOVE DESTINATION ────────────────────────────────
  socket.on('dest:remove', async destId => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g || g.phase !== 'destinations') return;
    const dest = g.destinations.find(d => String(d._id) === String(destId));
    if (!dest) return;
    if (dest.by !== s.username && String(g.adminUserId) !== String(s.userId)) return;
    g.destinations = g.destinations.filter(d => String(d._id) !== String(destId));
    await g.save();
    io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
  });

  // REMOVE ACTIVITY ───────────────────────────────────
  socket.on('activity:remove', async actId => {
    const s = sessions[socket.id];
    if (!s) return;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return;
    const act = g.activities.find(a => String(a._id) === String(actId));
    if (!act) return;
    if (String(act.userId) !== String(s.userId) && String(g.adminUserId) !== String(s.userId)) return;
    g.activities = g.activities.filter(a => String(a._id) !== String(actId));
    await g.save();
    io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
  });

  // TYPING ────────────────────────────────────────────
  socket.on('typing', () => {
    const s = sessions[socket.id];
    if (s) socket.to(s.code).emit('typing', username);
  });

  // DISCONNECT ────────────────────────────────────────
  socket.on('disconnect', () => {
    const s = sessions[socket.id];
    if (s) {
      delete sessions[socket.id];
      io.to(s.code).emit('online', getOnline(s.code).map(x=>({ username:x.username, color:x.color })));
    }
  });
});

server.listen(PORT, () => console.log(`\n✈️  TripPlanner v3  →  http://localhost:${PORT}\n`));
