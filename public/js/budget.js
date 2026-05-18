function showAddExpenseModal() {
  const members = currentGroup?.members || [];
  document.getElementById('exp-paidby').innerHTML = members.map(m =>
    `<option value="${esc(m.username)}" ${m.username === me.username ? 'selected' : ''}>${esc(m.username)}</option>`
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
  const paidBy      = document.getElementById('exp-paidby').value;
  const splitAmong  = [...document.querySelectorAll('#exp-split-checks input:checked')].map(cb => cb.value);
  if (!description)           { document.getElementById('expense-modal-error').textContent = 'Enter a description'; return; }
  if (!amount || amount <= 0) { document.getElementById('expense-modal-error').textContent = 'Enter a valid amount'; return; }
  if (!splitAmong.length)     { document.getElementById('expense-modal-error').textContent = 'Select at least one person'; return; }
  socket?.emit('expense:add', { description, amount, paidBy, splitAmong });
  closeExpenseModal();
}

function expenseRemove(id) { socket?.emit('expense:remove', id); }

function renderExpenses() {
  const el       = document.getElementById('expense-list');
  const expenses = currentGroup.expenses || [];

  if (!expenses.length) {
    el.innerHTML = '<div class="text-center py-6 text-muted text-sm">No expenses yet. Add the first one!</div>';
    renderBudgetSummary();
    return;
  }

  el.innerHTML = expenses.map(e => {
    const perPerson = (e.amount / (e.splitAmong?.length || 1)).toFixed(2);
    const canDel    = e.addedBy === me?.username || currentGroup?.adminUsername === me?.username;
    return `<div class="bg-panel border border-rim rounded-[11px] px-[14px] py-[11px] flex items-center justify-between animate-up shadow-soft">
      <div class="flex items-center gap-[11px] flex-1 min-w-0">
        <div class="w-[33px] h-[33px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style="background:${e.paidByColor || '#888'}">${initials(e.paidBy)}</div>
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm truncate">${esc(e.description)}</div>
          <div class="text-[11px] text-muted mt-0.5">${esc(e.paidBy)} paid · split ${e.splitAmong?.length || 1} ways (€${perPerson}/person)</div>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="font-semibold text-[15px] tracking-tight">€${Number(e.amount).toFixed(2)}</div>
        ${canDel ? `<button class="w-[22px] h-[22px] rounded-full border border-accent/25 bg-transparent text-accent flex items-center justify-center cursor-pointer transition-all text-base hover:bg-accent hover:text-white hover:border-accent leading-none" onclick="expenseRemove('${e._id}')">×</button>` : ''}
      </div>
    </div>`;
  }).join('');

  renderBudgetSummary();
}

function renderBudgetSummary() {
  const el       = document.getElementById('budget-summary');
  const expenses = currentGroup.expenses || [];
  if (!expenses.length) { el.innerHTML = ''; return; }

  // figure out net balance per person
  const balance = {};
  (currentGroup.members || []).forEach(m => { balance[m.username] = 0; });
  expenses.forEach(e => {
    const share = e.amount / (e.splitAmong?.length || 1);
    balance[e.paidBy] = (balance[e.paidBy] || 0) + e.amount;
    (e.splitAmong || []).forEach(u => { balance[u] = (balance[u] || 0) - share; });
  });

  // greedy matching — works fine for small groups
  const debtors   = Object.entries(balance).filter(([, b]) => b < -0.01).map(([u, b]) => ({ user: u, amt: -b }));
  const creditors = Object.entries(balance).filter(([, b]) => b >  0.01).map(([u, b]) => ({ user: u, amt: b }));
  const settlements = [];
  const d = debtors.map(x => ({ ...x })), c = creditors.map(x => ({ ...x }));
  while (d.length && c.length) {
    const amt = Math.min(d[0].amt, c[0].amt);
    if (amt > 0.01) settlements.push({ from: d[0].user, to: c[0].user, amt });
    d[0].amt -= amt; c[0].amt -= amt;
    if (d[0].amt < 0.01) d.shift();
    if (c[0].amt < 0.01) c.shift();
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  el.innerHTML = `
    <div class="bg-panel border border-rim rounded-xl p-[15px] shadow-soft">
      <div class="font-semibold text-sm mb-[7px] tracking-tight">Summary</div>
      <div class="text-[15px] font-semibold mb-[11px]">Total: €${total.toFixed(2)}</div>
      ${settlements.length
        ? `<div class="text-xs text-muted mb-[7px] font-medium">Settlements:</div>
           ${settlements.map(s => `
             <div class="flex items-center gap-[7px] text-sm py-[7px] border-t border-rim">
               <span class="font-semibold">${esc(s.from)}</span>
               <span class="text-muted text-xs">${IC.arrowR}</span>
               <span class="font-semibold">${esc(s.to)}</span>
               <span class="ml-auto font-semibold text-accent">€${s.amt.toFixed(2)}</span>
             </div>`).join('')}`
        : `<div class="inline-flex items-center gap-1.5 text-sm text-green font-semibold">${IC.check} All settled up!</div>`}
    </div>`;
}
