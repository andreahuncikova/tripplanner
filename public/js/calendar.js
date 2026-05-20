// ── Trip window (date range the trip can happen in) ──────

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
          <select id="tw-start" style="font-size:12px;padding:5px 8px;flex:1">${monthOpts(ws ? ws.slice(0,7) : '')}</select>
          <span class="text-xs text-muted flex-shrink-0">–</span>
          <select id="tw-end" style="font-size:12px;padding:5px 8px;flex:1">${monthOpts(we ? we.slice(0,7) : '')}</select>
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
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return `<option value="${val}"${val === selectedYM ? ' selected' : ''}>${MONTHS[d.getMonth()]} ${d.getFullYear()}</option>`;
  }).join('');
}

// "July – August 2025" or "July 2025"
function fmtMonthRange(ws, we) {
  const s  = new Date(ws + 'T12:00:00');
  const e  = new Date(we + 'T12:00:00');
  const sm = MONTHS[s.getMonth()], em = MONTHS[e.getMonth()];
  const sy = s.getFullYear(),      ey = e.getFullYear();
  if (sy === ey) return sm === em ? `${sm} ${sy}` : `${sm} – ${em} ${sy}`;
  return `${sm} ${sy} – ${em} ${ey}`;
}

// kept for use in done banner (shows exact dates)
function fmtWindowLabel(ws, we) {
  const s  = new Date(ws + 'T12:00:00');
  const e  = new Date(we + 'T12:00:00');
  const sy = s.getFullYear(), ey = e.getFullYear();
  return sy === ey
    ? `${s.getDate()} ${MONTHS[s.getMonth()]} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${sy}`
    : `${s.getDate()} ${MONTHS[s.getMonth()]} ${sy} – ${e.getDate()} ${MONTHS[e.getMonth()]} ${ey}`;
}

function setTripWindow() {
  const fromM = document.getElementById('tw-start')?.value; // "YYYY-MM"
  const toM   = document.getElementById('tw-end')?.value;
  if (!fromM) return;
  const endMonth = (toM && toM >= fromM) ? toM : fromM;
  const [ty, tm] = endMonth.split('-').map(Number);
  const lastDay = new Date(ty, tm, 0);
  const end = `${lastDay.getFullYear()}-${String(lastDay.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
  socket?.emit('trip:setWindow', {
    start: fromM + '-01',
    end,
  });
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
  const d = new Date(dateStr + 'T12:00:00');
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

// ── Date voting ───────────────────────────────────────



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

  // Duration card — merged as first item, admin only
  let durCard = '';
  if (isAdmin() && !localPhaseOverride) {
    durCard = `
      <div class="bg-panel border border-rim rounded-xl p-[13px_15px]">
        <div class="text-[11px] font-semibold text-muted uppercase tracking-[.05em] mb-2">${IC.ruler} Trip duration</div>
        <div class="flex items-center gap-2">
          <input id="dur-inp" type="number" min="1" max="60" value="${dur || ''}" placeholder="days"
            style="width:80px;text-align:center"
            onkeydown="if(event.key==='Enter')setTripDuration()"/>
          <button class="inline-flex items-center gap-1 border-none rounded-lg px-3 py-[5px] bg-accent text-white text-[11px] font-semibold cursor-pointer hover:bg-[#C44A22] transition-colors flex-shrink-0" onclick="setTripDuration()">
            ${dur ? 'Update' : 'Set'}
          </button>
          ${dur ? `<span class="text-[12px] text-green font-semibold flex items-center gap-1 flex-shrink-0">${IC.check} ${dur} days</span>` : `<span class="text-[12px] text-muted">Set to filter dates</span>`}
        </div>
      </div>`;
  } else if (!dur) {
    durCard = `<p class="text-center text-[12px] text-muted py-2">Waiting for the admin to set trip duration…</p>`;
  }

  if (!ranges.length) {
    el.innerHTML = durCard + (dur
      ? `<div class="text-center py-10 text-muted text-sm leading-relaxed">No windows long enough for ${dur} days.<br>Try adjusting your unavailable days.</div>`
      : `<div class="text-center py-10 text-muted text-sm leading-relaxed">No common dates yet.</div>`);
    return;
  }

  const maxVotes = Math.max(...ranges.map(r => r.votes.length), 1);

  el.innerHTML = durCard + ranges.map(r => {
    const origIdx = g.dateRanges.indexOf(r);
    const voted   = r.votes.includes(me.username);
    const top     = r.votes.length === Math.max(...ranges.map(x => x.votes.length)) && r.votes.length > 0;
    const pct     = Math.round((r.votes.length / maxVotes) * 100);
    const winDays = rangeDays(r);
    const [datesPart] = r.label.split(' (');

    const windowPill = `<span class="inline-flex items-center gap-1 bg-blue/[.08] text-blue text-[10px] font-semibold px-2 py-0.5 rounded-full">${IC.calendar} ${winDays} days free</span>`;
    const tripPill   = dur ? `<span class="inline-flex items-center gap-1 bg-accent/[.08] text-accent text-[10px] font-semibold px-2 py-0.5 rounded-full">${IC.ruler} ${dur} days trip</span>` : '';
    const borderCls  = top ? 'border-green/35' : 'border-rim';

    return `<div class="bg-panel border ${borderCls} rounded-xl p-[13px_15px] flex items-center gap-[11px] transition-all shadow-soft animate-up hover:shadow-md hover:-translate-y-px hover:border-blue/20">
      <div class="flex-shrink-0 text-muted">${IC.calendar}</div>
      <div class="flex-1 min-w-0">
        <div class="text-[15px] font-semibold tracking-tight">${esc(datesPart)}
          ${top ? `<span class="inline-flex items-center gap-1 text-[10px] bg-accent/[.10] text-accent border border-accent/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.trophy} Top</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-wrap mt-1">${windowPill}${tripPill}</div>
        <div class="text-[11px] text-muted mt-1.5">${r.votes.length ? r.votes.map(esc).join(', ') : 'Nobody yet'}</div>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex-1 h-1 bg-rim rounded-full overflow-hidden"><div class="h-full bg-blue rounded-full transition-[width_.5s]" style="width:${pct}%"></div></div>
          <span class="text-[11px] font-semibold text-muted min-w-4 text-right">${r.votes.length}</span>
        </div>
        ${isAdmin() && top && dur ? `<button class="mt-2.5 inline-flex items-center gap-1.5 bg-accent text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer transition-all hover:bg-[#C44A22] hover:-translate-y-px" onclick="rangeConfirm(${origIdx})">${IC.check} Confirm this date</button>` : ''}
      </div>
      <div class="flex items-center gap-[7px] flex-shrink-0">
        <button class="w-8 h-8 rounded-full border-[1.5px] ${voted ? 'bg-accent border-accent text-white' : 'border-rim bg-transparent text-muted hover:bg-accent/[.08] hover:border-accent/35 hover:text-accent hover:scale-[1.08]'} flex items-center justify-center transition-all cursor-pointer" onclick="rangeVote(${origIdx})">${voted ? IC.heart : IC.heartO}</button>
      </div>
    </div>`;
  }).join('');
}

