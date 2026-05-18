// ── Trip window (date range the trip can happen in) ──────

function renderTripWindowSetter() {
  const el = document.getElementById('trip-window-bar');
  if (!el) return;
  const g  = currentGroup;
  const ws = g.tripWindowStart || '';
  const we = g.tripWindowEnd   || '';

  const rangeBadge = ws && we
    ? `<span class="text-[15px] font-bold text-blue tracking-tight">${fmtWindowLabel(ws, we)}</span>`
    : `<span class="text-sm text-muted italic">Not set yet</span>`;

  if (isAdmin() && !localPhaseOverride) {
    el.innerHTML = `
      <div class="flex items-center gap-2.5 px-4 py-2.5 bg-panel border-b border-rim flex-shrink-0 flex-wrap">
        <span class="text-xs font-semibold text-muted uppercase tracking-[.04em] whitespace-nowrap flex items-center gap-1">${IC.calendar} Trip dates</span>
        ${rangeBadge}
        <div class="flex items-center gap-1.5 ml-auto flex-wrap">
          <input type="date" id="tw-start" style="width:auto;padding:5px 9px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer" value="${ws}" />
          <span class="text-sm text-muted">–</span>
          <input type="date" id="tw-end" style="width:auto;padding:5px 9px;font-size:13px;font-weight:500;border-radius:8px;cursor:pointer" value="${we}" />
          <button class="px-[13px] py-[5px] bg-blue text-white border-none rounded-[7px] text-xs font-semibold cursor-pointer transition-all whitespace-nowrap hover:bg-[#3a7a8e] hover:-translate-y-px" onclick="setTripWindow()">${ws && we ? 'Update' : 'Set'}</button>
        </div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="flex items-center gap-2.5 px-4 py-2.5 bg-blue/[.05] border-b border-rim flex-shrink-0 flex-wrap">
        <span class="text-xs font-semibold text-muted uppercase tracking-[.04em] whitespace-nowrap flex items-center gap-1">${IC.calendar} Trip dates</span>
        ${rangeBadge}
      </div>`;
  }
}

function fmtWindowLabel(ws, we) {
  // +12h to avoid timezone edge cases when parsing date-only strings
  const s  = new Date(ws + 'T12:00:00');
  const e  = new Date(we + 'T12:00:00');
  const sy = s.getFullYear(), ey = e.getFullYear();
  return sy === ey
    ? `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${sy}`
    : `${s.getDate()} ${MONTHS[s.getMonth()]} ${sy} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${ey}`;
}

