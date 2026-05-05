// ════════════════════════════════════════════════════════
//  TripPlanner — Frontend
// ════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let token        = localStorage.getItem('tp_token')  || null;
let me           = JSON.parse(localStorage.getItem('tp_me') || 'null');
let socket       = null;
let currentCode  = null;
let currentGroup = null;   // latest state from server
let myUnavail    = new Set();
let calY, calM, selectedDur = 3;

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const PHASE_LABELS = {
  destinations: 'Destination voting',
  calendar:     'Availability calendar',
  date_vote:    'Date voting',
  done:         'Trip confirmed! 🎉',
};

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const d = new Date(); calY = d.getFullYear(); calM = d.getMonth();

  // Auth form toggles
  document.querySelectorAll('.ptab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(`f-${t.dataset.tab}`).classList.add('active');
    });
  });

  // Duration buttons
  document.querySelectorAll('.dur').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.dur').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      selectedDur = parseInt(b.dataset.d);
    });
  });

  // Auth forms
  document.getElementById('f-register').addEventListener('submit', e => { e.preventDefault(); authRegister(e.target); });
  document.getElementById('f-login').addEventListener('submit',    e => { e.preventDefault(); authLogin(e.target); });

  // Invite code from URL — store for after login
const urlCode = new URLSearchParams(window.location.search).get('code');

if (urlCode) {
  const code = urlCode.toUpperCase();

  // ak som prihlásený → rovno joinni group
  if (token && me) {
    currentCode = code;
    initSocket(code);
    showScreen('app');
  } else {
    // inak si to len zapamätaj
    localStorage.setItem('tp_pending_code', code);
  }
}

  // Already logged in?
  if (token && me) {
    showDash();
    // Pre-fill join modal with pending code but let user confirm
    const pending = localStorage.getItem('tp_pending_code');
    if (pending) {
      localStorage.removeItem('tp_pending_code');
      document.getElementById('join-code-input').value = pending;
      showJoinModal();
    }
  } else {
    showScreen('auth');
  }
});

// ── AUTH ──────────────────────────────────────────────
async function authRegister(form) {
  const data = { username: form.username.value, email: form.email.value, password: form.password.value };
  const r = await api('/api/auth/register', 'POST', data);
  if (r.error) return setAuthErr(r.error);
  storeAuth(r);
  afterAuthRedirect();
}

async function authLogin(form) {
  const data = { email: form.email.value, password: form.password.value };
  const r = await api('/api/auth/login', 'POST', data);
  if (r.error) return setAuthErr(r.error);
  storeAuth(r);
  afterAuthRedirect();
}

function afterAuthRedirect() {
  showDash();
  const pending = localStorage.getItem('tp_pending_code');
  if (pending) {
    localStorage.removeItem('tp_pending_code');
    document.getElementById('join-code-input').value = pending;
    showJoinModal();
  }
}

async function logout() {
  await api('/api/auth/logout', 'POST');
  token = null; me = null;
  localStorage.removeItem('tp_token'); localStorage.removeItem('tp_me');
  if (socket) { socket.disconnect(); socket = null; }
  showScreen('auth');
}

function storeAuth(r) {
  token = r.token; me = r.user;
  localStorage.setItem('tp_token', token);
  localStorage.setItem('tp_me', JSON.stringify(me));
}

function setAuthErr(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  setTimeout(() => el.textContent = '', 4000);
}

// ── DASHBOARD ─────────────────────────────────────────
async function showDash() {
  document.getElementById('d-username').textContent = me?.username || '';
  showScreen('dash');
  loadMyGroups();
}

async function loadMyGroups() {
  const r = await api('/api/groups');
  if (!r.groups) return;

  const empty = document.getElementById('dash-empty');
  const wrap  = document.getElementById('dash-groups-wrap');
  document.getElementById('de-username').textContent = me?.username || '';

  if (!r.groups.length) {
    empty.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  wrap.classList.remove('hidden');

  document.getElementById('my-groups-list').innerHTML = r.groups.map(g => `
    <div class="group-item" onclick="enterGroupFromDash('${g.inviteCode}')">
      <div>
        <div class="gi-name">${esc(g.name)}</div>
        <div class="gi-meta">${g.tripDuration} days · code: ${g.inviteCode}</div>
      </div>
      <span class="gi-phase">${PHASE_LABELS[g.phase] || g.phase}</span>
    </div>
  `).join('');
}

async function createGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) return modalErr('create-modal-error', 'Enter a group name');
  const r = await api('/api/groups', 'POST', { name, tripDuration: selectedDur });
  if (r.error) return modalErr('create-modal-error', r.error);

  closeCreateModal();
  document.getElementById('new-group-name').value = '';

  currentCode = r.inviteCode;
  const link  = `${location.origin}?code=${r.inviteCode}`;
  document.getElementById('inv-group-name').textContent = name;
  document.getElementById('inv-code').textContent = r.inviteCode;
  document.getElementById('inv-link').textContent = link;
  document.getElementById('modal-code').textContent = r.inviteCode;
  document.getElementById('modal-link').textContent = link;
  showScreen('invite');
}

