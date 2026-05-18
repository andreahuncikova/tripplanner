const CURRENCIES = [
  { code: 'EUR', symbol: '€',   name: 'Euro' },
  { code: 'USD', symbol: '$',   name: 'US Dollar' },
  { code: 'GBP', symbol: '£',   name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CZK', symbol: 'Kč',  name: 'Czech Koruna' },
  { code: 'PLN', symbol: 'zł',  name: 'Polish Złoty' },
  { code: 'HUF', symbol: 'Ft',  name: 'Hungarian Forint' },
  { code: 'NOK', symbol: 'kr',  name: 'Norwegian Krone' },
  { code: 'SEK', symbol: 'kr',  name: 'Swedish Krona' },
  { code: 'DKK', symbol: 'kr',  name: 'Danish Krone' },
  { code: 'JPY', symbol: '¥',   name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar' },
];

let displayCurrency = localStorage.getItem('tp_disp_currency') || 'EUR';
let fxRates     = null;
let fxFetchedAt = 0;

function currSym(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol || code;
}

function fmtAmt(amount, code) {
  const sym  = currSym(code);
  const dp   = ['JPY', 'HUF'].includes(code) ? 0 : 2;
  const num  = Number(amount).toFixed(dp);
  const post = ['CZK', 'HUF', 'PLN', 'NOK', 'SEK', 'DKK'].includes(code);
  return post ? `${num} ${sym}` : `${sym}${num}`;
}

// compact = true for the narrow amount-row select, false for the wider summary select
function currencyOpts(selected, compact = false) {
  return CURRENCIES.map(c => {
    const label = compact ? `${c.code} ${c.symbol}` : `${c.code} — ${c.name}`;
    return `<option value="${c.code}"${c.code === selected ? ' selected' : ''}>${label}</option>`;
  }).join('');
}

async function ensureFxRates() {
  if (fxRates && Date.now() - fxFetchedAt < 3_600_000) return;
  try {
    const data = await api('/api/fx-rates');
    if (data && !data.error) {
      fxRates     = data;
      fxFetchedAt = Date.now();
    }
  } catch { /* keep existing rates if any */ }
  if (!fxRates) fxRates = { EUR: 1 };
}

function toDisplay(amount, fromCode) {
  if (!fxRates || fromCode === displayCurrency) return amount;
  const from = fxRates[fromCode];
  const to   = fxRates[displayCurrency];
  if (!from || !to) return amount; // rate not available, show unconverted
  return (amount / from) * to;
}

function showAddExpenseModal() {
  const members  = currentGroup?.members || [];
  const lastCurr = localStorage.getItem('tp_last_currency') || displayCurrency;
  document.getElementById('exp-currency').innerHTML   = currencyOpts(lastCurr, true);
  document.getElementById('exp-paidby').innerHTML = members.map(m =>
    `<option value="${esc(m.username)}"${m.username === me.username ? ' selected' : ''}>${esc(m.username)}</option>`
  ).join('');
  document.getElementById('exp-split-checks').innerHTML = members.map(m => `
    <label class="exp-check flex items-center gap-[6px] px-3 py-[5px] border-[1.5px] border-rim rounded-full cursor-pointer text-sm transition-all select-none">
      <input type="checkbox" value="${esc(m.username)}" checked/>
      <span class="w-[10px] h-[10px] rounded-full flex-shrink-0" style="background:${m.color}"></span>
      ${esc(m.username)}
    </label>`).join('');
  document.getElementById('exp-desc').value = '';
  document.getElementById('exp-amount').value = '';
  document.getElementById('expense-modal-error').textContent = '';
  document.getElementById('expense-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('exp-desc').focus(), 50);
}

function closeExpenseModal() {
  document.getElementById('expense-modal').classList.add('hidden');
}

function expenseSubmit() {
  const description = document.getElementById('exp-desc').value.trim();
  const amount      = parseFloat(document.getElementById('exp-amount').value);
  const currency    = document.getElementById('exp-currency').value;
  const paidBy      = document.getElementById('exp-paidby').value;
  const splitAmong  = [...document.querySelectorAll('#exp-split-checks input:checked')].map(cb => cb.value);
  if (!description)           { document.getElementById('expense-modal-error').textContent = 'Enter a description'; return; }
  if (!amount || amount <= 0) { document.getElementById('expense-modal-error').textContent = 'Enter a valid amount'; return; }
  if (!splitAmong.length)     { document.getElementById('expense-modal-error').textContent = 'Select at least one person'; return; }
  localStorage.setItem('tp_last_currency', currency);
  socket?.emit('expense:add', { description, amount, currency, paidBy, splitAmong });
  closeExpenseModal();
}

function expenseRemove(id) { socket?.emit('expense:remove', id); }

async function renderExpenses() {
  await ensureFxRates();
  const el       = document.getElementById('expense-list');
  const expenses = currentGroup.expenses || [];

  if (!expenses.length) {
    el.innerHTML = '<div class="text-center py-6 text-muted text-sm">No expenses yet. Add the first one!</div>';
    renderBudgetSummary();
    return;
  }

  el.innerHTML = expenses.map(e => {
    const curr   = e.currency || 'EUR';
    const pp     = e.amount / (e.splitAmong?.length || 1);
    const canDel = e.addedBy === me?.username || currentGroup?.adminUsername === me?.username;
    return `<div class="bg-panel border border-rim rounded-[11px] px-[14px] py-[11px] flex items-center justify-between animate-up shadow-soft">
      <div class="flex items-center gap-[11px] flex-1 min-w-0">
        <div class="w-[33px] h-[33px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style="background:${e.paidByColor || '#888'}">${initials(e.paidBy)}</div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${esc(e.description)}</div>
          <div class="text-[11px] text-muted mt-0.5">${esc(e.paidBy)} paid · ${e.splitAmong?.length || 1} ways · ${fmtAmt(pp, curr)}/person</div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="font-semibold text-[15px] tracking-tight">${fmtAmt(e.amount, curr)}</div>
        ${canDel ? `<button class="w-[22px] h-[22px] rounded-full border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-accent/40 hover:text-accent" onclick="confirmThen(this,()=>expenseRemove('${e._id}'))">${IC.x}</button>` : ''}
      </div>
    </div>`;
  }).join('');

  renderBudgetSummary();
}

function renderBudgetSummary() {
  const el       = document.getElementById('budget-summary');
  const expenses = currentGroup.expenses || [];
  const ratesOk  = fxRates && Object.keys(fxRates).length > 1;

  const dispCtrl = `
    <div class="flex items-center gap-2 mb-4 pb-3 border-b border-rim">
      <span class="text-[11px] text-muted font-semibold uppercase tracking-[.04em] flex-shrink-0">Display in</span>
      <select style="padding:5px 9px;font-size:12px;flex:1" onchange="setDisplayCurrency(this.value)">${currencyOpts(displayCurrency)}</select>
      ${!ratesOk ? `<span class="text-[10px] text-muted/60 italic flex-shrink-0">no rates</span>` : ''}
    </div>`;

  if (!expenses.length) {
    el.innerHTML = `<div class="bg-panel border border-rim rounded-xl p-[15px] shadow-soft">${dispCtrl}</div>`;
    return;
  }

  // convert all amounts to displayCurrency and compute balances
  const balance = {};
  (currentGroup.members || []).forEach(m => { balance[m.username] = 0; });
  expenses.forEach(e => {
    const amt   = toDisplay(e.amount, e.currency || 'EUR');
    const share = amt / (e.splitAmong?.length || 1);
    balance[e.paidBy] = (balance[e.paidBy] || 0) + amt;
    (e.splitAmong || []).forEach(u => { balance[u] = (balance[u] || 0) - share; });
  });

  // greedy settlement algorithm
  const debtors   = Object.entries(balance).filter(([,b]) => b < -0.01).map(([u,b]) => ({ user: u, amt: -b }));
  const creditors = Object.entries(balance).filter(([,b]) => b >  0.01).map(([u,b]) => ({ user: u, amt: b }));
  const settlements = [];
  const d = debtors.map(x => ({...x})), c = creditors.map(x => ({...x}));
  while (d.length && c.length) {
    const amt = Math.min(d[0].amt, c[0].amt);
    if (amt > 0.01) settlements.push({ from: d[0].user, to: c[0].user, amt });
    d[0].amt -= amt; c[0].amt -= amt;
    if (d[0].amt < 0.01) d.shift();
    if (c[0].amt < 0.01) c.shift();
  }

  const total = expenses.reduce((s, e) => s + toDisplay(e.amount, e.currency || 'EUR'), 0);

  el.innerHTML = `
    <div class="bg-panel border border-rim rounded-xl p-[15px] shadow-soft">
      ${dispCtrl}
      <div class="text-[22px] font-bold tracking-tight mb-1">${fmtAmt(total, displayCurrency)}</div>
      <div class="text-[11px] text-muted mb-3">total across ${expenses.length} expense${expenses.length === 1 ? '' : 's'}</div>
      ${settlements.length
        ? `<div class="text-[11px] text-muted font-semibold uppercase tracking-[.04em] mb-2">Settlements</div>
           ${settlements.map(s => `
             <div class="flex items-center gap-[7px] text-sm py-[9px] border-t border-rim first:border-t-0">
               <span class="font-semibold">${esc(s.from)}</span>
               <span class="text-muted">${IC.arrowR}</span>
               <span class="font-semibold">${esc(s.to)}</span>
               <span class="ml-auto font-bold text-accent">${fmtAmt(s.amt, displayCurrency)}</span>
             </div>`).join('')}`
        : `<div class="inline-flex items-center gap-1.5 text-sm text-green font-semibold">${IC.check} All settled up!</div>`}
    </div>`;
}

async function setDisplayCurrency(code) {
  displayCurrency = code;
  localStorage.setItem('tp_disp_currency', code);
  await ensureFxRates();
  renderBudgetSummary();
}
