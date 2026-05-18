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
let localPhaseOverride = null;

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
