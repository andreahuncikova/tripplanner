// ── Phase stepper ─────────────────────────────────────
// Single source of truth for "where am I" and "go back".
// Replaces the scattered back buttons that were in each panel.

const STEP_LABELS = ['Destinations', 'Availability', 'Date voting', 'Trip!'];

function renderPhaseStepper() {
  const el = document.getElementById('phase-stepper');
  if (!el) return;

  const actualIdx  = PHASE_ORDER.indexOf(currentGroup.phase);
  const viewIdx    = PHASE_ORDER.indexOf(localPhaseOverride || currentGroup.phase);
  const inOverride = !!localPhaseOverride;
  const canGoBack  = viewIdx > 0 && isAdmin();

  // build the 4 step nodes separated by connectors
  const stepsHtml = [];
  PHASE_ORDER.forEach((phase, i) => {
    const done    = i < actualIdx;
    const current = i === viewIdx;
    const future  = i > actualIdx;

    let circle, labelCls;
    if (current) {
      circle   = `<span class="w-6 h-6 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 shadow-sm">${i + 1}</span>`;
      labelCls = 'text-ink font-semibold';
    } else if (done) {
      circle   = `<span class="w-6 h-6 rounded-full bg-green text-white flex items-center justify-center flex-shrink-0">${IC.check}</span>`;
      labelCls = 'text-muted';
    } else {
      circle   = `<span class="w-5 h-5 rounded-full border border-rim/60 text-muted/30 text-[10px] flex items-center justify-center flex-shrink-0">${i + 1}</span>`;
      labelCls = 'text-muted/30';
    }

    const clickable = done && isAdmin();
    const btn = `<button
      class="flex items-center gap-1.5 ${clickable ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} transition-opacity"
      ${clickable ? `onclick="jumpToPhase(${i})"` : ''}>
      ${circle}
      <span class="text-[11px] ${labelCls} hidden md:inline">${STEP_LABELS[i]}</span>
    </button>`;
    stepsHtml.push(btn);

    if (i < PHASE_ORDER.length - 1) {
      const connectorColor = i < actualIdx ? 'bg-green/40' : 'bg-rim';
      stepsHtml.push(`<div class="h-[2px] rounded-full ${connectorColor} flex-1 max-w-10 min-w-3"></div>`);
    }
  });

  const backBtn = canGoBack
    ? `<button onclick="goBack()" class="w-7 h-7 rounded-full flex items-center justify-center text-muted border border-rim hover:border-ink hover:text-ink transition-all cursor-pointer flex-shrink-0 mr-2">${IC.arrowL}</button>`
    : `<div class="w-7 mr-2 flex-shrink-0"></div>`;
  const returnBtn = inOverride
    ? `<button onclick="returnToCurrent()" class="w-7 h-7 rounded-full flex items-center justify-center text-accent border border-accent/40 hover:border-accent transition-all cursor-pointer flex-shrink-0 ml-2">${IC.arrowR}</button>`
    : `<div class="w-7 ml-2 flex-shrink-0"></div>`;

  el.innerHTML = `<div class="flex items-center gap-1.5 pointer-events-auto">${backBtn}<div class="flex items-center gap-1.5">${stepsHtml.join('')}</div>${returnBtn}</div>`;
}

// jump to a previous phase locally — admin only
function jumpToPhase(idx) {
  if (!isAdmin()) return;
  if (idx < PHASE_ORDER.indexOf(currentGroup.phase)) {
    localPhaseOverride = PHASE_ORDER[idx];
    renderPhase();
  }
}

// ── State ─────────────────────────────────────────────

function applyState(data) {
  if (!currentGroup) currentGroup = {};
  Object.assign(currentGroup, data);

  const myA = (data.availability || []).find(a => a.username === me.username);
  myUnavail = new Set(myA?.unavailableDates || []);

  if (pendingOverrideTarget !== false) {
    localPhaseOverride = pendingOverrideTarget;
    pendingOverrideTarget = false;
    if (localPhaseOverride === data.phase) localPhaseOverride = null;
  }

  // non-admin members always follow the group phase
  if (localPhaseOverride && !isAdmin()) localPhaseOverride = null;

  // if the group phase moved past our local override, clear it
  if (localPhaseOverride) {
    const oi = PHASE_ORDER.indexOf(localPhaseOverride);
    const gi = PHASE_ORDER.indexOf(data.phase);
    if (gi <= oi) localPhaseOverride = null;
  }

  renderPhase();
  renderOnline(data.online || []);
}