function setTripWindow() {
  const start = document.getElementById('tw-start')?.value;
  const end   = document.getElementById('tw-end')?.value;
  if (!start || !end || start >= end) return;
  socket?.emit('trip:setWindow', { start, end });
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

function renderCal() {
  document.getElementById('cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g  = currentGroup;
  const ws = g.tripWindowStart;
  const we = g.tripWindowEnd;

  buildGrid('cal-grid', (key, el) => {
    if ((ws && key < ws) || (we && key > we)) {
      el.className = 'aspect-square rounded-lg text-ink/20 cursor-default pointer-events-none border border-transparent bg-transparent';
      return;
    }
    if (myUnavail.has(key))     el.classList.add('!bg-accent/10', '!border-accent/40', 'text-accent', 'font-semibold');
    if (key === selectedCalDay) el.classList.add('!bg-deep', '!text-white', '!border-deep', 'font-bold', 'shadow-[0_2px_10px_rgba(24,24,27,.25)]');

    el.addEventListener('click', () => { selectedCalDay = key; toggleUnavail(key, el); });

    // small dots for other members' unavailability
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
    titleEl.textContent = 'Select a day';
    membersEl.innerHTML = '';
    return;
  }

  const d        = new Date(selectedCalDay + 'T12:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  titleEl.textContent = `${dayNames[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  const avl = currentGroup.availability || [];
  if (!avl.length) { membersEl.innerHTML = '<p class="text-muted text-sm py-1">No members yet</p>'; return; }

  membersEl.innerHTML = avl.map(a => {
    const unavail = a.unavailableDates.includes(selectedCalDay);
    const isMe    = a.username === me.username;
    return `<div class="flex items-center gap-[9px] px-[13px] py-[10px] rounded-[10px] border text-sm transition-all ${unavail ? 'border-accent/25 bg-accent/[.05]' : 'border-green/25 bg-green/[.05]'}">
      <span class="w-[9px] h-[9px] rounded-full flex-shrink-0" style="background:${a.color || '#888'}"></span>
      <span class="flex-1 font-medium text-ink">${esc(a.username)}${isMe ? ' (you)' : ''}</span>
      <span class="text-[11px] font-semibold whitespace-nowrap ${unavail ? 'text-accent' : 'text-green'}">${unavail ? `${IC.x} unavailable` : `${IC.check} available`}</span>
    </div>`;
  }).join('');
}

function renderCalAdminBar() {
  const el = document.getElementById('cal-admin-bar');
  const canGoBack        = PHASE_ORDER.indexOf(localPhaseOverride || currentGroup.phase) > 0;
  const isActualCalendar = currentGroup.phase === 'calendar';
  let html = '';
  if (canGoBack) html += `<button class="bg-transparent text-muted border-[1.5px] border-rim rounded-[9px] px-[18px] py-[9px] text-[13px] font-semibold cursor-pointer transition-all hover:bg-bg hover:text-ink" onclick="goBack()">${IC.arrowL} Back</button>`;
  if (isAdmin() && isActualCalendar) html += `<button class="bg-deep text-white border-none rounded-[9px] px-[18px] py-[9px] text-[13px] font-semibold cursor-pointer transition-all tracking-[.01em] hover:bg-[#27272A] hover:-translate-y-px" onclick="computeDates()">Calculate dates ${IC.arrowR}</button><span class="text-[11px] text-muted">Admin only</span>`;
  el.className = 'p-[11px_14px] border-t border-rim bg-panel flex-shrink-0 flex items-center gap-2.5';
  el.innerHTML = html;
}

function computeDates() { socket?.emit('avail:compute'); }

// ── Date voting ───────────────────────────────────────

function renderDateVoteBackBtn() {
  const el = document.getElementById('datevote-back-bar');
  if (!el) return;
  const canGoBack = PHASE_ORDER.indexOf(localPhaseOverride || currentGroup.phase) > 0;
  el.innerHTML = canGoBack
    ? `<button class="bg-transparent border-[1.5px] border-rim rounded-lg px-3 py-[5px] text-xs font-medium text-muted cursor-pointer transition-all hover:border-ink hover:text-ink hover:bg-bg whitespace-nowrap flex-shrink-0" onclick="goBack()">${IC.arrowL} Back</button>`
    : '';
}

function renderDurSetter() {
  const el = document.getElementById('dur-setter-bar');
  if (!el) return;
  const dur    = currentGroup.tripDuration;
  const rowCls = 'flex items-center gap-2.5 px-4 py-3 border-b border-rim flex-shrink-0 flex-wrap';

  if (isAdmin()) {
    el.innerHTML = `
      <div class="${rowCls} bg-panel">
        <span class="text-sm font-semibold text-ink whitespace-nowrap tracking-tight flex items-center gap-1">${IC.pencil} Trip duration:</span>
        <input id="dur-inp" type="number" min="1" max="60" value="${dur || ''}" placeholder="days"
          style="width:80px;padding:7px 10px;border-radius:8px;font-size:14px;font-weight:600;text-align:center"
          onkeydown="if(event.key==='Enter')setTripDuration()"/>
        <button class="px-4 py-[7px] bg-accent text-white border-none rounded-lg text-sm font-semibold cursor-pointer transition-all hover:bg-[#C44A22] hover:-translate-y-px" onclick="setTripDuration()">
          ${dur ? 'Change' : 'Set'}
        </button>
        ${dur ? `<span class="text-[15px] font-semibold text-green">${dur} days</span>` : ''}
      </div>`;
  } else if (dur) {
    el.innerHTML = `<div class="${rowCls} bg-blue/[.04]"><span class="text-sm font-semibold text-ink flex items-center gap-1">${IC.ruler} Trip duration:</span><span class="text-[15px] font-semibold text-green">${dur} days</span></div>`;
  } else {
    el.innerHTML = `<div class="${rowCls} bg-blue/[.04]"><span class="text-sm text-muted">Admin hasn't set the trip duration yet…</span></div>`;
  }
}

function setTripDuration() {
  const inp = document.getElementById('dur-inp');
  if (!inp) return;
  const val = parseInt(inp.value);
  if (!val || val < 1) return;
  socket?.emit('trip:setDuration', val);
}

function rangeDays(r) {
  return Math.round((new Date(r.end) - new Date(r.start)) / 86400000) + 1;
}

function renderRanges() {
  const g      = currentGroup;
  const el     = document.getElementById('ranges-list');
  const dur    = g.tripDuration;
  const ranges = (g.dateRanges || []).filter(r => !dur || rangeDays(r) >= dur);

  if (!ranges.length) {
    el.innerHTML = dur
      ? `<div class="text-center py-12 text-muted text-sm leading-relaxed">No date windows long enough for ${dur} days.<br>Try changing your unavailable days.</div>`
      : '<div class="text-center py-12 text-muted text-sm leading-relaxed">No common dates.<br>Try changing your unavailable days.</div>';
    return;
  }

  const maxVotes = Math.max(...ranges.map(r => r.votes.length), 1);

  el.innerHTML = ranges.map(r => {
    const origIdx = g.dateRanges.indexOf(r);
    const voted   = r.votes.includes(me.username);
    const top     = r.votes.length === Math.max(...ranges.map(x => x.votes.length)) && r.votes.length > 0;
    const pct     = Math.round((r.votes.length / maxVotes) * 100);
    return `<div class="bg-panel border-[1.5px] ${voted ? 'border-blue/40 bg-blue/[.05]' : top ? 'border-green/40 bg-green/[.05]' : 'border-rim'} rounded-xl p-[15px_16px] cursor-pointer transition-all animate-up shadow-soft hover:border-blue/30 hover:-translate-y-px hover:shadow-md" onclick="rangeVote(${origIdx})">
      <div class="text-base font-semibold mb-1.5 tracking-tight">${esc(r.label)}</div>
      <div class="text-[11px] text-muted mb-[9px]">${r.votes.length ? r.votes.map(esc).join(', ') : 'Nobody yet'}</div>
      <div class="h-1 bg-rim rounded-full overflow-hidden mb-[5px]"><div class="h-full bg-blue rounded-full transition-[width_.5s]" style="width:${pct}%"></div></div>
      <div class="text-[11px] text-muted font-medium">${r.votes.length} votes</div>
      ${isAdmin() && top && g.tripDuration  ? `<button class="mt-[11px] bg-green text-white border-none rounded-lg px-[18px] py-2 text-xs font-semibold cursor-pointer transition-all hover:bg-[#4a8040] hover:-translate-y-px" onclick="event.stopPropagation();rangeConfirm(${origIdx})">${IC.check} Confirm this date</button>` : ''}
      ${isAdmin() && top && !g.tripDuration ? `<div class="mt-[9px] text-[11px] text-accent font-semibold">${IC.warn} Set the trip duration first</div>` : ''}
    </div>`;
  }).join('');
}

function rangeVote(i) { socket?.emit('range:vote', i); }

function rangeConfirm(origIdx) {
  const g   = currentGroup;
  const r   = g.dateRanges[origIdx];
  const dur = g.tripDuration;
  if (!r) return;
  // if the window is longer than the trip, let the admin pick an exact start
  if (dur && rangeDays(r) > dur) {
    showSubWindowPicker(origIdx, r, dur);
  } else {
    socket?.emit('range:confirm', { idx: origIdx, start: r.start });
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtShortRange(s, e) {
  return s.getMonth() === e.getMonth()
    ? `${s.getDate()} – ${e.getDate()} ${MONTHS[s.getMonth()]}`
    : `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]}`;
}

function showSubWindowPicker(origIdx, r, dur) {
  const windows  = [];
  const rangeEnd = new Date(r.end + 'T12:00:00');
  const cur      = new Date(r.start + 'T12:00:00');
  while (true) {
    const end = new Date(cur);
    end.setDate(end.getDate() + dur - 1);
    if (end > rangeEnd) break;
    windows.push({ start: dateKey(cur), label: fmtShortRange(cur, end) });
    cur.setDate(cur.getDate() + 1);
  }
  document.getElementById('subwindow-title').textContent = `Choose your exact ${dur}-day window`;
  document.getElementById('subwindow-sub').textContent   = `Available window: ${r.label}`;
  document.getElementById('subwindow-options').innerHTML = windows.map(w => `
    <button class="w-full px-4 py-[13px] text-left bg-bg border-[1.5px] border-rim rounded-[10px] font-semibold text-sm text-ink cursor-pointer transition-all hover:border-accent hover:bg-accent/[.05] hover:text-accent hover:translate-x-0.5" onclick="confirmSubWindow(${origIdx},'${w.start}')">
      ${esc(w.label)}
    </button>`).join('');
  document.getElementById('subwindow-picker').classList.remove('hidden');
}

function confirmSubWindow(origIdx, start) {
  socket?.emit('range:confirm', { idx: origIdx, start });
  closeSubWindowPicker();
}

function closeSubWindowPicker() {
  document.getElementById('subwindow-picker').classList.add('hidden');
}

// ── Done phase – itinerary ────────────────────────────

function renderDoneBanner() {
  const g = currentGroup;
  document.getElementById('done-dest-banner').innerHTML =
    `<div class="px-[18px] py-3 bg-green/[.08] border-b border-green/[.18] flex-shrink-0 text-base font-semibold tracking-tight flex items-center justify-between gap-3">
      <span class="flex items-center gap-2">${g.approvedDestEmoji ? `<span>${g.approvedDestEmoji}</span>` : IC.globe} ${esc(g.approvedDest || '')} <span class="opacity-30">·</span> ${IC.calendar} ${esc(g.finalDateLabel || g.finalDate || '')}</span>
      <button class="bg-transparent border-[1.5px] border-rim rounded-lg px-3 py-[5px] text-xs font-medium text-muted cursor-pointer transition-all hover:border-ink hover:text-ink hover:bg-bg whitespace-nowrap flex-shrink-0" onclick="goBack()">${IC.arrowL} Back</button>
    </div>`;
}

function renderDoneCal() {
  document.getElementById('done-cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g          = currentGroup;
  const actsByDate = {};
  (g.activities || []).forEach(a => {
    if (a.calDate) (actsByDate[a.calDate] = actsByDate[a.calDate] || []).push(a);
  });

  buildGrid('done-cal-grid', (key, el) => {
    if (key === g.finalDate)                                      el.classList.add('!bg-green/15', '!border-green', 'shadow-[0_0_0_2px_rgba(92,158,80,.18)]', 'font-bold');
    else if (g.finalDate && inRange(key, g.finalDate, g.tripDuration)) el.classList.add('!bg-green/[.06]', '!border-green/[.18]');
    if (key === selectedDoneDay)                                  el.classList.add('!bg-deep', '!text-white', '!border-deep', 'font-bold', 'shadow-[0_2px_10px_rgba(24,24,27,.25)]');

    const count = actsByDate[key]?.length || 0;
    if (count) {
      const dots = document.createElement('div');
      dots.className = 'absolute bottom-[5px] flex gap-[3px] items-center';
      for (let i = 0; i < Math.min(count, 3); i++) {
        const dot = document.createElement('span');
        dot.className = 'w-[5px] h-[5px] rounded-full bg-accent opacity-90';
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
  const titleEl = document.getElementById('done-day-title');
  const actsEl  = document.getElementById('done-day-acts');
  const addBtn  = document.getElementById('done-day-add-btn');

  if (!selectedDoneDay) {
    titleEl.textContent = 'Select a day';
    actsEl.innerHTML    = '<p class="text-muted text-sm py-1">—</p>';
    addBtn.classList.add('hidden');
    return;
  }

  const d        = new Date(selectedDoneDay + 'T12:00:00');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  titleEl.textContent = `${dayNames[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  addBtn.classList.remove('hidden');

  const acts = (currentGroup.activities || [])
    .filter(a => a.calDate === selectedDoneDay)
    .sort((a, b) => (a.calTime || '').localeCompare(b.calTime || ''));

  if (!acts.length) { actsEl.innerHTML = '<p class="text-muted text-sm py-1">Nothing scheduled</p>'; return; }

  actsEl.innerHTML = acts.map(a => `
    <div class="bg-bg border border-rim rounded-[10px] p-[11px_13px] flex flex-col gap-1 text-sm animate-up">
      ${a.calTime ? `<span class="text-[11px] font-bold text-accent tracking-[.04em] uppercase">${esc(a.calTime)}</span>` : ''}
      <span class="font-medium text-ink leading-snug">${esc(a.text)}</span>
      <span class="text-[11px] text-muted">— ${esc(a.addedBy)}</span>
    </div>`).join('');
}

function showAddActForDay() { showAddActModal(selectedDoneDay); }

function inRange(key, start, dur) {
  const s = new Date(start), e = new Date(start);
  e.setDate(e.getDate() + (dur || 1) - 1);
  return new Date(key) >= s && new Date(key) <= e;
}

function showAddActModal(preDate) {
  const dateSelect = document.getElementById('act-modal-date');
  const timeSelect = document.getElementById('act-modal-time');

  dateSelect.innerHTML = '<option value="">No specific date</option>';
  if (currentGroup?.finalDate && currentGroup?.tripDuration) {
    const start = new Date(currentGroup.finalDate + 'T12:00:00');
    for (let i = 0; i < currentGroup.tripDuration; i++) {
      const d   = new Date(start);
      d.setDate(d.getDate() + i);
      const key   = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = `Day ${i + 1} – ${label}`;
      dateSelect.appendChild(opt);
    }
  }

  timeSelect.innerHTML = '<option value="">Any time</option>';
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

function closeActModal() { document.getElementById('act-modal').classList.add('hidden'); }

function actModalSubmit() {
  const text    = document.getElementById('act-modal-inp').value.trim();
  const calDate = document.getElementById('act-modal-date').value || null;
  const calTime = document.getElementById('act-modal-time').value || null;
  if (!text) { document.getElementById('act-modal-error').textContent = 'Enter an activity description'; return; }
  socket?.emit('activity:add', { text, calDate, calTime });
  closeActModal();
}

function switchDoneTab(tab) {
  document.querySelectorAll('.dtab').forEach(b => {
    b.classList.remove('text-accent', 'font-semibold');
    b.classList.add('text-muted');
    b.style.borderBottomColor = 'transparent';
  });
  document.querySelectorAll('.done-tab-pane').forEach(p => p.classList.add('done-tab-hidden'));
  const btn = document.getElementById(`dtab-${tab}`);
  btn.classList.remove('text-muted');
  btn.classList.add('text-accent', 'font-semibold');
  btn.style.borderBottomColor = '#E8572A';
  document.getElementById(`done-tab-${tab}`).classList.remove('done-tab-hidden');
}

// ── Grid builder (shared by all calendars) ────────────

function buildGrid(gridId, dayFn) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = '';

  const CD_BASE  = 'aspect-square rounded-lg flex flex-col items-center justify-center cursor-pointer border border-rim bg-panel text-xs font-medium transition-all relative select-none hover:border-blue/40 hover:bg-blue/[.05] hover:z-[2]';
  const CD_EMPTY = 'aspect-square rounded-lg border border-transparent bg-transparent';
  const CDL_BASE = 'text-center text-[10px] font-semibold text-muted py-[5px] uppercase tracking-[.05em]';

  DAYS.forEach(d => {
    const el = document.createElement('div');
    el.className = CDL_BASE; el.textContent = d;
    grid.appendChild(el);
  });

  const first  = new Date(calY, calM, 1).getDay();
  const offset = (first + 6) % 7;
  const total  = new Date(calY, calM + 1, 0).getDate();

  for (let i = 0; i < offset; i++) {
    const el = document.createElement('div'); el.className = CD_EMPTY; grid.appendChild(el);
  }
  for (let d = 1; d <= total; d++) {
    const key = `${calY}-${String(calM + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const el  = document.createElement('div');
    el.className = CD_BASE;
    el.innerHTML = `<span>${d}</span>`;
    dayFn(key, el);
    grid.appendChild(el);
  }
}

function calShift(dir) {
  calM += dir;
  if (calM < 0)  { calM = 11; calY--; }
  if (calM > 11) { calM = 0;  calY++; }

  // clamp to trip window so you can't navigate outside the allowed range
  const g           = currentGroup;
  const displayPhase = localPhaseOverride || g?.phase;
  if (displayPhase === 'calendar' && (g.tripWindowStart || g.tripWindowEnd)) {
    const ym = calY * 12 + calM;
    if (g.tripWindowStart) {
      const ws   = new Date(g.tripWindowStart + 'T12:00:00');
      const minYM = ws.getFullYear() * 12 + ws.getMonth();
      if (ym < minYM) { calY = ws.getFullYear(); calM = ws.getMonth(); }
    }
    if (g.tripWindowEnd) {
      const we   = new Date(g.tripWindowEnd + 'T12:00:00');
      const maxYM = we.getFullYear() * 12 + we.getMonth();
      if (ym > maxYM) { calY = we.getFullYear(); calM = we.getMonth(); }
    }
  }

  if (displayPhase === 'calendar') renderCal();
  if (g?.phase === 'done')         renderDoneCal();
}
