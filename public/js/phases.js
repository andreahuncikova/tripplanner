function applyState(data) {
  if (!currentGroup) currentGroup = {};
  Object.assign(currentGroup, data);

  const myA = (data.availability || []).find(a => a.username === me.username);
  myUnavail = new Set(myA?.unavailableDates || []);

  // if the group phase moved past the local override, clear it
  if (localPhaseOverride) {
    const oi = PHASE_ORDER.indexOf(localPhaseOverride);
    const gi = PHASE_ORDER.indexOf(data.phase);
    if (gi <= oi) localPhaseOverride = null;
  }

  renderPhase();
  renderReturnBanner(data.phase);
  renderOnline(data.online || []);
}

function renderPhase() {
  const g           = currentGroup;
  const actualPhase = g.phase;
  const phase       = localPhaseOverride || actualPhase;

  document.getElementById('tb-phase').textContent = PHASE_LABELS[actualPhase] || actualPhase;

  ['destinations', 'calendar', 'datevote', 'done'].forEach(p => {
    document.getElementById(`p-${p}`).classList.add('hidden');
  });

  const hintBar = document.getElementById('hint-bar');

  if (phase === 'destinations') {
    document.getElementById('p-destinations').classList.remove('hidden');
    hintBar.innerHTML = localPhaseOverride
      ? `${IC.map} Viewing destination votes.`
      : `${IC.info} Suggest a destination and vote. Once everyone agrees, the admin approves the winner.`;
    renderDests();
  }

  if (phase === 'calendar') {
    document.getElementById('p-calendar').classList.remove('hidden');
    hintBar.innerHTML = localPhaseOverride
      ? `${IC.calendar} You can update your unavailable days here.`
      : `${IC.calendar} Click days when you CAN'T go. ${isAdmin() ? 'Once everyone marks their days, click "Calculate dates".' : 'Waiting for others to mark their days.'}`;
    renderTripWindowSetter();
    jumpToWindow();
    renderCal();
    renderCalDayPanel();
    renderCalAdminBar();
  }

  if (phase === 'date_vote') {
    document.getElementById('p-datevote').classList.remove('hidden');
    const dur = g.tripDuration;
    if (!localPhaseOverride) {
      hintBar.innerHTML = isAdmin()
        ? (dur ? `${IC.calCheck} Trip duration set to ${dur} days. Vote and confirm a date below.` : `${IC.calCheck} Set your trip duration below, then vote and confirm a date.`)
        : (dur ? `${IC.calCheck} Trip duration: ${dur} days. Vote for your preferred date window.` : `${IC.calCheck} Vote for your preferred date window. Admin will set the final trip duration.`);
    } else {
      hintBar.innerHTML = `${IC.calCheck} Viewing date vote.`;
    }
    renderDurSetter();
    renderRanges();
    renderDateVoteBackBtn();
  }

  if (phase === 'done') {
    document.getElementById('p-done').classList.remove('hidden');
    hintBar.innerHTML = `${IC.sparkles} Trip confirmed: ${esc(g.finalDateLabel || g.finalDate || '')}. Add activities and track expenses!`;
    renderDoneBanner();
    renderDoneCal();
    renderExpenses();
  }
}

function renderReturnBanner(actualPhase) {
  const el = document.getElementById('return-banner');
  if (!el) return;
  if (localPhaseOverride && localPhaseOverride !== actualPhase) {
    const label = PHASE_LABELS[actualPhase] || actualPhase;
    el.innerHTML = `<span>Viewing a previous step</span><button class="bg-accent text-white border-none rounded-[7px] px-[13px] py-[5px] text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap flex-shrink-0 hover:bg-[#C44A22]" onclick="returnToCurrent()">${IC.arrowR} Back to ${label}</button>`;
    el.style.display = 'flex';
  } else {
    el.style.display = 'none';
  }
}

function returnToCurrent() {
  localPhaseOverride = null;
  renderPhase();
  renderReturnBanner(currentGroup.phase);
}

function isAdmin() {
  return currentGroup?.adminUsername === me?.username;
}

function goBack() {
  if (isAdmin()) {
    socket?.emit('phase:back');
  } else {
    // non-admins can browse previous phases locally without affecting others
    const current = localPhaseOverride || currentGroup.phase;
    const idx = PHASE_ORDER.indexOf(current);
    if (idx > 0) {
      localPhaseOverride = PHASE_ORDER[idx - 1];
      renderPhase();
      renderReturnBanner(currentGroup.phase);
    }
  }
}

// ── Destinations ──────────────────────────────────────

function renderDests() {
  const g  = currentGroup;
  const el = document.getElementById('dest-list');

  // once a destination is approved, just show that one
  if (g.phase !== 'destinations') {
    el.innerHTML = `
      <div class="bg-panel border border-green/45 bg-green/[.05] rounded-xl p-[13px_15px] flex items-center gap-[11px] shadow-soft">
        <div class="text-muted flex-shrink-0">${g.approvedDestEmoji || IC.globe}</div>
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
    const voted = d.votes.includes(me.username);
    const pct   = Math.round((d.votes.length / maxV) * 100);
    const win   = i === 0 && d.votes.length > 0;
    return `<div class="bg-panel border ${win ? 'border-green/40 bg-green/[.04]' : 'border-rim'} rounded-xl p-[13px_15px] flex items-center gap-[11px] transition-all shadow-soft animate-up hover:shadow-md hover:-translate-y-px hover:border-blue/20">
      <div class="text-2xl flex-shrink-0">${d.emoji}</div>
      <div class="flex-1 min-w-0">
        <div class="text-[15px] font-semibold tracking-tight">${esc(d.name)}${win ? `<span class="inline-flex items-center gap-1 text-[10px] bg-green/[.12] text-green border border-green/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.trophy} Winner</span>` : ''}</div>
        <div class="text-xs text-muted mt-0.5">Suggested by: ${esc(d.by)}</div>
      </div>
      <div class="flex items-center gap-[7px] flex-shrink-0">
        <div class="w-[52px] h-1 bg-rim rounded-full overflow-hidden"><div class="h-full bg-blue rounded-full transition-[width_.5s]" style="width:${pct}%"></div></div>
        <span class="text-sm font-semibold min-w-4 text-center">${d.votes.length}</span>
        <button class="w-8 h-8 rounded-full border-[1.5px] ${voted ? 'bg-accent border-accent text-white' : 'border-rim bg-transparent text-muted hover:bg-accent/[.08] hover:border-accent/35 hover:text-accent hover:scale-[1.08]'} flex items-center justify-center transition-all cursor-pointer" onclick="destVote('${d._id}')">${voted ? IC.heart : IC.heartO}</button>
        ${isAdmin() ? `<button class="text-[11px] px-2.5 py-[5px] rounded-full border border-green/35 bg-green/[.08] text-green cursor-pointer font-semibold transition-all whitespace-nowrap hover:bg-green/[.18]" onclick="destApprove('${d._id}')">${IC.check} Approve</button>` : ''}
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
