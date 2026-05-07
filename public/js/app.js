// ════════════════════════════════════════════════════════
//  TripPlanner — Frontend
// ════════════════════════════════════════════════════════

// ── State ─────────────────────────────────────────────
let token        = localStorage.getItem('tp_token')  || null;
let me           = JSON.parse(localStorage.getItem('tp_me') || 'null');
let socket       = null;
let currentCode  = null;
let currentGroup = null;   // latest state from server
let myUnavail       = new Set();
let calY, calM;
let selectedDoneDay = null;
let selectedCalDay  = null;

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
    const lastGroup = localStorage.getItem('tp_last_group');
    const pending   = localStorage.getItem('tp_pending_code');
    if (lastGroup && !urlCode) {
      // Auto-reconnect to last open group
      currentCode = lastGroup;
      initSocket(lastGroup);
      showScreen('app');
    } else {
      showDash();
      if (pending) {
        localStorage.removeItem('tp_pending_code');
        document.getElementById('join-code-input').value = pending;
        showJoinModal();
      }
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
        <div class="gi-meta">${g.tripDuration ? g.tripDuration + ' days · ' : ''}code: ${g.inviteCode}</div>
      </div>
      <span class="gi-phase">${PHASE_LABELS[g.phase] || g.phase}</span>
    </div>
  `).join('');
}

async function createGroup() {
  const name = document.getElementById('new-group-name').value.trim();
  if (!name) return modalErr('create-modal-error', 'Enter a group name');
  const r = await api('/api/groups', 'POST', { name });
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
  localStorage.removeItem('tp_last_group');
  showDash();
}

function dashErr(msg) {
  const el = document.getElementById('dash-error');
  if (el) { el.textContent = msg; setTimeout(() => { el.textContent = ''; }, 4000); }
}

// ── SOCKET ────────────────────────────────────────────
function initSocket(code) {
  localStorage.setItem('tp_last_group', code.toUpperCase());

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
  socket.on('err', msg => {
    // If error happens before group data loaded (e.g. group not found on auto-reconnect)
    if (!currentGroup?.phase) {
      localStorage.removeItem('tp_last_group');
      showDash();
    } else {
      alert(msg);
    }
  });

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
  socket.on('activity:new', act   => { currentGroup.activities.push(act); renderActivities(); renderDoneCal(); });
  socket.on('activity:suggestions', ({ dest, suggestions }) => renderAiChips(suggestions));
  socket.on('expense:new',     exp => { if (!currentGroup.expenses) currentGroup.expenses = []; currentGroup.expenses.push(exp); renderExpenses(); });
  socket.on('expense:removed', id  => { currentGroup.expenses = (currentGroup.expenses||[]).filter(e => String(e._id) !== String(id)); renderExpenses(); });
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
    hintBar.textContent = `📅 Click days when you CAN'T go. ${isAdmin() ? 'Once everyone marks their days, click "Calculate dates".' : 'Waiting for others to mark their days.'}`;
    renderCal();
    renderMembersLegend();
    renderCalAdminBar();
  }
  if (phase === 'date_vote') {
    document.getElementById('p-datevote').classList.remove('hidden');
    const dur = g.tripDuration;
    if (isAdmin()) {
      hintBar.textContent = dur
        ? `🗳️ Trip duration set to ${dur} days. Vote and confirm a date below.`
        : '🗳️ Set your trip duration below, then vote and confirm a date.';
    } else {
      hintBar.textContent = dur
        ? `🗳️ Trip duration: ${dur} days. Vote for your preferred date window.`
        : '🗳️ Vote for your preferred date window. Admin will set the final trip duration.';
    }
    renderDurSetter();
    renderRanges();
  }
  if (phase === 'done') {
    document.getElementById('p-done').classList.remove('hidden');
    hintBar.textContent = `🎉 Trip confirmed: ${g.finalDateLabel || g.finalDate}. Add activities and track expenses!`;
    renderDoneBanner();
    renderDoneCal();
    renderActivities();
    renderExpenses();
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
    if (key === selectedCalDay) el.classList.add('dc-selected');
    el.addEventListener('click', () => {
      selectedCalDay = key;
      toggleUnavail(key, el);
    });
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
  renderCalDayPanel();
}

function toggleUnavail(key, el) {
  if (myUnavail.has(key)) { myUnavail.delete(key); el.classList.remove('unavail'); }
  else                     { myUnavail.add(key);    el.classList.add('unavail');    }
  socket?.emit('avail:set', [...myUnavail]);
  renderCal();
}

