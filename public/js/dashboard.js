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
    <div class="bg-panel border border-rim rounded-xl px-4 py-3.5 cursor-pointer transition-all flex items-center justify-between shadow-soft animate-up hover:border-blue/25 hover:shadow-md hover:-translate-y-px" onclick="enterGroupFromDash('${g.inviteCode}')">
      <div>
        <div class="font-semibold text-sm tracking-tight">${esc(g.name)}</div>
        <div class="text-[11px] text-muted mt-0.5">${g.tripDuration ? g.tripDuration + ' days · ' : ''}code: ${g.inviteCode}</div>
      </div>
      <span class="text-[10px] px-[9px] py-[3px] rounded-full bg-blue/10 text-blue font-semibold tracking-[.01em] whitespace-nowrap">${PHASE_LABELS[g.phase] || g.phase}</span>
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

function goToDash() {
  if (socket) { socket.disconnect(); socket = null; }
  currentCode = null; currentGroup = null;
  localStorage.removeItem('tp_last_group');
  showDash();
}
