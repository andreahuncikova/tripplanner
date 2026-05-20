// ── Date voting ───────────────────────────────────────

let _adminSelectedRange = null;

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

  let durCard = '';
  if (isAdmin() && !localPhaseOverride) {
    if (!dur) {
      durCard = `
        <div class="bg-accent/[.06] border border-accent/30 rounded-xl p-4 flex gap-3 items-start">
          <div class="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0 mt-0.5">${IC.ruler}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[14px] font-bold text-ink mb-0.5">Set trip duration first</div>
            <div class="text-[12px] text-muted mb-3">How many days do you plan to travel? This filters the available date windows.</div>
            <div class="flex items-center gap-2">
              <input id="dur-inp" type="number" min="1" max="60" placeholder="e.g. 7"
                style="width:90px;text-align:center"
                onkeydown="if(event.key==='Enter')setTripDuration()"/>
              <button class="inline-flex items-center gap-1 border-none rounded-lg px-4 py-2 bg-accent text-white text-[13px] font-semibold cursor-pointer hover:bg-[#C44A22] transition-colors" onclick="setTripDuration()">
                Set duration
              </button>
            </div>
          </div>
        </div>`;
    } else {
      durCard = `
        <div class="bg-panel border border-rim rounded-xl p-[13px_15px] flex items-center gap-3">
          <div class="text-[11px] font-semibold text-muted uppercase tracking-[.05em] flex-shrink-0">${IC.ruler} Trip duration</div>
          <span class="text-[13px] font-semibold text-green flex items-center gap-1">${IC.check} ${dur} days</span>
          <div class="flex items-center gap-2 ml-auto">
            <input id="dur-inp" type="number" min="1" max="60" value="${dur}"
              style="width:72px;text-align:center"
              onkeydown="if(event.key==='Enter')setTripDuration()"/>
            <button class="inline-flex items-center gap-1 border-none rounded-lg px-3 py-[5px] bg-transparent border border-rim text-[11px] font-semibold cursor-pointer hover:bg-bg transition-colors text-muted hover:text-ink" style="border:1.5px solid rgba(24,24,27,.12)" onclick="setTripDuration()">Update</button>
          </div>
        </div>`;
    }
  } else if (!dur) {
    durCard = `
      <div class="bg-blue/[.05] border border-blue/20 rounded-xl p-4 flex gap-3 items-center">
        <div class="w-8 h-8 rounded-lg bg-blue/10 flex items-center justify-center text-blue flex-shrink-0">${IC.clock}</div>
        <div>
          <div class="text-[13px] font-semibold text-ink">Waiting for trip duration</div>
          <div class="text-[12px] text-muted mt-0.5">The admin hasn't set how many days the trip will be yet.</div>
        </div>
      </div>`;
  }

  if (!ranges.length) {
    el.innerHTML = durCard + (dur
      ? `<div class="text-center py-10 text-muted text-sm leading-relaxed">No windows long enough for ${dur} days.<br>Try adjusting your unavailable days.</div>`
      : `<div class="text-center py-10 text-muted text-sm leading-relaxed">No common dates yet.</div>`);
    return;
  }

  const maxVotes = Math.max(...ranges.map(r => r.votes.length), 1);

  el.innerHTML = durCard + ranges.map(r => {
    const origIdx  = g.dateRanges.indexOf(r);
    const voted    = r.votes.includes(me.username);
    const topVotes = Math.max(...ranges.map(x => x.votes.length));
    const top      = r.votes.length === topVotes && r.votes.length > 0;
    const pct      = Math.round((r.votes.length / maxVotes) * 100);
    const winDays  = rangeDays(r);
    const [datesPart] = r.label.split(' (');

    const windowPill = `<span class="inline-flex items-center gap-1 bg-blue/[.08] text-blue text-[10px] font-semibold px-2 py-0.5 rounded-full">${IC.calendar} ${winDays} days free</span>`;
    const tripPill   = dur ? `<span class="inline-flex items-center gap-1 bg-accent/[.08] text-accent text-[10px] font-semibold px-2 py-0.5 rounded-full">${IC.ruler} ${dur} days trip</span>` : '';
    const adminSel   = isAdmin() && _adminSelectedRange === origIdx;
    const borderCls  = adminSel ? 'border-blue/50 border-[1.5px]' : top ? 'border-green/35' : 'border-rim';

    const memberDots = (g.members || []).map(m => {
      const hasVoted = r.votes.includes(m.username);
      return `<div title="${esc(m.username)}" class="w-[22px] h-[22px] rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 ${hasVoted ? '' : 'opacity-20'}" style="background:${m.color}">${esc(m.username[0].toUpperCase())}</div>`;
    }).join('');

    const cardClick = isAdmin() ? `onclick="selectRange(${origIdx})"` : '';

    return `<div class="bg-panel border ${borderCls} rounded-xl p-[13px_15px] flex items-center gap-[11px] transition-colors shadow-soft animate-up hover:shadow-md hover:-translate-y-px ${isAdmin() ? 'cursor-pointer' : ''}" ${cardClick}>
      <div class="flex-shrink-0 text-muted">${IC.calendar}</div>
      <div class="flex-1 min-w-0">
        <div class="text-[15px] font-semibold tracking-tight">${esc(datesPart)}
          ${top ? `<span class="inline-flex items-center gap-1 text-[10px] bg-accent/[.10] text-accent border border-accent/25 rounded-full px-2 py-0.5 ml-1.5 font-semibold">${IC.trophy} Top</span>` : ''}
        </div>
        <div class="flex items-center gap-1.5 flex-wrap mt-1">${windowPill}${tripPill}</div>
        <div class="flex items-center gap-2 mt-2">
          <div class="flex items-center gap-1">${memberDots}</div>
          <div class="flex-1 h-1 bg-rim rounded-full overflow-hidden ml-1"><div class="h-full bg-blue rounded-full" style="width:${pct}%"></div></div>
          <span class="text-[11px] font-semibold text-muted w-5 text-right flex-shrink-0">${r.votes.length}</span>
        </div>
        ${adminSel && dur ? `<button class="mt-2.5 inline-flex items-center gap-1.5 border-none rounded-lg px-4 py-[9px] bg-green/[.12] text-green text-[13px] font-semibold cursor-pointer transition-all hover:bg-green/[.20] hover:-translate-y-px" onclick="event.stopPropagation();rangeConfirm(${origIdx})">${IC.calendar} Pick exact dates →</button>` : ''}
      </div>
      <div class="flex items-center gap-[7px] flex-shrink-0">
        <button class="w-8 h-8 rounded-full border-[1.5px] ${voted ? 'bg-accent border-accent text-white' : 'border-rim bg-transparent text-muted hover:bg-accent/[.08] hover:border-accent/35 hover:text-accent hover:scale-[1.08]'} flex items-center justify-center transition-all cursor-pointer" onclick="event.stopPropagation();rangeVote(${origIdx})">${voted ? IC.heart : IC.heartO}</button>
      </div>
    </div>`;
  }).join('');
}

function selectRange(i) {
  if (!isAdmin()) return;
  _adminSelectedRange = _adminSelectedRange === i ? null : i;
  renderRanges();
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
