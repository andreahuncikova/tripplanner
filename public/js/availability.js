// ── Trip window ───────────────────────────────────────

function renderTripWindowSetter() {
  const bar = document.getElementById('trip-window-bar');
  if (!bar) return;
  const g  = currentGroup;
  const ws = g.tripWindowStart || '';
  const we = g.tripWindowEnd   || '';

  const label = `<div class="text-[10px] font-semibold text-muted uppercase tracking-[.07em] mb-2">Trip window</div>`;
  if (isAdmin()) {
    bar.innerHTML = label + `
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-1.5 flex-wrap">
          <select id="tw-start" class="select-ghost" style="font-size:12px;flex:1">${monthOpts(ws ? ws.slice(0,7) : '')}</select>
          <span class="text-xs text-muted flex-shrink-0">–</span>
          <select id="tw-end" class="select-ghost" style="font-size:12px;flex:1">${monthOpts(we ? we.slice(0,7) : '')}</select>
        </div>
        <button class="inline-flex items-center justify-center border-none rounded-lg px-3 py-2 bg-accent text-white text-[12px] font-semibold cursor-pointer transition-all hover:bg-[#C44A22] w-full" onclick="setTripWindow()">${ws && we ? 'Update window' : 'Set window'}</button>
        ${ws && we ? `<div class="text-[13px] font-semibold text-blue">${fmtMonthRange(ws, we)}</div>` : ''}
      </div>`;
  } else if (ws && we) {
    bar.innerHTML = label + `<div class="text-[15px] font-bold text-blue">${fmtMonthRange(ws, we)}</div>`;
  } else {
    bar.innerHTML = '';
  }
}

function monthOpts(selectedYM, count = 18) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '00')}`;
    return `<option value="${val}"${val === selectedYM ? ' selected' : ''}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`;
  }).join('');
}

function fmtMonthRange(ws, we) {
  const s  = new Date(ws + 'T12:00:00');
  const e  = new Date(we + 'T12:00:00');
  const sm = MONTHS[s.getMonth()], em = MONTHS[e.getMonth()];
  const sy = s.getFullYear(),      ey = e.getFullYear();
  if (sy === ey) return sm === em ? `${sm} ${sy}` : `${sm} – ${em} ${sy}`;
  return `${sm} ${sy} – ${em} ${ey}`;
}

function setTripWindow() {
  const fromM = document.getElementById('tw-start')?.value;
  const toM   = document.getElementById('tw-end')?.value;
  if (!fromM) return;
  const endMonth = (toM && toM >= fromM) ? toM : fromM;
  const [ty, tm] = endMonth.split('-').map(Number);
  const lastDay  = new Date(ty, tm, 0);
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
  socket?.emit('trip:setWindow', { start: fromM + '-01', end });
}

function jumpToWindow() {
  const g = currentGroup;
  if (!g.tripWindowStart) return;
  const ws  = new Date(g.tripWindowStart + 'T12:00:00');
  const we  = g.tripWindowEnd ? new Date(g.tripWindowEnd + 'T12:00:00') : ws;
  const cur = calY * 12 + calM;
  const min = ws.getFullYear() * 12 + ws.getMonth();
  const max = we.getFullYear() * 12 + we.getMonth();
  if (cur < min || cur > max) { calY = ws.getFullYear(); calM = ws.getMonth(); }
}

// ── Availability calendar ─────────────────────────────

function monthEnd(dateStr) {
  if (!dateStr) return dateStr;
  const d    = new Date(dateStr + 'T12:00:00');
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`;
}