function rangeVote(i) {
  if (localPhaseOverride) pendingOverrideTarget = null;
  socket?.emit('range:vote', i);
}

function rangeConfirm(origIdx) {
  const g   = currentGroup;
  const r   = g.dateRanges[origIdx];
  const dur = g.tripDuration;
  if (!r) return;
  // if the window is longer than the trip, let the admin pick an exact start
  if (dur && rangeDays(r) > dur) {
    showSubWindowPicker(origIdx, r, dur);
  } else {
    if (localPhaseOverride) pendingOverrideTarget = null;
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
  if (localPhaseOverride) pendingOverrideTarget = null;
  socket?.emit('range:confirm', { idx: origIdx, start });
  closeSubWindowPicker();
}

function closeSubWindowPicker() {
  document.getElementById('subwindow-picker').classList.add('hidden');
}

// ── Done phase – itinerary ────────────────────────────

function renderDoneBanner() {
  document.getElementById('done-dest-banner').innerHTML = '';
}

function renderDoneCal() {
  document.getElementById('done-cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g          = currentGroup;
  const actsByDate = {};
  (g.activities || []).forEach(a => {
    if (a.calDate) (actsByDate[a.calDate] = actsByDate[a.calDate] || []).push(a);
  });

  buildGrid('done-cal-grid', (key, el) => {
    if 
     (g.finalDate && inRange(key, g.finalDate, g.tripDuration)) el.classList.add('!bg-green/[.15]', '!border-green/[.18]');
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

  if (!acts.length) { actsEl.innerHTML = `<p class="text-muted text-sm py-1 flex items-center gap-1.5">${IC.calendar} Nothing scheduled</p>`; return; }

  actsEl.innerHTML = acts.map(a => {
    const canEdit = isAdmin() || a.addedBy === me?.username;
    return `
    <div class="bg-bg border border-rim rounded-xl p-[12px_14px] flex flex-col gap-1.5 text-sm animate-up">
      ${a.calTime ? `<span class="text-[11px] font-semibold text-accent flex items-center gap-1">${IC.clock} ${esc(a.calTime)}</span>` : ''}
      <div class="flex items-start justify-between gap-2">
        <span class="font-medium text-ink leading-snug flex-1">${esc(a.text)}</span>
        ${canEdit ? `
          <div class="flex items-center gap-1 flex-shrink-0">
            <button class="w-6 h-6 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-blue/40 hover:text-blue" onclick="openEditActModal('${a._id}','${esc(a.text).replace(/'/g,"\\'")}','${a.calDate||''}','${a.calTime||''}')">${IC.pencil}</button>
            <button class="w-6 h-6 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-accent/40 hover:text-accent" onclick="confirmThen(this,()=>socket?.emit('activity:remove','${a._id}'))">${IC.x}</button>
          </div>` : ''}
      </div>
      <span class="text-[11px] text-muted">— ${esc(a.addedBy)}</span>
    </div>`;
  }).join('');
}

function showAddActForDay() { showAddActModal(selectedDoneDay); }

function openEditActModal(id, text, calDate, calTime) {
  showAddActModal(calDate || selectedDoneDay, { id, text, calTime });
}

function inRange(key, start, dur) {
  const s = new Date(start), e = new Date(start);
  e.setDate(e.getDate() + (dur || 1) - 1);
  return new Date(key) >= s && new Date(key) <= e;
}

let _editingActId = null;

function showAddActModal(preDate, editData = null) {
  _editingActId = editData?.id || null;
  const isEdit  = !!_editingActId;

  document.getElementById('act-modal-heading').textContent = isEdit ? 'Edit activity' : 'Add activity';
  document.getElementById('act-modal-submit').textContent  = isEdit ? 'Save changes'  : 'Add activity';
  document.getElementById('act-modal-error').textContent   = '';
  document.getElementById('act-modal-inp').value           = editData?.text || '';

  const dateInp  = document.getElementById('act-modal-date');
  const timeInp  = document.getElementById('act-modal-time');
  const pillsEl  = document.getElementById('act-modal-date-pills');

  // Build day pills
  const days = [];
  if (currentGroup?.finalDate && currentGroup?.tripDuration) {
    const start = new Date(currentGroup.finalDate + 'T12:00:00');
    for (let i = 0; i < currentGroup.tripDuration; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push({ key: d.toISOString().split('T')[0], label: d.toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' }), n: i + 1 });
    }
  }

  const selectedDate = preDate || '';
  dateInp.value = selectedDate;

  const renderPills = (sel) => {
    pillsEl.innerHTML = [
      ...days.map(d => {
        const active = sel === d.key;
        return `<button type="button" onclick="actSetDate('${d.key}')" class="flex-shrink-0 flex flex-col items-center px-3 py-[7px] rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${active ? 'bg-accent text-white border-accent' : 'bg-transparent border-rim text-muted hover:border-ink hover:text-ink'}">
          <span class="text-[10px] font-semibold opacity-70 leading-none mb-0.5">Day ${d.n}</span>
          <span>${d.label}</span>
        </button>`;
      })
    ].join('');
  };

  renderPills(selectedDate);
  window._actRenderPills = renderPills;

  timeInp.value = editData?.calTime || '';

  document.getElementById('act-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('act-modal-inp').focus(), 50);
}

function actSetDate(key) {
  document.getElementById('act-modal-date').value = key;
  window._actRenderPills?.(key);
}

function closeActModal() {
  document.getElementById('act-modal').classList.add('hidden');
  _editingActId = null;
}

function actModalSubmit() {
  const text    = document.getElementById('act-modal-inp').value.trim();
  const calDate = document.getElementById('act-modal-date').value || null;
  const calTime = document.getElementById('act-modal-time').value || null;
  if (!text) { document.getElementById('act-modal-error').textContent = 'Enter an activity description'; return; }
  if (_editingActId) {
    socket?.emit('activity:edit', { id: _editingActId, text, calDate, calTime });
  } else {
    socket?.emit('activity:add', { text, calDate, calTime });
  }
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

  const CD_BASE  = 'aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer border border-rim bg-panel text-[13px] font-medium text-ink transition-all relative select-none hover:border-blue/40 hover:bg-blue/[.05] hover:z-[2]';
  const CD_EMPTY = 'aspect-square rounded-xl border border-transparent bg-transparent';
  const CDL_BASE = 'text-center text-[10px] font-semibold text-muted/60 py-1 uppercase tracking-[.06em]';

  const dayNamesEl = document.getElementById(gridId.replace(/-grid$/, '-daynames'));
  if (dayNamesEl) {
    dayNamesEl.innerHTML = '';
    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = CDL_BASE; el.textContent = d;
      dayNamesEl.appendChild(el);
    });
  } else {
    DAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = CDL_BASE; el.textContent = d;
      grid.appendChild(el);
    });
  }

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
