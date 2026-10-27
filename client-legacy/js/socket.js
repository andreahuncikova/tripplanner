// Connects to the server via WebSocket and registers all event listeners.
function initSocket(code) {
  localStorage.setItem('tp_last_group', code.toUpperCase());

  document.getElementById('chat-msgs').innerHTML = '';
  document.getElementById('typing-row').innerHTML = '';
  currentGroup = null;

  // Disconnect any existing socket before creating a new one
  if (socket) socket.disconnect();

  // Send the JWT token in the handshake so the server can verify us before we join
  socket = io({ auth: { token } });

  socket.on('connect', () => {
    setWsStatus(true);
    socket.emit('join', { code });
  });

  socket.on('disconnect', () => setWsStatus(false));

  socket.on('err', msg => {
    // If we haven't loaded group data yet (e.g. bad code on auto-reconnect), go back to dashboard
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
    // Load message history without animation (animate = false)
    (data.messages || []).forEach(m => appendMsg(m, false));

    // If we just created this group and pre-selected months, send the window now
    if (pendingTripWindow && isAdmin() && !data.tripWindowStart) {
      socket.emit('trip:setWindow', pendingTripWindow);
      pendingTripWindow = null;
    }

    showScreen('app');
    document.getElementById('chat-inp').focus();
  });

  // Full state update — happens when anything in the group changes
  socket.on('state', data => applyState(data));
  socket.on('online', list => renderOnline(list));
  socket.on('msg', m => appendMsg(m));

  // Destination added — append to local state and re-render without a full state update
  socket.on('dest:new', dest => { currentGroup.destinations.push(dest); renderDests(); });

  // One member's availability changed — update only their entry, not the whole state
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
  socket.on('typing',          uname  => showTyping(uname));
  socket.on('group:left',    () => goToDash());
  socket.on('group:deleted', () => goToDash());
}