async function joinByCode() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  if (code.length < 6) return modalErr('join-modal-error', 'Enter a valid invite code');
  const r = await api(`/api/groups/${code}`);
  if (r.error) return modalErr('join-modal-error', r.error);
  closeJoinModal();
  currentCode = code;
  initSocket(code);
}

// ── MODALS ────────────────────────────────────────────
function showCreateModal() {
  document.getElementById('create-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('new-group-name').focus(), 50);
}
function closeCreateModal() { document.getElementById('create-modal').classList.add('hidden'); }

function showJoinModal() {
  document.getElementById('join-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('join-code-input').focus(), 50);
}
function closeJoinModal() { document.getElementById('join-modal').classList.add('hidden'); }

function modalErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

async function enterGroupFromDash(code) {
  currentCode = code;
  initSocket(code);
}

function enterGroup() { initSocket(currentCode); }  // from invite screen

function goToDash() {
  if (socket) { socket.disconnect(); socket = null; }
  currentCode = null; currentGroup = null;
  showDash();
}

function dashErr(msg) {
  const el = document.getElementById('dash-error');
  if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 4000); }
}

// ── SOCKET ────────────────────────────────────────────
function initSocket(code) {

  // CLEAR OLD CHAT + STATE
  document.getElementById('chat-msgs').innerHTML = '';
  document.getElementById('typing-row').innerHTML = '';
  
  currentGroup = null;   // important reset
  
  if (socket) socket.disconnect();
  socket = io({ auth: { token } });

  socket.on('connect', () => {
    setWsStatus(true);
    socket.emit('join', { code });
  });
  socket.on('disconnect', () => setWsStatus(false));
  socket.on('err', msg => alert(msg));

socket.on('joined', data => {
  //  CLEAR previous chat completely
  const chatEl = document.getElementById('chat-msgs');
  chatEl.innerHTML = '';

  // (optional but good) clear typing indicator too
  document.getElementById('typing-row').innerHTML = '';

  // 🧠 reset state properly
  currentGroup = null;

  // apply new group state
  applyState(data);

  // load ONLY this group's messages
  (data.messages || []).forEach(m => appendMsg(m, false));

  document.getElementById('tb-group-name').textContent =
    currentGroup?.name || code;

  showScreen('app');
  document.getElementById('chat-inp').focus();
});

  socket.on('state',        data  => applyState(data));
  socket.on('online',       list  => renderOnline(list));
  socket.on('msg',          m     => appendMsg(m));
  socket.on('dest:new',     dest  => { currentGroup.destinations.push(dest); renderDests(); });
  socket.on('dest:votes',   ({destId, votes}) => {
    const d = currentGroup.destinations.find(x => String(x._id)===String(destId));
    if (d) { d.votes = votes; renderDests(); }
  });
  socket.on('avail:update', ({username, color, unavailableDates}) => {
    let a = currentGroup.availability.find(x => x.username === username);
    if (a) { a.unavailableDates = unavailableDates; a.color = color; }
    else currentGroup.availability.push({ username, color, unavailableDates });
    if (username === me.username) myUnavail = new Set(unavailableDates);
    renderCal(); renderMembersLegend();
  });
  socket.on('range:votes',  ranges => { currentGroup.dateRanges = ranges; renderRanges(); });
  socket.on('activity:new', act   => { currentGroup.activities.push(act); renderActivities(); });
  socket.on('activity:suggestions', ({ dest, suggestions }) => renderAiChips(suggestions));
  socket.on('typing', uname => showTyping(uname));
}

// ── STATE ─────────────────────────────────────────────
function applyState(data) {
  if (!currentGroup) currentGroup = {};
  Object.assign(currentGroup, data);

  // Sync my unavail
  const myA = (data.availability || []).find(a => a.username === me.username);
  myUnavail = new Set(myA?.unavailableDates || []);

  renderPhase();
  renderOnline(data.online || []);
}