function renderPhase() {
  const g           = currentGroup;
  const actualPhase = g.phase;
  const phase       = localPhaseOverride || actualPhase;

  // group name — destination · date (when confirmed)
  const dest = g.approvedDest ? ` — ${g.approvedDest}` : '';
  const date = (actualPhase === 'done' && g.finalDateLabel) ? ` · ${g.finalDateLabel}` : '';
  document.getElementById('tb-group-name').textContent = (g.name || '') + dest + date;

  ['destinations', 'calendar', 'datevote', 'done'].forEach(p => {
    document.getElementById(`p-${p}`).classList.add('hidden');
  });

  renderPhaseStepper();

  if (phase === 'destinations') {
    document.getElementById('p-destinations').classList.remove('hidden');
    renderHint(phase);
    renderDests();
  }

  if (phase === 'calendar') {
    document.getElementById('p-calendar').classList.remove('hidden');
    renderHint(phase);
    renderTripWindowSetter();
    jumpToWindow();
    renderCal();
    renderCalDayPanel();
    renderCalAdminBar();
    renderCalReadyBar();
  }

  if (phase === 'date_vote') {
    document.getElementById('p-datevote').classList.remove('hidden');
    renderHint(phase);
    // duration input is now merged inside renderRanges()
    renderRanges();
  }

  if (phase === 'done') {
    document.getElementById('p-done').classList.remove('hidden');
    renderHint(phase);
    if (g.finalDate) {
      const fd = new Date(g.finalDate + 'T12:00:00');
      calY = fd.getFullYear();
      calM = fd.getMonth();
    }
    renderDoneBanner();
    renderDoneCal();
    renderExpenses();
    renderPackingList();
  }

  renderReadiness();
}

function returnToCurrent() {
  localPhaseOverride = null;
  renderPhase();
}

function isAdmin() {
  return currentGroup?.adminUsername === me?.username;
}

function goBack() {
  const current = localPhaseOverride || currentGroup.phase;
  const idx     = PHASE_ORDER.indexOf(current);
  if (idx <= 0) return;

  if (!localPhaseOverride && isAdmin()) {
    // admin at actual current phase — this moves the whole group back
    socket?.emit('phase:back');
  } else {
    // everyone else (or admin already in view-override): navigate locally
    localPhaseOverride = PHASE_ORDER[idx - 1];
    renderPhase();
  }
}

// ── Destinations ──────────────────────────────────────

