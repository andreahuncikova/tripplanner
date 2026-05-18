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

  document.getElementById('my-groups-list').innerHTML = r.groups.map(g => {
    const admin = g.adminUsername === me?.username;
    const deleteIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    const leaveIcon  = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`;
    const monthLabel = dashMonthLabel(g.tripWindowStart, g.tripWindowEnd);
    return `
    <div class="bg-panel border border-rim rounded-xl px-4 py-3.5 transition-all flex items-center justify-between shadow-soft animate-up hover:border-blue/25 hover:shadow-md hover:-translate-y-px" id="dash-card-${g.inviteCode}">
      <div class="min-w-0 flex-1 cursor-pointer" onclick="enterGroupFromDash('${g.inviteCode}')">
        <div class="font-semibold text-sm tracking-tight" id="dash-name-${g.inviteCode}">${esc(g.name)}</div>
        <div class="text-[11px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">
          ${g.tripDuration ? `<span>${g.tripDuration} days</span><span>·</span>` : ''}
          <span id="dash-window-${g.inviteCode}">${monthLabel ? `<span class="text-blue font-medium">${monthLabel}</span>` : g.inviteCode}</span>
          ${!monthLabel ? '' : `<span>·</span><span>${g.inviteCode}</span>`}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0 ml-3">
        <span class="text-[10px] px-[9px] py-[3px] rounded-full bg-blue/10 text-blue font-semibold tracking-[.01em] whitespace-nowrap">${PHASE_LABELS[g.phase] || g.phase}</span>
        ${admin ? `<button class="w-7 h-7 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center transition-all hover:border-blue/40 hover:text-blue flex-shrink-0" title="Change trip months" onclick="dashWindowStart('${g.inviteCode}','${g.tripWindowStart||''}','${g.tripWindowEnd||''}')">${IC.calendar}</button>` : ''}
        ${admin ? `<button class="w-7 h-7 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center transition-all hover:border-blue/40 hover:text-blue flex-shrink-0" title="Rename group" onclick="dashRenameStart('${g.inviteCode}','${esc(g.name)}')">${IC.pencil}</button>` : ''}
        <button
          class="w-7 h-7 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center transition-all hover:border-accent/40 hover:text-accent flex-shrink-0"
          title="${admin ? 'Delete group' : 'Leave group'}"
          onclick="dashGroupAction(this,'${g.inviteCode}',${admin})"
        >${admin ? deleteIcon : leaveIcon}</button>
      </div>
    </div>`;
  }).join('');
}

async function createGroup() {
  const name      = document.getElementById('new-group-name').value.trim();
  const monthFrom = document.getElementById('new-group-month-from').value;
  const monthTo   = document.getElementById('new-group-month-to').value;

  if (!name) return modalErr('create-modal-error', 'Enter a group name');
  const r = await api('/api/groups', 'POST', { name });
  if (r.error) return modalErr('create-modal-error', r.error);

  // store the selected months — socket.js will emit trip:setWindow after joining
  if (monthFrom) {
    const from = monthFrom > (monthTo || '') ? monthTo || monthFrom : monthFrom;
    const to   = monthFrom > (monthTo || '') ? monthFrom : monthTo || monthFrom;
    const [ty, tm] = to.split('-').map(Number);
    pendingTripWindow = {
      start: from + '-01',
      end:   new Date(ty, tm, 0).toISOString().split('T')[0],
    };
  }

  closeCreateModal();
  document.getElementById('new-group-name').value = '';

  // pre-fill invite modal too so it's ready when user opens it later
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

function showCreateModal() {
  document.getElementById('create-modal').classList.remove('hidden');

  // populate month selects with the next 18 months in English
  const now = new Date();
  const opts = Array.from({ length: 18 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `<option value="${val}">${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`;
  }).join('');
  document.getElementById('new-group-month-from').innerHTML = opts;
  document.getElementById('new-group-month-to').innerHTML   = opts;
  document.getElementById('new-group-month-to').selectedIndex = 1; // default to next month

  setTimeout(() => document.getElementById('new-group-name').focus(), 50);
}
function closeCreateModal() { document.getElementById('create-modal').classList.add('hidden'); }

function showJoinModal() {
  document.getElementById('join-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('join-code-input').focus(), 50);
}
function closeJoinModal() { document.getElementById('join-modal').classList.add('hidden'); }

function enterGroupFromDash(code) {
  currentCode = code;
  initSocket(code);
}

function enterGroup() { initSocket(currentCode); }

function dashMonthLabel(ws, we) {
  if (!ws || !we) return '';
  const s = new Date(ws + 'T12:00:00'), e = new Date(we + 'T12:00:00');
  const sm = MONTHS[s.getMonth()], em = MONTHS[e.getMonth()];
  return sm === em ? `${sm} ${s.getFullYear()}` : `${sm} – ${em} ${s.getFullYear()}`;
}

function dashMonthOpts(selectedYM) {
  const now = new Date();
  return Array.from({ length: 24 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `<option value="${val}"${val === selectedYM ? ' selected' : ''}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`;
  }).join('');
}

function dashWindowStart(code, ws, we) {
  const el = document.getElementById(`dash-window-${code}`);
  if (!el) return;
  const selFrom = ws ? ws.slice(0, 7) : '';
  const selTo   = we ? we.slice(0, 7) : '';
  el.innerHTML = `
    <div class="flex items-center gap-1.5 flex-wrap" onclick="event.stopPropagation()">
      <select id="dash-wfrom-${code}" style="padding:2px 5px;font-size:11px;border-radius:6px">${dashMonthOpts(selFrom)}</select>
      <span class="text-muted">–</span>
      <select id="dash-wto-${code}" style="padding:2px 5px;font-size:11px;border-radius:6px">${dashMonthOpts(selTo || selFrom)}</select>
      <button class="text-[11px] px-2 py-0.5 rounded-lg bg-blue text-white border-none cursor-pointer font-semibold hover:bg-[#3a7a8e]" onclick="dashWindowSave('${code}')">Save</button>
      <button class="text-[11px] px-2 py-0.5 rounded-lg border border-rim text-muted cursor-pointer hover:text-ink" onclick="loadMyGroups()">Cancel</button>
    </div>`;
}

async function dashWindowSave(code) {
  const fromM = document.getElementById(`dash-wfrom-${code}`)?.value;
  const toM   = document.getElementById(`dash-wto-${code}`)?.value;
  if (!fromM || !toM) return;
  const start = fromM + '-01';
  const end   = (toM >= fromM ? toM : fromM) + '-01';
  const r = await api(`/api/groups/${code}/window`, 'PATCH', { start, end });
  if (r.error) { alert(r.error); return; }
  loadMyGroups();
}

function dashRenameStart(code, currentName) {
  const nameEl = document.getElementById(`dash-name-${code}`);
  if (!nameEl) return;
  nameEl.innerHTML = `
    <div class="flex items-center gap-1.5" onclick="event.stopPropagation()">
      <input id="dash-rename-inp-${code}" class="flex-1 text-sm font-semibold border border-blue/40 rounded-lg px-2 py-0.5 bg-bg min-w-0"
        value="${esc(currentName)}"
        onkeydown="if(event.key==='Enter')dashRenameSave('${code}');if(event.key==='Escape')loadMyGroups()"/>
      <button class="text-[11px] px-2 py-0.5 rounded-lg bg-blue text-white border-none cursor-pointer font-semibold hover:bg-[#3a7a8e] whitespace-nowrap" onclick="dashRenameSave('${code}')">Save</button>
      <button class="text-[11px] px-2 py-0.5 rounded-lg border border-rim text-muted cursor-pointer hover:text-ink whitespace-nowrap" onclick="loadMyGroups()">Cancel</button>
    </div>`;
  setTimeout(() => {
    const inp = document.getElementById(`dash-rename-inp-${code}`);
    if (inp) { inp.focus(); inp.select(); }
  }, 30);
}

async function dashRenameSave(code) {
  const inp = document.getElementById(`dash-rename-inp-${code}`);
  const name = inp?.value.trim();
  if (!name) return;
  const r = await api(`/api/groups/${code}`, 'PATCH', { name });
  if (r.error) { alert(r.error); return; }
  loadMyGroups();
}

// dashboard group card: leave (member) or delete (admin)
async function dashGroupAction(btn, code, isAdmin) {
  confirmThen(btn, async () => {
    const r = isAdmin
      ? await api(`/api/groups/${code}`, 'DELETE')
      : await api(`/api/groups/${code}/leave`, 'POST');
    if (!r.error) loadMyGroups();
  });
}

// in-app leave/delete (while connected via socket)
function leaveGroupInApp(btn) {
  confirmThen(btn, () => { closeModal(); socket?.emit('group:leave'); });
}
function deleteGroupInApp(btn) {
  confirmThen(btn, () => { closeModal(); socket?.emit('group:delete'); });
}

function goToDash() {
  if (socket) { socket.disconnect(); socket = null; }
  currentCode = null; currentGroup = null;
  localStorage.removeItem('tp_last_group');
  showDash();
}