function renderPhase() {
  const g = currentGroup;
  const phase = g.phase;

  // Update topbar
  document.getElementById('tb-phase').textContent = PHASE_LABELS[phase] || phase;

  // Show correct panel
  ['destinations','calendar','datevote','done'].forEach(p => {
    document.getElementById(`p-${p}`).classList.toggle('hidden', true);
  });

  const hintBar = document.getElementById('hint-bar');

  if (phase === 'destinations') {
    document.getElementById('p-destinations').classList.remove('hidden');
    hintBar.textContent = '💡 Suggest a destination and vote. Once everyone agrees, the admin approves the winner.';
    renderDests();
  }
  if (phase === 'calendar') {
    document.getElementById('p-calendar').classList.remove('hidden');
    hintBar.textContent = `📅 Click days when you CAN'T go. Trip length: ${g.tripDuration} days. ${isAdmin() ? 'Once everyone marks their days, click "Calculate dates".' : 'Waiting for others to mark their days.'}`;
    renderCal();
    renderMembersLegend();
    renderCalAdminBar();
  }
  if (phase === 'date_vote') {
    document.getElementById('p-datevote').classList.remove('hidden');
    hintBar.textContent = '🗳️ Everyone votes for their preferred date. The admin confirms the result.';
    renderRanges();
  }
  if (phase === 'done') {
    document.getElementById('p-done').classList.remove('hidden');
    hintBar.textContent = `🎉 Trip confirmed: ${g.finalDateLabel || g.finalDate}. Add your activities!`;
    renderDoneBanner();
    renderDoneCal();
    renderActivities();
  }
}

function isAdmin() {
  return currentGroup?.adminUsername === me?.username;
}

