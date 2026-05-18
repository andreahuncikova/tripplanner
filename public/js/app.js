// ── Global state ──────────────────────────────────────
let token       = localStorage.getItem('tp_token') || null;
let me          = JSON.parse(localStorage.getItem('tp_me') || 'null');
let socket      = null;
let currentCode  = null;
let currentGroup = null;
let myUnavail    = new Set();
let calY, calM;
let selectedDoneDay = null;
let selectedCalDay  = null;
let localPhaseOverride  = null;
let pendingTripWindow   = null; // set during group creation, emitted after socket joins
let pendingOverrideTarget = false; // false = no action | null = clear | string = set to phase
let destEditingId = null;
let editingExpenseId = null;

const PHASE_ORDER = ['destinations', 'calendar', 'date_vote', 'done'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS   = ['Mo','Tu','We','Th','Fr','Sa','Su'];

const PHASE_LABELS = {
  destinations: 'Destination voting',
  calendar:     'Availability calendar',
  date_vote:    'Date voting',
  done:         'Trip confirmed!',
};

// ── Helpers ───────────────────────────────────────────

// shows a small floating popover above the button with Confirm / Cancel
function confirmThen(btn, fn) {
  document.getElementById('_cpop')?.remove();
  document.querySelectorAll('[data-c="1"]').forEach(b => b.dataset.c = '');

  btn.dataset.c = '1';

  const pop = document.createElement('div');
  pop.id = '_cpop';
  pop.className = 'fixed z-[999] bg-panel border border-rim rounded-xl shadow-[0_4px_24px_rgba(0,0,0,.13)] p-3 min-w-[136px]';
  pop.innerHTML = `
    <p class="text-[11px] text-muted text-center mb-2.5 font-medium">Are you sure?</p>
    <div class="flex gap-1.5">
      <button id="_cpop_yes" class="flex-1 py-[7px] bg-accent text-white text-[11px] font-semibold rounded-lg border-none cursor-pointer hover:bg-[#C44A22] transition-colors">Confirm</button>
      <button id="_cpop_no"  class="flex-1 py-[7px] border border-rim text-muted text-[11px] font-medium rounded-lg cursor-pointer bg-transparent hover:text-ink hover:border-ink/30 transition-colors">Cancel</button>
    </div>`;
  document.body.appendChild(pop);

  // position above the button, centred, clamped to viewport
  const br = btn.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  let left = br.left + br.width / 2 - pr.width / 2;
  let top  = br.top - pr.height - 8;
  if (top < 8) top = br.bottom + 8;
  pop.style.left = `${Math.max(8, Math.min(left, window.innerWidth - pr.width - 8))}px`;
  pop.style.top  = `${top}px`;

  const close = () => {
    pop.remove();
    btn.dataset.c = '';
    document.removeEventListener('click', outside);
    clearTimeout(timer);
  };

  const outside = e => { if (!pop.contains(e.target) && e.target !== btn) close(); };
  const timer   = setTimeout(close, 5000);

  document.getElementById('_cpop_yes').onclick = e => { e.stopPropagation(); close(); fn(); };
  document.getElementById('_cpop_no').onclick  = e => { e.stopPropagation(); close(); };
  setTimeout(() => document.addEventListener('click', outside), 0);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function initials(s) { return String(s || '').slice(0, 2).toUpperCase(); }

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`s-${name}`).classList.add('active');
}

function modalErr(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

function setWsStatus(on) {
  const el = document.getElementById('ws-pill');
  if (!el) return;
  el.className = `ws-pill${on ? '' : ' off'}`;
  el.innerHTML = `<span class="live-dot"></span> ${on ? 'Live' : 'Offline'}`;
}

async function api(url, method = 'GET', body) {
  try {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    });
    return r.json();
  } catch { return { error: 'Network error' }; }
}

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const d = new Date(); calY = d.getFullYear(); calM = d.getMonth();

  document.querySelectorAll('.ptab').forEach(t => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      document.getElementById(`f-${t.dataset.tab}`).classList.add('active');
    });
  });

  document.getElementById('f-register').addEventListener('submit', e => { e.preventDefault(); authRegister(e.target); });
  document.getElementById('f-login').addEventListener('submit',    e => { e.preventDefault(); authLogin(e.target); });

  const urlCode = new URLSearchParams(window.location.search).get('code');
  if (urlCode) {
    const code = urlCode.toUpperCase();
    if (token && me) {
      currentCode = code;
      initSocket(code);
      showScreen('app');
    } else {
      localStorage.setItem('tp_pending_code', code);
    }
  }

  if (token && me) {
    const lastGroup = localStorage.getItem('tp_last_group');
    const pending   = localStorage.getItem('tp_pending_code');
    if (lastGroup && !urlCode) {
      currentCode = lastGroup;
      initSocket(lastGroup);
      showScreen('app');
    } else {
      showDash();
      if (pending) {
        localStorage.removeItem('tp_pending_code');
        document.getElementById('join-code-input').value = pending;
        showJoinModal();
      }
    }
  } else {
    showScreen('auth');
  }
});
