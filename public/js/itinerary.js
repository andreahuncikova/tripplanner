// ── Done phase – itinerary & activities ───────────────

let _editingActId = null;

function renderDoneCal() {
  document.getElementById('done-cal-label').textContent = MONTHS[calM] + ' ' + calY;
  const g          = currentGroup;
  const actsByDate = {};
  (g.activities || []).forEach(a => {
    if (a.calDate) (actsByDate[a.calDate] = actsByDate[a.calDate] || []).push(a);
  });

  buildGrid('done-cal-grid', (key, el) => {
    if (g.finalDate && inRange(key, g.finalDate, g.tripDuration)) el.classList.add('!bg-green/[.15]', '!border-green/[.18]');
    if (key === selectedDoneDay)                                   el.classList.add('!bg-deep', '!text-white', '!border-deep', 'font-bold', 'shadow-[0_2px_10px_rgba(24,24,27,.25)]');

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

  if (!acts.length) {
    actsEl.innerHTML = `<p class="text-muted text-sm py-1 flex items-center gap-1.5">${IC.calendar} Nothing scheduled</p>`;
    return;
  }

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

function showAddActModal(preDate, editData = null) {
  _editingActId = editData?.id || null;
  const isEdit  = !!_editingActId;

  document.getElementById('act-modal-heading').textContent = isEdit ? 'Edit activity' : 'Add activity';
  document.getElementById('act-modal-submit').textContent  = isEdit ? 'Save changes'  : 'Add activity';
  document.getElementById('act-modal-error').textContent   = '';
  document.getElementById('act-modal-inp').value           = editData?.text || '';

  const dateInp = document.getElementById('act-modal-date');
  const timeInp = document.getElementById('act-modal-time');
  const pillsEl = document.getElementById('act-modal-date-pills');

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
    pillsEl.innerHTML = days.map(d => {
      const active = sel === d.key;
      return `<button type="button" onclick="actSetDate('${d.key}')" class="flex-shrink-0 flex flex-col items-center px-3 py-[7px] rounded-lg border text-[12px] font-medium transition-all cursor-pointer ${active ? 'bg-accent text-white border-accent' : 'bg-transparent border-rim text-muted hover:border-ink hover:text-ink'}">
        <span class="text-[10px] font-semibold opacity-70 leading-none mb-0.5">Day ${d.n}</span>
        <span>${d.label}</span>
      </button>`;
    }).join('');
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