// ── DESTINATIONS ──────────────────────────────────────
function renderDests() {
  const g = currentGroup;
  const el = document.getElementById('dest-list');
  const phase = g.phase;

  // In calendar+ phases, show only approved destination
  if (phase !== 'destinations') {
    el.innerHTML = `
      <div class="dest-card approved-only">
        <div class="d-emo">${g.approvedDestEmoji || '🌍'}</div>
        <div class="d-info">
          <div class="d-name">${esc(g.approvedDest || '')} <span class="winner-badge">✅ Approved</span></div>
          <div class="d-by">Group destination</div>
        </div>
      </div>`;
    document.getElementById('dest-add-bar').classList.add('hidden');
    return;
  }

  document.getElementById('dest-add-bar').classList.remove('hidden');
  if (!g.destinations?.length) {
    el.innerHTML = '<div class="empty-state">No destinations yet.<br>Be the first to suggest one! 🌍</div>';
    return;
  }

  const maxV = Math.max(...g.destinations.map(d => d.votes.length), 1);
  const sorted = [...g.destinations].sort((a,b) => b.votes.length - a.votes.length);

  el.innerHTML = sorted.map((d, i) => {
    const voted = d.votes.includes(me.username);
    const pct   = Math.round((d.votes.length / maxV) * 100);
    const win   = i === 0 && d.votes.length > 0;
    return `<div class="dest-card ${win ? 'winner' : ''}">
      <div class="d-emo">${d.emoji}</div>
      <div class="d-info">
        <div class="d-name">${esc(d.name)}${win ? '<span class="winner-badge">🏆 Winner</span>' : ''}</div>
        <div class="d-by">Suggested by: ${esc(d.by)}</div>
      </div>
      <div class="d-right">
        <div class="vbar-wrap"><div class="vbar-fill" style="width:${pct}%"></div></div>
        <span class="vnum">${d.votes.length}</span>
        <button class="vbtn ${voted?'on':''}" onclick="destVote('${d._id}')">${voted?'♥':'♡'}</button>
        ${isAdmin() ? `<button class="approve-btn" onclick="destApprove('${d._id}')">✓ Approve</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function destSuggest() {
  const inp = document.getElementById('dest-inp');
  const v = inp.value.trim();
  if (!v || !socket) return;
  socket.emit('dest:suggest', v);
  inp.value = '';
}
function destVote(id)    { socket?.emit('dest:vote', id); }
function destApprove(id) { socket?.emit('dest:approve', id); }

// ── CALENDAR ──────────────────────────────────────────
function renderCal() {
  document.getElementById('cal-label').textContent = MONTHS[calM] + ' ' + calY;
  buildGrid('cal-grid', (key, el) => {
    if (myUnavail.has(key)) el.classList.add('unavail');
    el.addEventListener('click', () => toggleUnavail(key, el));
    // dots for each other member
    const dotRow = document.createElement('div');
    dotRow.className = 'cd-dots';
    (currentGroup.availability || []).forEach(a => {
      if (a.username === me.username) return;
      const dot = document.createElement('div');
      dot.className = 'cd-dot';
      dot.style.background = a.unavailableDates.includes(key) ? 'var(--c-accent)' : 'rgba(0,0,0,.12)';
      dotRow.appendChild(dot);
    });
    el.appendChild(dotRow);
  });
}

function toggleUnavail(key, el) {
  if (myUnavail.has(key)) { myUnavail.delete(key); el.classList.remove('unavail'); }
  else                     { myUnavail.add(key);    el.classList.add('unavail');    }
  socket?.emit('avail:set', [...myUnavail]);
}

function renderMembersLegend() {
  const el  = document.getElementById('members-legend');
  const avl = currentGroup.availability || [];
  if (!avl.length) { el.innerHTML = '<span style="font-size:12px;color:var(--c-muted)">Waiting…</span>'; return; }
  el.innerHTML = avl.map(a => `
    <div class="ml-row">
      <div class="ml-dot" style="background:${a.color||'#888'}"></div>
      <span>${esc(a.username)}</span>
      <span class="ml-days">${a.unavailableDates.length} unavailable</span>
    </div>`).join('');
}

function renderCalAdminBar() {
  const el = document.getElementById('cal-admin-bar');
  if (!isAdmin()) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button onclick="computeDates()">📅 Calculate dates →</button>
    <span class="hint">Only admin can proceed</span>`;
}
function computeDates() { socket?.emit('avail:compute'); }

// ── DATE RANGES ───────────────────────────────────────
function renderRanges() {
  const g  = currentGroup;
  const el = document.getElementById('ranges-list');
  if (!g.dateRanges?.length) {
    el.innerHTML = '<div class="empty-state">No common dates.<br>Try changing your unavailable days.</div>';
    return;
  }
  const maxV = Math.max(...g.dateRanges.map(r => r.votes.length), 1);
  el.innerHTML = g.dateRanges.map((r, i) => {
    const voted = r.votes.includes(me.username);
    const top   = r.votes.length === Math.max(...g.dateRanges.map(x => x.votes.length)) && r.votes.length > 0;
    const pct   = Math.round((r.votes.length / maxV) * 100);
    return `<div class="range-card ${voted?'voted':''} ${top?'top':''}" onclick="rangeVote(${i})">
      <div class="rc-label">${esc(r.label)}</div>
      <div class="rc-voters">${r.votes.length ? r.votes.map(esc).join(', ') : 'Nobody yet'}</div>
      <div class="rc-bar-wrap"><div class="rc-bar" style="width:${pct}%"></div></div>
      <div class="rc-count">${r.votes.length} votes</div>
      ${isAdmin() && top ? `<button class="rc-confirm" onclick="event.stopPropagation();rangeConfirm(${i})">✅ Confirm this date</button>` : ''}
    </div>`;
  }).join('');
}
function rangeVote(i)    { socket?.emit('range:vote', i); }
function rangeConfirm(i) { socket?.emit('range:confirm', i); }

// ── DONE ──────────────────────────────────────────────
function renderDoneBanner() {
  const g  = currentGroup;
  document.getElementById('done-dest-banner').innerHTML =
    `${g.approvedDestEmoji||'🌍'} ${esc(g.approvedDest||'')} &nbsp;·&nbsp; 📅 ${esc(g.finalDateLabel||g.finalDate||'')}`;
}

function renderDoneCal() {
  document.getElementById('done-cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g = currentGroup;
  buildGrid('done-cal-grid', (key, el) => {
    el.classList.add('done');
    el.style.cursor = 'default';
    if (key === g.finalDate) { el.classList.add('final'); }
    else if (g.finalDate && inRange(key, g.finalDate, g.tripDuration)) { el.classList.add('in-range'); }
  });
}

function inRange(key, start, dur) {
  const s = new Date(start), e = new Date(start);
  e.setDate(e.getDate() + (dur||1) - 1);
  const d = new Date(key);
  return d >= s && d <= e;
}

// ── ACTIVITIES ────────────────────────────────────────
function actAdd() {
  const inp = document.getElementById('act-inp');
  const v = inp.value.trim();
  if (!v || !socket) return;
  socket.emit('activity:add', { text: v, calDate: null });
  inp.value = '';
}
function renderActivities() {
  const el = document.getElementById('act-list');
  const acts = currentGroup.activities || [];
  if (!acts.length) { el.innerHTML = '<div style="font-size:13px;color:var(--c-muted);padding:8px 0">No activities yet</div>'; return; }
  el.innerHTML = acts.map(a => `
    <div class="act-item">
      <span>${esc(a.text)}</span>
      <span class="act-by">— ${esc(a.addedBy)}</span>
    </div>`).join('');
  el.scrollTop = el.scrollHeight;
}
function aiSuggest() { socket?.emit('activity:suggest'); }
function renderAiChips(suggestions) {
  const el = document.getElementById('ai-chips');
  el.innerHTML = suggestions.map(s => `
    <div class="ai-chip" onclick="shareActivity('${esc(s)}')">
      ${esc(s)} <span class="ai-chip-share">→ chat</span>
    </div>`).join('');
}
function shareActivity(text) { socket?.emit('activity:share', text); }

// ── CHAT ──────────────────────────────────────────────
function chatSend() {
  const inp = document.getElementById('chat-inp');
  const v = inp.value.trim();
  if (!v || !socket) return;
  socket.emit('msg', v);
  inp.value = '';
}

function appendMsg(m, animate = true) {
  const el  = document.getElementById('chat-msgs');
  const div = document.createElement('div');

  if (m.system) {
    div.className = 'cmsg sys-wrap';
    div.innerHTML = `<div class="cmsg-bubble sys">${esc(m.text)}</div>`;
  } else {
    const mine = m.username === me?.username;
    div.className = `cmsg${mine?' mine':''}`;
    if (!animate) div.style.animation = 'none';
    div.innerHTML = `
      <div class="cmsg-av" style="background:${m.color||'#888'}">${initials(m.username)}</div>
      <div class="cmsg-body">
        <div class="cmsg-name">${esc(m.username)} · ${m.time}</div>
        <div class="cmsg-bubble">${esc(m.text)}</div>
      </div>`;
  }
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

let typingTimers = {};
function showTyping(uname) {
  const el = document.getElementById('typing-row');
  clearTimeout(typingTimers[uname]);
  el.innerHTML = `${esc(uname)} is typing <span class="tdots"><span></span><span></span><span></span></span>`;
  typingTimers[uname] = setTimeout(() => { el.innerHTML = ''; }, 2500);
}

let myTypingT;
function chatTyping() {
  clearTimeout(myTypingT);
  socket?.emit('typing');
  myTypingT = setTimeout(() => {}, 2000);
}

// ── ONLINE ────────────────────────────────────────────
function renderOnline(list) {
  document.getElementById('online-row').innerHTML = (list||[]).map(u =>
    `<div class="oav" style="background:${u.color}" title="${esc(u.username)}">${initials(u.username)}</div>`
  ).join('');
}

// ── CALENDAR BUILDER ──────────────────────────────────
function buildGrid(gridId, dayFn) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';

  DAYS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cdl'; el.textContent = d;
    grid.appendChild(el);
  });

  const first  = new Date(calY, calM, 1).getDay();
  const offset = (first + 6) % 7;
  const total  = new Date(calY, calM + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div'); el.className = 'cd empty'; grid.appendChild(el);
  }
  for (let d = 1; d <= total; d++) {
    const key = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el  = document.createElement('div');
    el.className = 'cd';
    el.innerHTML = `<span>${d}</span>`;
    dayFn(key, el);
    grid.appendChild(el);
  }
}

function calShift(dir) {
  calM += dir;
  if (calM < 0)  { calM = 11; calY--; }
  if (calM > 11) { calM = 0;  calY++; }
  const phase = currentGroup?.phase;
  if (phase === 'calendar') renderCal();
  if (phase === 'done')     renderDoneCal();
}

// ── INVITE ────────────────────────────────────────────
function showInviteModal() {
  document.getElementById('modal-code').textContent = currentCode;
  document.getElementById('modal-link').textContent = `${location.origin}?code=${currentCode}`;
  document.getElementById('inv-modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('inv-modal').classList.add('hidden'); }
function copyInvite() {
  navigator.clipboard.writeText(`${location.origin}?code=${currentCode}`).then(() => {
    document.querySelectorAll('[onclick="copyInvite()"]').forEach(b => {
      b.textContent = '✅ Copied!';
      setTimeout(() => b.textContent = '📋 Copy link', 2000);
    });
  });
}

// ── WS STATUS ─────────────────────────────────────────
function setWsStatus(on) {
  const el = document.getElementById('ws-pill');
  if (!el) return;
  el.className = `ws-pill${on?'':' off'}`;
  el.innerHTML = `<span class="live-dot"></span> ${on?'Live':'Offline'}`;
}

// ── SCREENS ───────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`s-${name}`).classList.add('active');
}

// ── API HELPER ────────────────────────────────────────
async function api(url, method = 'GET', body) {
  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  } catch { return { error: 'Chyba siete' }; }
}

// ── UTILS ─────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function initials(s) { return String(s||'').slice(0,2).toUpperCase(); }
