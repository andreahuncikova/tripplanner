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

function openExpenseModal(expense = null) {
  const members  = currentGroup?.members || [];
  editingExpenseId = expense?._id || null;

  document.getElementById('expense-modal-title').textContent  = expense ? 'Edit Expense' : 'Add Expense';
  document.getElementById('expense-modal-submit').textContent = expense ? 'Save changes' : 'Add expense';

  const selCurr   = expense?.currency || localStorage.getItem('tp_last_currency') || displayCurrency;
  const selPaidBy = expense?.paidBy ?? me.username;

  const PILL_CLS   = (on) => `flex-shrink-0 px-3 py-[7px] rounded-lg border text-[12px] font-semibold cursor-pointer transition-all ${on ? 'bg-accent text-white border-accent' : 'bg-transparent border-rim text-muted hover:border-ink hover:text-ink'}`;

  // Currency select
  document.getElementById('exp-currency').innerHTML = currencyOpts(selCurr, true);

  // Paid by pills
  const paidPills = document.getElementById('exp-paidby-pills');
  const paidInp   = document.getElementById('exp-paidby');
  paidInp.value   = selPaidBy;
  const renderPaidPills = (sel) => {
    paidPills.innerHTML = members.map(m =>
      `<button type="button" onclick="expSetPaidBy('${esc(m.username)}')" class="${PILL_CLS(sel === m.username)} flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${m.color}"></span>${esc(m.username)}
      </button>`
    ).join('');
  };
  renderPaidPills(selPaidBy);
  window._expRenderPaidPills = renderPaidPills;
  document.getElementById('exp-split-checks').innerHTML = members.map(m => {
    const checked = expense ? expense.splitAmong?.includes(m.username) : true;
    return `<label class="exp-check flex items-center gap-[6px] px-3 py-[5px] border-[1.5px] border-rim rounded-full cursor-pointer text-sm transition-all select-none">
      <input type="checkbox" value="${esc(m.username)}"${checked ? ' checked' : ''}/>
      <span class="w-[10px] h-[10px] rounded-full flex-shrink-0" style="background:${m.color}"></span>
      ${esc(m.username)}
    </label>`;
  }).join('');
  document.getElementById('exp-desc').value   = expense?.description || '';
  document.getElementById('exp-amount').value = expense?.amount || '';
  document.getElementById('expense-modal-error').textContent = '';
  document.getElementById('expense-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('exp-desc').focus(), 50);
}

function expSetPaidBy(name) {
  document.getElementById('exp-paidby').value = name;
  window._expRenderPaidPills?.(name);
}

function showAddExpenseModal() { openExpenseModal(null); }

function closeExpenseModal() {
  editingExpenseId = null;
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
  if (editingExpenseId) {
    socket?.emit('expense:edit', { id: editingExpenseId, description, amount, currency, paidBy, splitAmong });
  } else {
    socket?.emit('expense:add', { description, amount, currency, paidBy, splitAmong });
  }
  closeExpenseModal();
}

function expenseRemove(id) { socket?.emit('expense:remove', id); }

async function renderExpenses() {
  await ensureFxRates();
  const el       = document.getElementById('expense-list');
  const expenses = currentGroup.expenses || [];

  const isEmpty = !expenses.length;
  document.getElementById('budget-empty')?.classList.toggle('hidden', !isEmpty);
  document.getElementById('budget-split')?.classList.toggle('hidden', isEmpty);
  document.getElementById('budget-split')?.classList.toggle('flex', !isEmpty);
  if (isEmpty) { renderBudgetSummary(); return; }

  el.innerHTML = expenses.map(e => {
    const curr    = e.currency || 'EUR';
    const pp      = e.amount / (e.splitAmong?.length || 1);
    const canEdit = e.addedBy === me?.username || currentGroup?.adminUsername === me?.username;
    return `<div class="bg-panel border border-rim rounded-xl p-4 flex items-center gap-3 animate-up shadow-soft hover:-translate-y-px hover:shadow-md transition-all">
      <div class="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style="background:${e.paidByColor || '#888'}">${initials(e.paidBy)}</div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-[14px] text-ink truncate">${esc(e.description)}</div>
        <div class="text-[11px] text-muted mt-0.5">${esc(e.paidBy)} paid · split ${e.splitAmong?.length || 1} ways · ${fmtAmt(pp, curr)}/person</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="font-bold text-[16px] text-ink tracking-tight">${fmtAmt(e.amount, curr)}</div>
        ${canEdit ? `
          <div class="flex gap-1">
            <button class="w-7 h-7 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-blue/40 hover:text-blue" onclick="openExpenseModal(currentGroup.expenses.find(x=>String(x._id)==='${e._id}'))">${IC.pencil}</button>
            <button class="w-7 h-7 rounded-lg border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-accent/40 hover:text-accent" onclick="confirmThen(this,()=>expenseRemove('${e._id}'))">${IC.x}</button>
          </div>` : ''}
      </div>
    </div>`;
  }).join('');

  renderBudgetSummary();
}

function renderBudgetSummary() {
  const el       = document.getElementById('budget-summary');
  const expenses = currentGroup.expenses || [];
  const ratesOk  = fxRates && Object.keys(fxRates).length > 1;

  // Currency selector always at top
  const currCtrl = `
    <div>
      <div class="text-[10px] font-semibold text-muted uppercase tracking-[.07em] mb-1.5">Display currency</div>
      <select style="width:100%;font-size:13px;padding:9px 12px" onchange="setDisplayCurrency(this.value)">${currencyOpts(displayCurrency)}</select>
      ${!ratesOk ? `<div class="text-[10px] text-muted/50 mt-1 italic">Live rates unavailable — using estimates</div>` : ''}
    </div>`;

  if (!expenses.length) { el.innerHTML = ''; return; }

  const balance = {};
  (currentGroup.members || []).forEach(m => { balance[m.username] = 0; });
  expenses.forEach(e => {
    const amt   = toDisplay(e.amount, e.currency || 'EUR');
    const share = amt / (e.splitAmong?.length || 1);
    balance[e.paidBy] = (balance[e.paidBy] || 0) + amt;
    (e.splitAmong || []).forEach(u => { balance[u] = (balance[u] || 0) - share; });
  });

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
    ${currCtrl}
    <div class="border-t border-rim pt-4">
      <div class="text-[10px] font-semibold text-muted uppercase tracking-[.07em] mb-1">Total spent</div>
      <div class="text-[28px] font-bold tracking-tight text-ink leading-none">${fmtAmt(total, displayCurrency)}</div>
      <div class="text-[12px] text-muted mt-1">${expenses.length} expense${expenses.length === 1 ? '' : 's'}</div>
    </div>
    <div class="border-t border-rim pt-4 flex flex-col gap-0">
      <div class="text-[10px] font-semibold text-muted uppercase tracking-[.07em] mb-3">Settlements</div>
      ${settlements.length
        ? settlements.map(s => `
            <div class="flex items-center gap-2 py-3 border-b border-rim last:border-b-0">
              <div class="flex-1 min-w-0">
                <span class="font-semibold text-[13px] text-ink">${esc(s.from)}</span>
                <span class="text-muted mx-1.5 text-[11px]">owes</span>
                <span class="font-semibold text-[13px] text-ink">${esc(s.to)}</span>
              </div>
              <span class="font-bold text-[14px] text-accent flex-shrink-0">${fmtAmt(s.amt, displayCurrency)}</span>
            </div>`).join('')
        : `<div class="flex items-center gap-2 text-[13px] text-green font-semibold">${IC.check} All settled up!</div>`}
    </div>`;
}

async function setDisplayCurrency(code) {
  displayCurrency = code;
  localStorage.setItem('tp_disp_currency', code);
  await ensureFxRates();
  renderBudgetSummary();
}
