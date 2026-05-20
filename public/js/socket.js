function initSocket(code) {
  localStorage.setItem('tp_last_group', code.toUpperCase());

  document.getElementById('chat-msgs').innerHTML = '';
  document.getElementById('typing-row').innerHTML = '';
  currentGroup = null;
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

  socket.on('dest:new', dest => { currentGroup.destinations.push(dest); renderDests(); });

  socket.on('avail:update', ({ username, color, unavailableDates }) => {
    let a = currentGroup.availability.find(x => x.username === username);
    if (a) { a.unavailableDates = unavailableDates; a.color = color; }
    else currentGroup.availability.push({ username, color, unavailableDates });
    if (username === me.username) myUnavail = new Set(unavailableDates);
    renderCal();
    renderCalDayPanel();
  });

  socket.on('range:votes',     ranges => { currentGroup.dateRanges = ranges; renderRanges(); renderReadiness(); });
  socket.on('activity:new',    act    => { currentGroup.activities.push(act); renderDoneCal(); });
  socket.on('expense:new',     exp    => { if (!currentGroup.expenses) currentGroup.expenses = []; currentGroup.expenses.push(exp); renderExpenses(); });
  socket.on('expense:removed', id     => { currentGroup.expenses = (currentGroup.expenses || []).filter(e => String(e._id) !== String(id)); renderExpenses(); });
  socket.on('pack:new',        item   => { if (!currentGroup.packingList) currentGroup.packingList = []; currentGroup.packingList.push(item); renderPackingList(); });
  socket.on('pack:toggled',    ({ id, packed, packedBy }) => { const it = (currentGroup.packingList||[]).find(x => String(x._id)===String(id)); if(it){it.packed=packed;it.packedBy=packedBy;} renderPackingList(); });
  socket.on('pack:removed',    id     => { currentGroup.packingList = (currentGroup.packingList||[]).filter(i => String(i._id)!==String(id)); renderPackingList(); });
  socket.on('typing',          uname  => showTyping(uname));
  socket.on('group:left',    () => goToDash());
  socket.on('group:deleted', () => goToDash());

}