function renderCalDayPanel() {
  const titleEl   = document.getElementById('avail-day-title');
  const membersEl = document.getElementById('avail-day-members');
  if (!titleEl || !membersEl) return;

  if (!selectedCalDay) {
    titleEl.textContent  = 'Select a day';
    membersEl.innerHTML  = '';
    return;
  }

  const d        = new Date(selectedCalDay + 'T12:00:00');
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  titleEl.textContent = `${dayNames[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  const avl = currentGroup.availability || [];
  if (!avl.length) { membersEl.innerHTML = '<p class="done-day-empty">No members yet</p>'; return; }

  membersEl.innerHTML = avl.map(a => {
    const unavail = a.unavailableDates.includes(selectedCalDay);
    const isMe    = a.username === me.username;
    return `<div class="avail-member-row ${unavail ? 'unavail-row' : 'avail-row'}">
      <span class="avail-member-dot" style="background:${a.color||'#888'}"></span>
      <span class="avail-member-name">${esc(a.username)}${isMe ? ' (you)' : ''}</span>
      <span class="avail-member-status">${unavail ? '✗ unavailable' : '✓ available'}</span>
    </div>`;
  }).join('');
}

function renderMembersLegend() {
  renderCalDayPanel();
}

function renderCalAdminBar() {
  const el = document.getElementById('cal-admin-bar');
  if (!isAdmin()) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button onclick="computeDates()">📅 Calculate dates →</button>
    <span class="hint">Only admin can proceed</span>`;
}
function computeDates() { socket?.emit('avail:compute'); }

// ── TRIP DURATION SETTER (date_vote phase) ────────────
function renderDurSetter() {
  const el = document.getElementById('dur-setter-bar');
  if (!el) return;
  const g = currentGroup;
  const dur = g.tripDuration;

  if (isAdmin()) {
    el.innerHTML = `
      <div class="dur-setter">
        <span class="dur-setter-label">✏️ Trip duration:</span>
        <input id="dur-inp" type="number" min="1" max="60" value="${dur || ''}" placeholder="days"
          class="dur-inp" onkeydown="if(event.key==='Enter')setTripDuration()"/>
        <button class="dur-setter-btn" onclick="setTripDuration()">
          ${dur ? 'Change' : 'Set'}
        </button>
        ${dur ? `<span class="dur-setter-set">${dur} days</span>` : ''}
      </div>`;
  } else if (dur) {
    el.innerHTML = `<div class="dur-setter readonly"><span class="dur-setter-label">📏 Trip duration:</span><span class="dur-setter-set">${dur} days</span></div>`;
  } else {
    el.innerHTML = `<div class="dur-setter readonly"><span class="dur-setter-label" style="color:var(--c-muted)">Admin hasn't set the trip duration yet…</span></div>`;
  }
}

function setTripDuration() {
  const inp = document.getElementById('dur-inp');
  if (!inp) return;
  const val = parseInt(inp.value);
  if (!val || val < 1) return;
  socket?.emit('trip:setDuration', val);
}

// ── DATE RANGES ───────────────────────────────────────
function rangeDays(r) {
  const ms = new Date(r.end) - new Date(r.start);
  return Math.round(ms / 86400000) + 1;
}

