function initSocket(code) {
  localStorage.setItem('tp_last_group', code.toUpperCase());

  document.getElementById('chat-msgs').innerHTML = '';
  document.getElementById('typing-row').innerHTML = '';
  currentGroup = null;
  pendingBackRequest = null;
  pendingRequests = [];

  if (socket) socket.disconnect();
  socket = io({ auth: { token } });

  socket.on('connect', () => {
    setWsStatus(true);
    socket.emit('join', { code });
  });

  socket.on('disconnect', () => setWsStatus(false));

  socket.on('err', msg => {
    // if we haven't loaded group data yet (e.g. bad code on auto-reconnect), go back to dash
    if (!currentGroup?.phase) {
      localStorage.removeItem('tp_last_group');
      showDash();
    } else {
      alert(msg);
    }
  });

  socket.on('joined', data => {
    document.getElementById('chat-msgs').innerHTML = '';
    document.getElementById('typing-row').innerHTML = '';
    currentGroup = null;

    applyState(data);
    (data.messages || []).forEach(m => appendMsg(m, false));

    // if we just created this group and picked months, apply them now
    if (pendingTripWindow && isAdmin() && !data.tripWindowStart) {
      socket.emit('trip:setWindow', pendingTripWindow);
      pendingTripWindow = null;
    }

    showScreen('app');
    document.getElementById('chat-inp').focus();
  });

  socket.on('state',   data  => applyState(data));
  socket.on('online',  list  => renderOnline(list));
  socket.on('msg',     m     => appendMsg(m));

  socket.on('dest:new',   dest => { currentGroup.destinations.push(dest); renderDests(); });
  socket.on('dest:votes', ({ destId, votes }) => {
    const d = currentGroup.destinations.find(x => String(x._id) === String(destId));
    if (d) { d.votes = votes; renderDests(); }
  });

  socket.on('avail:update', ({ username, color, unavailableDates }) => {
    let a = currentGroup.availability.find(x => x.username === username);
    if (a) { a.unavailableDates = unavailableDates; a.color = color; }
    else currentGroup.availability.push({ username, color, unavailableDates });
    if (username === me.username) myUnavail = new Set(unavailableDates);
    renderCal();
    renderCalDayPanel();
  });

  socket.on('range:votes',     ranges => { currentGroup.dateRanges = ranges; renderRanges(); });
  socket.on('activity:new',    act    => { currentGroup.activities.push(act); renderDoneCal(); });
  socket.on('expense:new',     exp    => { if (!currentGroup.expenses) currentGroup.expenses = []; currentGroup.expenses.push(exp); renderExpenses(); });
  socket.on('expense:removed', id     => { currentGroup.expenses = (currentGroup.expenses || []).filter(e => String(e._id) !== String(id)); renderExpenses(); });
  socket.on('typing',          uname  => showTyping(uname));
  socket.on('group:left',    () => goToDash());
  socket.on('group:deleted', () => goToDash());

  socket.on('back:pending', ({ username, targetPhase }) => {
    if (!isAdmin()) return;
    if (!pendingRequests.find(r => r.username === username)) {
      pendingRequests.push({ username, targetPhase });
    }
    renderBackRequestBar();
  });

  socket.on('back:resolved', ({ username }) => {
    pendingRequests = pendingRequests.filter(r => r.username !== username);
    renderBackRequestBar();
  });

  socket.on('back:approved', ({ targetPhase }) => {
    pendingBackRequest = null;
    closeBackReqModal();
    localPhaseOverride = targetPhase;
    renderPhase();
  });

  socket.on('back:denied', () => {
    pendingBackRequest = null;
    // show denied state in modal if it's still open
    document.getElementById('brm-state-pending').innerHTML =
      `<div class="w-full py-3 rounded-xl bg-accent/[.08] text-accent font-semibold text-sm text-center">❌ Admin denied your request.</div>
       <button onclick="closeBackReqModal()" class="text-muted text-xs cursor-pointer hover:text-ink font-medium py-1 text-center">Close</button>`;
    document.getElementById('brm-state-idle').classList.add('hidden');
    document.getElementById('brm-state-pending').classList.remove('hidden');
    setTimeout(() => closeBackReqModal(), 4000);
  });
}
