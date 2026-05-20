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
    availabilityReady: g.availabilityReady,
    dateRanges:        g.dateRanges,
    finalDate:         g.finalDate,
    finalDateLabel:    g.finalDateLabel,
    activities:        g.activities,
    expenses:          g.expenses,
    packingList:       g.packingList,
    online:            (onlineList||[]).map(s => ({ username: s.username, color: s.color })),
  };
}

// ── Socket events ─────────────────────────────────────
io.on('connection', socket => {
  const { _id: userId, username, color } = socket.user;

  // JOIN ──────────────────────────────────────────────
  socket.on('join', async ({ code }) => {
    try {
      const inviteCode = code.toUpperCase();
      const g = await Group.findOne({ inviteCode });
      if (!g) { socket.emit('err', 'Group not found'); return; }

      if (!g.members.find(m => String(m.userId) === String(userId))) {
        g.members.push({ userId, username, color });
        await g.save();
      }

      sessions[socket.id] = { userId, username, color, code: inviteCode };
      socket.join(inviteCode);

      socket.emit('joined', {
        ...serialize(g, getOnline(inviteCode)),
        messages: g.messages.slice(-60),
      });

      io.to(inviteCode).emit('online', getOnline(inviteCode).map(s=>({ username:s.username, color:s.color })));
    } catch (e) { console.error('[join]', e.message); }
  });

  // CHAT ──────────────────────────────────────────────
  socket.on('msg', async text => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const msg = { userId, username, color, text: text.trim(), time: ts() };
      await Group.updateOne({ inviteCode: s.code }, { $push: { messages: msg } });
      io.to(s.code).emit('msg', msg);
    } catch (e) { console.error('[msg]', e.message); }
  });

  // SUGGEST DESTINATION ───────────────────────────────
  socket.on('dest:suggest', async name => {
    try {
      const s = sessions[socket.id];
      if (!s || !name?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const dest = { name: name.trim(), by: username, votes: [] };
      g.destinations.push(dest);
      await g.save();
      io.to(s.code).emit('dest:new', g.destinations.at(-1));
    } catch (e) { console.error('[dest:suggest]', e.message); }
  });

  // VOTE DESTINATION ──────────────────────────────────
  socket.on('dest:vote', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const d = g.destinations.id(destId);
      if (!d) return;
      if (d.votes.includes(username)) return;
      g.destinations.forEach(x => { x.votes = x.votes.filter(u => u !== username); });
      d.votes.push(username);
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[dest:vote]', e.message); }
  });

  // ADMIN: APPROVE DESTINATION ────────────────────────
  socket.on('dest:approve', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      const d = g.destinations.id(destId);
      if (!d) return;
      g.approvedDest = d.name;
      if (g.phase === 'destinations') g.phase = 'calendar';
      g.messages.push({ username:'System', text:`Destination approved: ${d.name}.`, time:ts(), system:true });
      await g.save();
      await broadcastState(s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[dest:approve]', e.message); }
  });

  // SET UNAVAILABILITY ────────────────────────────────
  socket.on('avail:set', async dates => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const weRaw = g.tripWindowEnd;
      const weSnapped = weRaw ? (() => {
        const d = new Date(weRaw + 'T12:00:00');
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
      })() : weRaw;
      const filtered = (g.tripWindowStart && weSnapped)
        ? dates.filter(d => d >= g.tripWindowStart && d <= weSnapped)
        : dates;
      const existing = g.availability.find(a => String(a.userId) === String(userId));
      if (existing) { existing.unavailableDates = filtered; existing.color = color; }
      else g.availability.push({ userId, username, color, unavailableDates: filtered });
      await g.save();
      io.to(s.code).emit('avail:update', { username, color, unavailableDates: dates });
    } catch (e) { console.error('[avail:set]', e.message); }
  });

  // MEMBER: CONFIRM AVAILABILITY DONE ────────────────
  socket.on('avail:ready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      if (!g.availabilityReady.includes(username)) g.availabilityReady.push(username);
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[avail:ready]', e.message); }
  });

  socket.on('avail:unready', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      g.availabilityReady = g.availabilityReady.filter(u => u !== username);
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[avail:unready]', e.message); }
  });

  // ADMIN: COMPUTE DATE RANGES ────────────────────────
  socket.on('avail:compute', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['calendar', 'date_vote', 'done'].includes(g.phase)) return;
      const unavailMap = {};
      g.availability.forEach(a => { unavailMap[a.username] = a.unavailableDates; });
      const ranges = computeDateRanges(g.members.map(m=>m.username), unavailMap, g.tripWindowStart, g.tripWindowEnd);
      g.dateRanges = ranges;
      if (g.phase === 'calendar') g.phase = 'date_vote';
      g.messages.push({ username:'System', text:`Available dates calculated. Time to vote!`, time:ts(), system:true });
      await g.save();
      await broadcastState(s.code);
      io.to(s.code).emit('msg', g.messages.at(-1));
    } catch (e) { console.error('[avail:compute]', e.message); }
  });

  // ADMIN: SET TRIP WINDOW ─────────────────────────────
  socket.on('trip:setWindow', async ({ start, end }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      if (!start || !end || start >= end) return;
      const endDate = new Date(end + 'T12:00:00');
      const lastDay = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
      const correctedEnd = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
      g.tripWindowStart = start;
      g.tripWindowEnd   = correctedEnd;
      g.availability.forEach(a => {
        a.unavailableDates = a.unavailableDates.filter(d => d >= start && d <= end);
      });
      await g.save();
      await broadcastState(s.code);
    } catch (e) { console.error('[trip:setWindow]', e.message); }
  });

  // ADMIN: SET TRIP DURATION (after seeing free windows) ─────
  socket.on('trip:setDuration', async dur => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['date_vote', 'done'].includes(g.phase)) return;
      const d = Math.max(1, parseInt(dur) || 1);
      g.tripDuration = d;
      await g.save();
      await broadcastState(s.code);
    } catch (e) { console.error('[trip:setDuration]', e.message); }
  });

  // VOTE DATE RANGE ───────────────────────────────────────────
  socket.on('range:vote', async idx => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !['date_vote', 'done'].includes(g.phase)) return;
      if (g.dateRanges[idx]?.votes.includes(username)) return;
      g.dateRanges.forEach(r => { r.votes = r.votes.filter(u => u !== username); });
      if (g.dateRanges[idx]) g.dateRanges[idx].votes.push(username);
      await g.save();
      io.to(s.code).emit('range:votes', g.dateRanges);
    } catch (e) { console.error('[range:vote]', e.message); }
  });

  // ADMIN: CONFIRM DATE ───────────────────────────────
  socket.on('range:confirm', async ({ idx, start }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId) || !['date_vote', 'done'].includes(g.phase)) return;
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
    } catch (e) { console.error('[range:confirm]', e.message); }
  });

  // ADMIN: GO BACK ONE PHASE ─────────────────────────
  socket.on('phase:back', async () => {
    try {
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
    } catch (e) { console.error('[phase:back]', e.message); }
  });

  // ADD ACTIVITY ──────────────────────────────────────
  socket.on('activity:add', async ({ text, calDate, calTime }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const act = { text: text.trim(), addedBy: username, userId, calDate: calDate||null, calTime: calTime||null };
      g.activities.push(act);
      await g.save();
      io.to(s.code).emit('activity:new', g.activities.at(-1));
    } catch (e) { console.error('[activity:add]', e.message); }
  });

  // ADD EXPENSE ───────────────────────────────────────
  socket.on('expense:add', async ({ description, amount, currency, paidBy, splitAmong }) => {
    try {
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
    } catch (e) { console.error('[expense:add]', e.message); }
  });

  // REMOVE EXPENSE ────────────────────────────────────
  socket.on('expense:remove', async expenseId => {
    try {
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
    } catch (e) { console.error('[expense:remove]', e.message); }
  });

  // PACKING LIST ──────────────────────────────────────
  socket.on('pack:add', async text => {
    try {
      const s = sessions[socket.id];
      if (!s || !text?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'done') return;
      g.packingList.push({ text: text.trim(), addedBy: username });
      await g.save();
      io.to(s.code).emit('pack:new', g.packingList.at(-1));
    } catch (e) { console.error('[pack:add]', e.message); }
  });

  socket.on('pack:toggle', async itemId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const item = g.packingList.id(itemId);
      if (!item) return;
      item.packed   = !item.packed;
      item.packedBy = item.packed ? username : null;
      await g.save();
      io.to(s.code).emit('pack:toggled', { id: itemId, packed: item.packed, packedBy: item.packedBy });
    } catch (e) { console.error('[pack:toggle]', e.message); }
  });

  socket.on('pack:remove', async itemId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const item = g.packingList.id(itemId);
      if (!item || (item.addedBy !== username && g.adminUsername !== username)) return;
      item.deleteOne();
      await g.save();
      io.to(s.code).emit('pack:removed', itemId);
    } catch (e) { console.error('[pack:remove]', e.message); }
  });

  // SHARE ACTIVITY TO CHAT ────────────────────────────
  socket.on('activity:share', async text => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const msg = { userId, username, color, text, time:ts() };
      await Group.updateOne({ inviteCode: s.code }, { $push: { messages: msg } });
      io.to(s.code).emit('msg', msg);
    } catch (e) { console.error('[activity:share]', e.message); }
  });

  // GET AI ACTIVITY SUGGESTIONS ───────────────────────
  socket.on('activity:suggest', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code }).select('approvedDest');
      if (!g) return;
      const dest = g.approvedDest;
      const suggestions = ACTIVITY_SUGGESTIONS[dest] ||
        ACTIVITY_SUGGESTIONS[Object.keys(ACTIVITY_SUGGESTIONS).find(k=>dest?.includes(k))] ||
        ['🗺️ City sightseeing tour','🍽️ Local food experience','🏛️ Historic city centre','📸 Photo walk','🛍️ Local market'];
      socket.emit('activity:suggestions', { dest, suggestions });
    } catch (e) { console.error('[activity:suggest]', e.message); }
  });

  // LEAVE GROUP ───────────────────────────────────────
  socket.on('group:leave', async () => {
    try {
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
    } catch (e) { console.error('[group:leave]', e.message); }
  });

  // DELETE GROUP (admin) ──────────────────────────────
  socket.on('group:delete', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(s.userId)) return;
      await g.deleteOne();
      io.to(s.code).emit('group:deleted');
    } catch (e) { console.error('[group:delete]', e.message); }
  });

  // EDIT DESTINATION ─────────────────────────────────
  socket.on('dest:edit', async ({ id, name }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !name?.trim()) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const dest = g.destinations.find(d => String(d._id) === String(id));
      if (!dest) return;
      if (dest.by !== username && String(g.adminUserId) !== String(userId)) return;
      dest.name = name.trim();
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[dest:edit]', e.message); }
  });

  // EDIT EXPENSE ─────────────────────────────────────
  socket.on('expense:edit', async ({ id, description, amount, currency, paidBy, splitAmong }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const exp = g.expenses.id(id);
      if (!exp) return;
      if (exp.addedBy !== username && g.adminUsername !== username) return;
      exp.description = description;
      exp.amount      = amount;
      exp.currency    = currency;
      exp.paidBy      = paidBy;
      exp.paidByColor = (g.members.find(m => m.username === paidBy))?.color || exp.paidByColor;
      exp.splitAmong  = splitAmong;
      await g.save();
      await broadcastState(s.code);
    } catch (e) { console.error('[expense:edit]', e.message); }
  });

  // REMOVE DESTINATION ────────────────────────────────
  socket.on('dest:remove', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const dest = g.destinations.find(d => String(d._id) === String(destId));
      if (!dest) return;
      if (dest.by !== s.username && String(g.adminUserId) !== String(s.userId)) return;
      g.destinations = g.destinations.filter(d => String(d._id) !== String(destId));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[dest:remove]', e.message); }
  });

  // EDIT ACTIVITY ─────────────────────────────────────
  socket.on('activity:edit', async ({ id, text, calDate, calTime }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const act = g.activities.find(a => String(a._id) === String(id));
      if (!act) return;
      if (String(act.userId) !== String(s.userId) && String(g.adminUserId) !== String(s.userId)) return;
      act.text = text; act.calDate = calDate || null; act.calTime = calTime || null;
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(s.code)));
    } catch (e) { console.error('[activity:edit]', e.message); }
  });

  socket.on('activity:remove', async actId => {
    try {
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
    } catch (e) { console.error('[activity:remove]', e.message); }
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

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err?.message || err);
});

server.listen(PORT, () => console.log(`\n✈️  TripPlanner v3  →  http://localhost:${PORT}\n`));
