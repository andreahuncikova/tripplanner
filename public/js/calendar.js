// ── Shared calendar grid builder ─────────────────────

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

  const g            = currentGroup;
  const displayPhase = localPhaseOverride || g?.phase;
  if (displayPhase === 'calendar' && (g.tripWindowStart || g.tripWindowEnd)) {
    const ym = calY * 12 + calM;
    if (g.tripWindowStart) {
      const ws    = new Date(g.tripWindowStart + 'T12:00:00');
      const minYM = ws.getFullYear() * 12 + ws.getMonth();
      if (ym < minYM) { calY = ws.getFullYear(); calM = ws.getMonth(); }
    }
    if (g.tripWindowEnd) {
      const we    = new Date(g.tripWindowEnd + 'T12:00:00');
      const maxYM = we.getFullYear() * 12 + we.getMonth();
      if (ym > maxYM) { calY = we.getFullYear(); calM = we.getMonth(); }
    }
  }

  if (displayPhase === 'calendar') renderCal();
  if (g?.phase === 'done')         renderDoneCal();
}