function renderDests() {
  const g  = currentGroup;
  const el = document.getElementById('dest-list');

  // once approved and not viewing in override, just show the winner
  if (g.phase !== 'destinations' && localPhaseOverride !== 'destinations') {
    el.innerHTML = `
      <div class="bg-panel border-2 border-green rounded-xl p-[13px_15px] flex items-center gap-[11px] shadow-[0_0_0_3px_rgba(92,158,80,.18)]">
        <div class="text-muted flex-shrink-0">${IC.globe}</div>
        <div class="flex-1 min-w-0">
          <div class="text-[15px] font-semibold tracking-tight">${esc(g.approvedDest || '')} <span class="text-[10px] bg-green/[.12] text-green border border-green/25 rounded-full px-2 py-0.5 ml-1 font-semibold">${IC.check} Approved</span></div>
          <div class="text-xs text-muted mt-0.5">Group destination</div>
        </div>
      </div>`;
    document.getElementById('dest-add-bar').classList.add('hidden');
    return;
  }

  document.getElementById('dest-add-bar').classList.remove('hidden');

  if (!g.destinations?.length) {
    el.innerHTML = `<div class="text-center py-12 text-muted text-sm leading-relaxed flex flex-col items-center gap-3"><span class="opacity-40">${IC.globe}</span>No destinations yet.<br>Be the first to suggest one!</div>`;
    return;
  }

  // sort so the leading destination is always on top
  const maxV   = Math.max(...g.destinations.map(d => d.votes.length), 1);
  const sorted = [...g.destinations].sort((a, b) => b.votes.length - a.votes.length);

  el.innerHTML = sorted.map((d, i) => {
    const voted    = d.votes.includes(me.username);
    const pct      = Math.round((d.votes.length / maxV) * 100);
    const win      = i === 0 && d.votes.length > 0;
    const approved = g.approvedDest && d.name === g.approvedDest;
    const canEdit  = isAdmin() || d.by === me.username;
    const editing  = destEditingId === String(d._id);

    const approvedBadge = approved
      ? `<span class="inline-flex items-center gap-1 text-[10px] bg-green/[.12] text-green border border-green/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.check} Selected</span>`
      : '';

    const nameHtml = editing
      ? `<div class="flex items-center gap-1.5 mt-0.5">
           <input id="dest-edit-inp" class="flex-1 text-[14px] font-semibold border border-blue/40 rounded-lg px-2 py-0.5 bg-bg" value="${esc(d.name)}" onkeydown="if(event.key==='Enter')destEditSave('${d._id}');if(event.key==='Escape')destEditCancel()"/>
           <button class="text-[11px] px-2 py-0.5 rounded-lg bg-blue text-white border-none cursor-pointer font-semibold hover:bg-[#3a7a8e]" onclick="destEditSave('${d._id}')">Save</button>
           <button class="text-[11px] px-2 py-0.5 rounded-lg border border-rim text-muted cursor-pointer hover:text-ink" onclick="destEditCancel()">Cancel</button>
         </div>`
      : `<div class="text-[15px] font-semibold tracking-tight">${esc(d.name)}${approvedBadge}${!approved && win ? `<span class="inline-flex items-center gap-1 text-[10px] bg-accent/[.10] text-accent border border-accent/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.trophy} Winner</span>` : ''}</div>`;

    const cardIcon = approved ? `<span class="text-green">${IC.globe}</span>`
                   : win      ? `<span class="text-accent">${IC.trophy}</span>`
                   :            `<span class="text-muted">${IC.mapPin}</span>`;
    const borderCls = approved ? 'border-green border-2 shadow-[0_0_0_3px_rgba(92,158,80,.18)]' : win ? 'border-accent/50 border-[1.5px]' : 'border-rim';
    return `<div class="bg-panel border ${borderCls} rounded-xl p-[13px_15px] flex items-center gap-[11px] transition-all shadow-soft animate-up hover:shadow-md hover:-translate-y-px hover:border-blue/20">
      <div class="flex-shrink-0">${cardIcon}</div>
      <div class="flex-1 min-w-0">
        ${nameHtml}
        <div class="text-xs text-muted mt-0.5">Suggested by ${esc(d.by)}</div>
      </div>
      <div class="flex items-center gap-[7px] flex-shrink-0">
        <div class="w-[52px] h-1 bg-rim rounded-full overflow-hidden"><div class="h-full bg-blue rounded-full transition-[width_.5s]" style="width:${pct}%"></div></div>
        <span class="text-sm font-semibold min-w-4 text-center">${d.votes.length}</span>
        <button class="w-8 h-8 rounded-full border-[1.5px] ${voted ? 'bg-accent border-accent text-white' : 'border-rim bg-transparent text-muted hover:bg-accent/[.08] hover:border-accent/35 hover:text-accent hover:scale-[1.08]'} flex items-center justify-center transition-all cursor-pointer" onclick="destVote('${d._id}')">${voted ? IC.heart : IC.heartO}</button>
        ${isAdmin() ? `<button class="text-[11px] px-2.5 py-[5px] rounded-full border border-green/35 bg-green/[.08] text-green cursor-pointer font-semibold transition-all whitespace-nowrap hover:bg-green/[.18]" onclick="destApprove('${d._id}')">${IC.check} Approve</button>` : ''}
        ${canEdit && !editing ? `<button class="w-6 h-6 rounded-full border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-blue/40 hover:text-blue hover:bg-blue/[.06]" onclick="destEditStart('${d._id}')">${IC.pencil}</button>` : ''}
        ${canEdit ? `<button class="w-6 h-6 rounded-full border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-accent/40 hover:text-accent hover:bg-accent/[.06]" onclick="confirmThen(this,()=>socket?.emit('dest:remove','${d._id}'))">${IC.x}</button>` : ''}
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
function destApprove(id) {
  if (localPhaseOverride) pendingOverrideTarget = null;
  socket?.emit('dest:approve', id);
}

function destEditStart(id) {
  destEditingId = String(id);
  renderDests();
  setTimeout(() => document.getElementById('dest-edit-inp')?.focus(), 30);
}

function destEditCancel() {
  destEditingId = null;
  renderDests();
}

function destEditSave(id) {
  const val = document.getElementById('dest-edit-inp')?.value.trim();
  if (!val) return;
  destEditingId = null;
  socket?.emit('dest:edit', { id, name: val });
}

// ── Hint bar ──────────────────────────────────────────

// Accent Lucide icon at 18×18 for the hint bar
function accentIcon(pathData) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8572A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;margin-top:1px">${pathData}</svg>`;
}

const HI = {
  map:      accentIcon('<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/>'),
  calendar: accentIcon('<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>'),
  calCheck: accentIcon('<rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/>'),
  sparkles: accentIcon('<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>'),
  bulb:     accentIcon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
};

const HINTS = {
  destinations: {
    icon: HI.map,
    title: 'Vote for a destination',
    desc: 'Suggest a place or heart your favourites. The admin picks the winner.',
    adminDesc: 'Everyone votes, then approve the winning destination to move forward.',
  },
  calendar: {
    icon: HI.calendar,
    title: 'Mark your unavailable days',
    desc: 'Tap any day you <strong>cannot</strong> travel. Leave the days you\'re free blank.',
    adminDesc: 'Once everyone has marked their days, click <strong>"Calculate dates"</strong> to find free windows.',
  },
  date_vote: {
    icon: HI.calCheck,
    title: 'Vote for a date window',
    desc: 'Pick the window that works best for you. The most popular one wins.',
    adminDesc: (dur) => dur
      ? `Everyone is voting. Confirm the winning window when ready.`
      : `Set the trip duration at the top of the list, then confirm the winning window.`,
  },
  done: {
    icon: HI.sparkles,
    title: 'Trip is confirmed!',
    desc: 'Add activities to the itinerary and track shared expenses in the Budget tab.',
    adminDesc: 'Add activities to the itinerary and track shared expenses in the Budget tab.',
  },
};

function renderReadiness() {
  const panel = document.getElementById('readiness-panel');
  if (!panel) return;
  const phase = localPhaseOverride || currentGroup?.phase;
  const data  = phaseReadiness(phase);
  if (!data) { panel.classList.add('hidden'); return; }

  const doneCount = data.filter(m => m.done).length;
  const allDone   = doneCount === data.length;

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="text-[10px] font-semibold text-muted uppercase tracking-[.06em] mb-2.5">Member progress</div>
    <div class="flex flex-col gap-2">
      ${data.map(m => `
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0" style="background:${m.color}">${initials(m.username)}</div>
          <span class="text-[12px] font-medium text-ink flex-1 truncate">${esc(m.username)}</span>
          <span class="${m.done ? 'text-green' : 'text-muted/40'} flex-shrink-0">${m.done ? IC.check : '○'}</span>
        </div>`).join('')}
    </div>
    <div class="mt-2.5 pt-2.5 border-t border-rim text-[11px] font-semibold ${allDone ? 'text-green' : 'text-muted'}">
      ${allDone ? `${IC.check} All ready` : `${doneCount} of ${data.length} ready`}
    </div>`;
}

function phaseReadiness(phase) {
  const g = currentGroup;
  const members = g.members || [];
  const check = {
    destinations: m => (g.destinations || []).some(d => d.votes.includes(m.username)),
    calendar:     m => (g.availabilityReady || []).includes(m.username),
    date_vote:    m => (g.dateRanges   || []).some(r => r.votes.includes(m.username)),
  };
  const fn = check[phase];
  if (!fn) return null;
  return members.map(m => ({ ...m, done: fn(m) }));
}

function renderHint(phase) {
  const hintContent = document.getElementById('hint-content');
  const g           = currentGroup;
  const h           = HINTS[phase];

  if (!h) { hintContent.innerHTML = ''; return; }

  const inOverride = !!localPhaseOverride;
  const desc = inOverride
    ? `You have temporary edit access. Make your changes and then return to current.`
    : (isAdmin()
        ? (typeof h.adminDesc === 'function' ? h.adminDesc(g.tripDuration) : h.adminDesc)
        : h.desc);

  hintContent.innerHTML = `
    <div class="text-center pointer-events-none" style="max-width:560px">
      <div class="text-[13px] font-semibold text-ink leading-snug">${h.title}</div>
      <div class="text-[12px] text-muted mt-[3px] leading-relaxed">${desc}</div>
    </div>`;
}

// ── Back-request modal (member clicks a previous phase step) ──