function renderCal() {
  document.getElementById('cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g  = currentGroup;
  const ws = g.tripWindowStart;
  const we = monthEnd(g.tripWindowEnd);

  buildGrid('cal-grid', (key, el) => {
    if ((ws && key < ws) || (we && key > we)) {
      el.className = 'aspect-square rounded-lg text-ink/20 cursor-default pointer-events-none border border-transparent bg-transparent';
      return;
    }
    if (myUnavail.has(key))     el.classList.add('!bg-accent/10', '!border-accent/40', 'text-accent', 'font-semibold');
    if (key === selectedCalDay) el.classList.add('!bg-deep', '!text-white', '!border-deep', 'font-bold', 'shadow-[0_2px_10px_rgba(24,24,27,.25)]');

    el.addEventListener('click', () => { selectedCalDay = key; toggleUnavail(key, el); });

    const dotRow = document.createElement('div');
    dotRow.className = 'absolute bottom-[3px] flex gap-[2px]';
    (currentGroup.availability || []).forEach(a => {
      if (a.username === me.username) return;
      const dot = document.createElement('div');
      dot.className = 'w-1 h-1 rounded-full';
      dot.style.background = a.unavailableDates.includes(key) ? '#E8572A' : 'rgba(0,0,0,.12)';
      dotRow.appendChild(dot);
    });
    el.appendChild(dotRow);
  });

  renderCalDayPanel();
}

function toggleUnavail(key, el) {
  if (myUnavail.has(key)) {
    myUnavail.delete(key);
    el.classList.remove('!bg-accent/10', '!border-accent/40', 'text-accent', 'font-semibold');
  } else {
    myUnavail.add(key);
    el.classList.add('!bg-accent/10', '!border-accent/40', 'text-accent', 'font-semibold');
  }
  socket?.emit('avail:set', [...myUnavail]);
  renderCal();
}

function renderCalDayPanel() {
  const titleEl   = document.getElementById('avail-day-title');
  const membersEl = document.getElementById('avail-day-members');
  if (!titleEl || !membersEl) return;

  if (!selectedCalDay) {
    titleEl.textContent = '—';
    membersEl.innerHTML = '';
    return;
  }

  const d        = new Date(selectedCalDay + 'T12:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  titleEl.textContent = `${dayNames[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  const avl = currentGroup.availability || [];
  if (!avl.length) { membersEl.innerHTML = '<p class="text-muted text-sm">No members yet</p>'; return; }

  membersEl.innerHTML = avl.map(a => {
    const unavail = a.unavailableDates.includes(selectedCalDay);
    const isMe    = a.username === me.username;
    return `<div class="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm transition-all ${unavail ? 'border-accent/25 bg-accent/[.05]' : 'border-green/25 bg-green/[.05]'}">
      <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${a.color || '#888'}"></span>
      <span class="flex-1 font-medium text-ink text-[13px]">${esc(a.username)}${isMe ? ' <span class="text-muted font-normal">(you)</span>' : ''}</span>
      <span class="text-[11px] font-semibold ${unavail ? 'text-accent' : 'text-green'}">${unavail ? IC.x : IC.check}</span>
    </div>`;
  }).join('');
}

function renderCalAdminBar() {
  const el = document.getElementById('cal-admin-bar');
  const inOverride = localPhaseOverride === 'calendar';
  if (!isAdmin() || (!inOverride && currentGroup.phase !== 'calendar')) {
    el.innerHTML = '';
    return;
  }
  const label = inOverride ? 'Recalculate dates' : 'Calculate dates';
  el.className = 'px-4 py-3 flex-shrink-0 flex items-center gap-2.5';
  el.innerHTML = `<button class="inline-flex items-center gap-1.5 bg-accent text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#C44A22] hover:-translate-y-px" onclick="computeDates()">${label} ${IC.arrowR}</button><span class="text-[11px] text-muted">Admin only</span>`;
}

function computeDates() {
  pendingOverrideTarget = 'date_vote';
  socket?.emit('avail:compute');
}

function renderCalReadyBar() {
  const el = document.getElementById('cal-ready-bar');
  if (!el) return;
  if (isAdmin() || currentGroup.phase !== 'calendar') { el.innerHTML = ''; return; }

  const ready = (currentGroup.availabilityReady || []).includes(me.username);
  if (ready) {
    el.innerHTML = `
      <div class="flex items-center gap-2 bg-green/[.07] border border-green/30 rounded-xl px-4 py-3">
        <span class="text-green flex-1 text-[13px] font-semibold flex items-center gap-1.5">${IC.check} Marked as done</span>
        <button onclick="socket?.emit('avail:unready')" class="text-[11px] text-muted hover:text-ink cursor-pointer transition-colors border-none bg-transparent">Undo</button>
      </div>`;
  } else {
    el.innerHTML = `
      <button onclick="socket?.emit('avail:ready')" class="w-full py-3 rounded-xl bg-accent text-white border-none text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#C44A22] hover:-translate-y-px">
        I'm done marking my days
      </button>`;
  }
}