function renderRanges() {
  const g  = currentGroup;
  const el = document.getElementById('ranges-list');
  const dur = g.tripDuration;
  const ranges = (g.dateRanges || []).filter(r => !dur || rangeDays(r) >= dur);
  if (!ranges.length) {
    el.innerHTML = dur
      ? `<div class="empty-state">No date windows long enough for ${dur} days.<br>Try changing your unavailable days.</div>`
      : '<div class="empty-state">No common dates.<br>Try changing your unavailable days.</div>';
    return;
  }
  const maxV = Math.max(...ranges.map(r => r.votes.length), 1);
  el.innerHTML = ranges.map((r, i) => {
    const origIdx = g.dateRanges.indexOf(r);
    const voted = r.votes.includes(me.username);
    const top   = r.votes.length === Math.max(...ranges.map(x => x.votes.length)) && r.votes.length > 0;
    const pct   = Math.round((r.votes.length / maxV) * 100);
    return `<div class="range-card ${voted?'voted':''} ${top?'top':''}" onclick="rangeVote(${origIdx})">
      <div class="rc-label">${esc(r.label)}</div>
      <div class="rc-voters">${r.votes.length ? r.votes.map(esc).join(', ') : 'Nobody yet'}</div>
      <div class="rc-bar-wrap"><div class="rc-bar" style="width:${pct}%"></div></div>
      <div class="rc-count">${r.votes.length} votes</div>
      ${isAdmin() && top && g.tripDuration ? `<button class="rc-confirm" onclick="event.stopPropagation();rangeConfirm(${origIdx})">✅ Confirm this date</button>` : ''}
      ${isAdmin() && top && !g.tripDuration ? `<div class="rc-confirm-hint">⚠️ Set the trip duration first</div>` : ''}
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
  const actsByDate = {};
  (g.activities || []).forEach(a => {
    if (a.calDate) (actsByDate[a.calDate] = actsByDate[a.calDate] || []).push(a);
  });
  buildGrid('done-cal-grid', (key, el) => {
    if (key === g.finalDate) { el.classList.add('final'); }
    else if (g.finalDate && inRange(key, g.finalDate, g.tripDuration)) { el.classList.add('in-range'); }
    if (key === selectedDoneDay) { el.classList.add('dc-selected'); }
    const count = actsByDate[key]?.length || 0;
    if (count) {
      const dots = document.createElement('div');
      dots.className = 'dc-dots';
      for (let i = 0; i < Math.min(count, 3); i++) {
        const dot = document.createElement('span');
        dot.className = 'dc-dot';
        dots.appendChild(dot);
      }
      el.appendChild(dots);
    }
    el.addEventListener('click', () => selectDoneDay(key));
  });
  renderDayPanel();
}

function selectDoneDay(key) {
  selectedDoneDay = key;
  renderDoneCal();
}

function renderDayPanel() {
  const titleEl   = document.getElementById('done-day-title');
  const actsEl    = document.getElementById('done-day-acts');
  const addBtn    = document.getElementById('done-day-add-btn');
  if (!selectedDoneDay) {
    titleEl.textContent = 'Select a day';
    actsEl.innerHTML    = '<p class="done-day-empty">—</p>';
    addBtn.classList.add('hidden');
    return;
  }
  const d        = new Date(selectedDoneDay + 'T12:00:00');
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  titleEl.textContent = `${dayNames[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  addBtn.classList.remove('hidden');

  const g      = currentGroup;
  const acts   = (g.activities || []).filter(a => a.calDate === selectedDoneDay)
    .sort((a, b) => (a.calTime || '').localeCompare(b.calTime || ''));
  if (!acts.length) {
    actsEl.innerHTML = '<p class="done-day-empty">Nothing scheduled</p>';
    return;
  }
  actsEl.innerHTML = acts.map(a => `
    <div class="done-day-act-item">
      ${a.calTime ? `<span class="done-day-act-time">${esc(a.calTime)}</span>` : ''}
      <span class="done-day-act-text">${esc(a.text)}</span>
      <span class="done-day-act-by">— ${esc(a.addedBy)}</span>
    </div>`).join('');
}

function showAddActForDay() {
  showAddActModal(selectedDoneDay);
}

function inRange(key, start, dur) {
  const s = new Date(start), e = new Date(start);
  e.setDate(e.getDate() + (dur||1) - 1);
  const d = new Date(key);
  return d >= s && d <= e;
}

// ── ACTIVITIES ────────────────────────────────────────
function showAddActModal(preDate) {
  const dateSelect = document.getElementById('act-modal-date');
  const timeSelect = document.getElementById('act-modal-time');

  // Populate date dropdown with trip days
  dateSelect.innerHTML = '<option value="">No specific date</option>';
  if (currentGroup?.finalDate && currentGroup?.tripDuration) {
    const start = new Date(currentGroup.finalDate + 'T12:00:00');
    for (let i = 0; i < currentGroup.tripDuration; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en', { weekday:'short', month:'short', day:'numeric' });
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `Day ${i + 1} – ${label}`;
      dateSelect.appendChild(opt);
    }
  }

  // Populate time dropdown (30-min slots 06:00–23:30)
  timeSelect.innerHTML = '<option value="">Any time</option>';
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = val;
      timeSelect.appendChild(opt);
    }
  }

  if (preDate) dateSelect.value = preDate;
  document.getElementById('act-modal-inp').value = '';
  document.getElementById('act-modal-error').textContent = '';
  document.getElementById('act-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('act-modal-inp').focus(), 50);
}

function closeActModal() {
  document.getElementById('act-modal').classList.add('hidden');
}

function actModalSubmit() {
  const text    = document.getElementById('act-modal-inp').value.trim();
  const calDate = document.getElementById('act-modal-date').value || null;
  const calTime = document.getElementById('act-modal-time').value || null;
  if (!text) { document.getElementById('act-modal-error').textContent = 'Enter an activity description'; return; }
  socket?.emit('activity:add', { text, calDate, calTime });
  closeActModal();
}

function renderActivities() {
  renderDoneCal();
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

// ── DONE TABS ─────────────────────────────────────────
function switchDoneTab(tab) {
  document.querySelectorAll('.dtab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.done-tab-pane').forEach(p => p.classList.add('done-tab-hidden'));
  document.getElementById(`dtab-${tab}`).classList.add('active');
  document.getElementById(`done-tab-${tab}`).classList.remove('done-tab-hidden');
}

// ── BUDGET / EXPENSES ─────────────────────────────────
function showAddExpenseModal() {
  const members = currentGroup?.members || [];
  document.getElementById('exp-paidby').innerHTML = members.map(m =>
    `<option value="${esc(m.username)}" ${m.username === me.username ? 'selected' : ''}>${esc(m.username)}</option>`
  ).join('');
  document.getElementById('exp-split-checks').innerHTML = members.map(m => `
    <label class="exp-member-check">
      <input type="checkbox" value="${esc(m.username)}" checked/>
      <span class="exp-member-dot" style="background:${m.color}"></span>
      ${esc(m.username)}
    </label>`).join('');
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  document.getElementById('expense-modal-error').textContent = '';
  document.getElementById('expense-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('exp-desc').focus(), 50);
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

function expenseSubmit() {
  const description = document.getElementById('exp-desc').value.trim();
  const amount      = parseFloat(document.getElementById('exp-amount').value);
  const paidBy      = document.getElementById('exp-paidby').value;
  const splitAmong  = [...document.querySelectorAll('#exp-split-checks input:checked')].map(cb => cb.value);
  if (!description)            { document.getElementById('expense-modal-error').textContent = 'Enter a description'; return; }
  if (!amount || amount <= 0)  { document.getElementById('expense-modal-error').textContent = 'Enter a valid amount'; return; }
  if (!splitAmong.length)      { document.getElementById('expense-modal-error').textContent = 'Select at least one person'; return; }
  socket?.emit('expense:add', { description, amount, paidBy, splitAmong });
  closeExpenseModal();
}

function expenseRemove(id) { socket?.emit('expense:remove', id); }

function renderExpenses() {
  const el       = document.getElementById('expense-list');
  const expenses = currentGroup.expenses || [];
  if (!expenses.length) {
    el.innerHTML = '<div class="empty-state" style="padding:24px 0">No expenses yet. Add the first one!</div>';
    renderBudgetSummary();
    return;
  }
  el.innerHTML = expenses.map(e => {
    const perPerson = (e.amount / (e.splitAmong?.length || 1)).toFixed(2);
    const canDel = e.addedBy === me?.username || currentGroup?.adminUsername === me?.username;
    return `<div class="expense-item">
      <div class="exp-left">
        <div class="exp-av" style="background:${e.paidByColor||'#888'}">${initials(e.paidBy)}</div>
        <div class="exp-info">
          <div class="exp-desc-text">${esc(e.description)}</div>
          <div class="exp-meta">${esc(e.paidBy)} zaplatil · rozdelené na ${e.splitAmong?.length||1} (€${perPerson}/os.)</div>
        </div>
      </div>
      <div class="exp-right">
        <div class="exp-amount-num">€${Number(e.amount).toFixed(2)}</div>
        ${canDel ? `<button class="exp-del" onclick="expenseRemove('${e._id}')">×</button>` : ''}
      </div>
    </div>`;
  }).join('');
  renderBudgetSummary();
}

function renderBudgetSummary() {
  const el       = document.getElementById('budget-summary');
  const expenses = currentGroup.expenses || [];
  if (!expenses.length) { el.innerHTML = ''; return; }

  const balance = {};
  (currentGroup.members || []).forEach(m => { balance[m.username] = 0; });
  expenses.forEach(e => {
    const share = e.amount / (e.splitAmong?.length || 1);
    balance[e.paidBy] = (balance[e.paidBy] || 0) + e.amount;
    (e.splitAmong || []).forEach(u => { balance[u] = (balance[u] || 0) - share; });
  });

  // Compute minimal settlements
  const debtors   = Object.entries(balance).filter(([,b]) => b < -0.01).map(([u,b]) => ({ user:u, amt:-b }));
  const creditors = Object.entries(balance).filter(([,b]) => b >  0.01).map(([u,b]) => ({ user:u, amt:b }));
  const settlements = [];
  const d = debtors.map(x => ({...x})), c = creditors.map(x => ({...x}));
  while (d.length && c.length) {
    const amt = Math.min(d[0].amt, c[0].amt);
    if (amt > 0.01) settlements.push({ from: d[0].user, to: c[0].user, amt });
    d[0].amt -= amt; c[0].amt -= amt;
    if (d[0].amt < 0.01) d.shift();
    if (c[0].amt < 0.01) c.shift();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  el.innerHTML = `
    <div class="budget-summary-box">
      <div class="bs-title">Súhrn</div>
      <div class="bs-total">Celkovo: €${total.toFixed(2)}</div>
      ${settlements.length
        ? `<div class="bs-settle-title">Vyrovnania:</div>
           ${settlements.map(s => `
             <div class="bs-settle-row">
               <span class="bs-from">${esc(s.from)}</span>
               <span class="bs-arrow">→</span>
               <span class="bs-to">${esc(s.to)}</span>
               <span class="bs-amount">€${s.amt.toFixed(2)}</span>
             </div>`).join('')}`
        : '<div class="bs-balanced">Všetko vyrovnané! 🎉</div>'}
    </div>`;
}

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
