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

  // build the 4 step nodes separated by connectors
  const stepsHtml = [];
  PHASE_ORDER.forEach((phase, i) => {
    const done    = i < actualIdx;
    const current = i === viewIdx;
    const future  = i > actualIdx;

    let circle, labelCls;
    if (current) {
      circle   = `<span class="w-6 h-6 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">${done || i < actualIdx ? IC.check : i + 1}</span>`;
      labelCls = 'text-ink font-semibold';
    } else if (done) {
      circle   = `<span class="w-6 h-6 rounded-full bg-green/15 text-green flex items-center justify-center flex-shrink-0">${IC.check}</span>`;
      labelCls = 'text-muted';
    } else {
      circle   = `<span class="w-6 h-6 rounded-full border border-rim text-muted/40 text-[10px] flex items-center justify-center flex-shrink-0">${i + 1}</span>`;
      labelCls = 'text-muted/40';
    }

    const clickable       = done && isAdmin();
    const memberClickable = done && !isAdmin();
    const btn = `<button
      class="flex items-center gap-1.5 ${clickable || memberClickable ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} transition-opacity"
      ${clickable       ? `onclick="jumpToPhase(${i})"` : ''}
      ${memberClickable ? `onclick="showBackRequestModal(${i})"` : ''}>
      ${circle}
      <span class="text-[11px] ${labelCls} hidden md:inline">${STEP_LABELS[i]}</span>
    </button>`;
    stepsHtml.push(btn);

    if (i < PHASE_ORDER.length - 1) {
      const connectorColor = i < actualIdx ? 'bg-green/30' : 'bg-rim';
      stepsHtml.push(`<div class="h-px ${connectorColor} flex-1 max-w-10 min-w-3"></div>`);
    }
  });

  // left side: back button — only admin can navigate back
  const canGoBack = viewIdx > 0 && isAdmin();
  const backLabel = isAdmin() && !inOverride ? `${IC.arrowL} Back` : `${IC.arrowL} Back`;
  const backBtn = canGoBack
    ? `<button class="flex items-center gap-1 text-[11px] font-medium text-muted cursor-pointer hover:text-ink transition-colors flex-shrink-0 mr-2" onclick="goBack()">${backLabel}</button>`
    : `<div class="w-10 mr-2 flex-shrink-0"></div>`;

  // right side: "return to current" only when viewing an older phase
  const returnBtn = inOverride
    ? `<button class="flex items-center gap-1 text-[11px] font-semibold text-accent cursor-pointer hover:opacity-70 transition-opacity flex-shrink-0 ml-2" onclick="returnToCurrent()">${IC.arrowR} Current</button>`
    : `<div class="w-10 ml-2 flex-shrink-0"></div>`;

  el.innerHTML = `<div class="flex items-center px-4 py-2.5">
    ${backBtn}
    <div class="flex items-center gap-1.5 flex-1 justify-center">${stepsHtml.join('')}</div>
    ${returnBtn}
  </div>`;
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

  // group name + approved destination (if set)
  const dest = g.approvedDest
    ? ` — ${g.approvedDest}`
    : '';
  document.getElementById('tb-group-name').textContent = (g.name || '') + dest;

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
  }

  if (phase === 'date_vote') {
    document.getElementById('p-datevote').classList.remove('hidden');
    renderHint(phase);
    renderDurSetter();
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
  }
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
      <div class="bg-panel border border-green/45 bg-green/[.05] rounded-xl p-[13px_15px] flex items-center gap-[11px] shadow-soft">
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
    el.innerHTML = '<div class="text-center py-12 text-muted text-sm leading-relaxed">No destinations yet.<br>Be the first to suggest one!</div>';
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
      : `<div class="text-[15px] font-semibold tracking-tight">${esc(d.name)}${approvedBadge}${!approved && win ? `<span class="inline-flex items-center gap-1 text-[10px] bg-green/[.12] text-green border border-green/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.trophy} Winner</span>` : ''}</div>`;

    const borderCls = approved ? 'border-green/50 bg-green/[.04]' : win ? 'border-green/40 bg-green/[.04]' : 'border-rim';
    return `<div class="bg-panel border ${borderCls} rounded-xl p-[13px_15px] flex items-center gap-[11px] transition-all shadow-soft animate-up hover:shadow-md hover:-translate-y-px hover:border-blue/20">
      <div class="text-muted flex-shrink-0">${IC.map}</div>
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

const HINTS = {
  destinations: {
    icon: '🗺️',
    title: 'Vote for a destination',
    desc: 'Suggest a place or heart your favourites. The admin picks the winner.',
    adminDesc: 'Everyone votes, then approve the winning destination to move forward.',
  },
  calendar: {
    icon: '📅',
    title: 'Mark your unavailable days',
    desc: 'Tap any day you <strong>cannot</strong> travel. Leave the days you\'re free blank.',
    adminDesc: 'Once everyone has marked their days, click <strong>"Calculate dates"</strong> to find free windows.',
  },
  date_vote: {
    icon: '🗓️',
    title: 'Vote for a date window',
    desc: 'Pick the window that works best for you. The most popular one wins.',
    adminDesc: (dur) => dur
      ? `Set the trip duration above, then confirm the winning window.`
      : `First set how many days the trip will be, then everyone votes.`,
  },
  done: {
    icon: '🎉',
    title: 'Trip is confirmed!',
    desc: 'Add activities to the itinerary and track shared expenses in the Budget tab.',
    adminDesc: 'Add activities to the itinerary and track shared expenses in the Budget tab.',
  },
};

let pendingBackRequest = null;
let backReqTargetPhase = null;

function renderHint(phase) {
  const hintBar = document.getElementById('hint-bar');
  const g       = currentGroup;
  const h       = HINTS[phase];
  if (!h) { hintBar.innerHTML = ''; return; }

  const inOverride = !!localPhaseOverride;
  const desc = inOverride
    ? `You have temporary edit access. Make your changes, then click <strong>Current</strong> to return.`
    : (isAdmin()
        ? (typeof h.adminDesc === 'function' ? h.adminDesc(g.tripDuration) : h.adminDesc)
        : h.desc);

  hintBar.innerHTML = `
    <div class="px-5 py-3 flex items-start gap-3 border-b border-rim" style="background:rgba(234, 106, 8, 0.07);border-left:4px solid #E8572A">
      <span class="text-[22px] leading-none flex-shrink-0 mt-0.5">${h.icon}</span>
      <div class="flex-1 min-w-0">
        <div class="text-[10px] font-bold uppercase tracking-[.08em] text-orange-600 mb-0.5">How it works</div>
        <div class="text-[13px] font-semibold text-ink">${h.title}</div>
        <div class="text-[12px] text-muted mt-0.5 leading-relaxed">${desc}</div>
      </div>
    </div>`;
}

// ── Back-request modal (member clicks a previous phase step) ──

const BACK_REQ_INFO = {
  destinations: {
    icon: '🗺️',
    desc: 'You can change your destination vote or suggest a new destination. Your request will be sent to the admin for approval.',
  },
  calendar: {
    icon: '📅',
    desc: 'You can update the days when you\'re unavailable for travel. Your request will be sent to the admin for approval.',
  },
  date_vote: {
    icon: '🗓️',
    desc: 'You can change your vote for the preferred date window. Your request will be sent to the admin for approval.',
  },
};

function showBackRequestModal(phaseIdx) {
  const targetPhase = PHASE_ORDER[phaseIdx];
  const info = BACK_REQ_INFO[targetPhase];
  if (!info) return;

  backReqTargetPhase = targetPhase;

  document.getElementById('brm-icon').textContent  = info.icon;
  document.getElementById('brm-title').textContent = `Request access to ${STEP_LABELS[phaseIdx]}`;
  document.getElementById('brm-phase').textContent = STEP_LABELS[phaseIdx];
  document.getElementById('brm-desc').textContent  = info.desc;

  const isPending = pendingBackRequest === targetPhase;
  document.getElementById('brm-state-idle').classList.toggle('hidden', isPending);
  document.getElementById('brm-state-pending').classList.toggle('hidden', !isPending);

  document.getElementById('back-req-modal').classList.remove('hidden');
}

function closeBackReqModal() {
  document.getElementById('back-req-modal').classList.add('hidden');
}

function submitBackRequest() {
  if (!backReqTargetPhase) return;
  pendingBackRequest = backReqTargetPhase;
  socket?.emit('back:request', { targetPhase: backReqTargetPhase });
  document.getElementById('brm-state-idle').classList.add('hidden');
  document.getElementById('brm-state-pending').classList.remove('hidden');
}

// ── Admin back-request approval bar ──────────────────

const PHASE_NAMES = {
  destinations: 'Destinations',
  calendar:     'Availability',
  date_vote:    'Date voting',
  done:         'Trip!',
};

let pendingRequests = []; // [{ username, targetPhase }]

function renderBackRequestBar() {
  const bar = document.getElementById('back-request-bar');
  if (!pendingRequests.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = pendingRequests.map(req => `
    <div class="flex items-center gap-3 px-5 py-2.5 bg-accent/[.06] border-b border-accent/20 flex-wrap">
      <span class="text-[13px] font-semibold text-ink flex-1 min-w-0">
        ${IC.warn} <strong>${esc(req.username)}</strong> wants to go back to <strong>${PHASE_NAMES[req.targetPhase] || req.targetPhase}</strong>
      </span>
      <div class="flex gap-2 flex-shrink-0">
        <button onclick="approveBack('${esc(req.username)}','${req.targetPhase}')" class="px-3 py-1.5 rounded-lg bg-green text-white border-none text-[11px] font-semibold cursor-pointer hover:bg-[#4a8040] transition-colors">${IC.check} Approve</button>
        <button onclick="denyBack('${esc(req.username)}')" class="px-3 py-1.5 rounded-lg border border-rim bg-transparent text-muted text-[11px] font-semibold cursor-pointer hover:text-ink transition-colors">${IC.x} Deny</button>
      </div>
    </div>`).join('');
}

function approveBack(username, targetPhase) {
  socket?.emit('back:approve', { targetUsername: username, targetPhase });
}

function denyBack(username) {
  socket?.emit('back:deny', { targetUsername: username });
}
