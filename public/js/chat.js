let chatOpen    = false;
let unreadCount = 0;

function toggleChat() {
  chatOpen = !chatOpen;
  const panel  = document.getElementById('chat-panel');
  const bubble = document.getElementById('chat-bubble');

  if (chatOpen) {
    // Show popup: animate in from bottom-right
    panel.classList.remove('hidden');
    panel.classList.remove('chat-leaving');
    void panel.offsetWidth;
    panel.classList.add('chat-entering');
    panel.addEventListener('animationend', () => panel.classList.remove('chat-entering'), { once: true });

    unreadCount = 0;
    updateChatBadge();
    setTimeout(() => {
      const msgs = document.getElementById('chat-msgs');
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 50);
  } else {
    // Animate popup out, then hide
    panel.classList.add('chat-leaving');
    panel.addEventListener('animationend', () => {
      panel.classList.add('hidden');
      panel.classList.remove('chat-leaving');

      // Pop the bubble
      if (bubble) {
        bubble.classList.remove('bubble-pop');
        void bubble.offsetWidth;
        bubble.classList.add('bubble-pop');
      }
    }, { once: true });
  }
}

function updateChatBadge() {
  const badge       = document.getElementById('chat-unread-badge');
  const bubbleBadge = document.getElementById('chat-bubble-badge');

  if (unreadCount > 0) {
    const txt = unreadCount > 99 ? '99+' : unreadCount;
    if (badge)       { badge.textContent = txt;       badge.classList.remove('hidden'); badge.classList.add('flex'); }
    if (bubbleBadge) { bubbleBadge.textContent = txt; bubbleBadge.classList.remove('hidden'); bubbleBadge.classList.add('flex'); }
  } else {
    if (badge)       { badge.classList.add('hidden');       badge.classList.remove('flex'); }
    if (bubbleBadge) { bubbleBadge.classList.add('hidden'); bubbleBadge.classList.remove('flex'); }
  }
}

function chatSend() {
  const inp = document.getElementById('chat-inp');
  const v = inp.value.trim();
  if (!v || !socket) return;
  socket.emit('msg', v);
  inp.value = '';
}

function appendMsg(m, animate = true) {
  const el  = document.getElementById('chat-msgs');
  const div = document.createElement('div');

  if (m.system) {
    const icon = m.text.startsWith('Destination approved') ? IC.map
               : m.text.startsWith('Available dates')      ? IC.calCheck
               : m.text.startsWith('Trip confirmed')        ? IC.sparkles
               : (m.text.startsWith('Trip unconfirmed') || m.text.startsWith('Back to')) ? IC.arrowL
               : IC.info;
    div.className = 'px-2.5 py-[5px]';
    div.innerHTML = `<div class="bg-blue/[.07] border border-blue/15 rounded-xl px-3 py-2 text-xs text-blue inline-flex items-center gap-1.5">${icon}<span>${esc(m.text)}</span></div>`;
  } else {
    const mine = m.username === me?.username;
    div.className = `flex gap-[7px] items-start ${mine ? 'flex-row-reverse' : ''} px-2.5 py-[5px]`;
    if (!animate) div.style.animation = 'none';
    div.innerHTML = `
      <div class="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5" style="background:${m.color || '#888'}">${initials(m.username)}</div>
      <div class="max-w-[82%] ${mine ? 'flex flex-col items-end' : ''}">
        <div class="text-[10px] text-muted mb-[3px] font-medium">${esc(m.username)} · ${m.time}</div>
        <div class="${mine ? 'bg-deep text-white/90 border-transparent rounded-br-[4px]' : 'bg-bg border border-rim'} rounded-xl px-3 py-2 text-[13px] leading-relaxed break-words">${esc(m.text)}</div>
      </div>`;
  }

  el.appendChild(div);
  el.scrollTop = el.scrollHeight;

  if (!chatOpen && animate && !m.system && m.username !== me?.username) {
    unreadCount++;
    updateChatBadge();
  }
}

let typingTimers = {};
function showTyping(uname) {
  const el = document.getElementById('typing-row');
  clearTimeout(typingTimers[uname]);
  el.innerHTML = `${esc(uname)} is typing <span class="tdots"><span></span><span></span><span></span></span>`;
  typingTimers[uname] = setTimeout(() => { el.innerHTML = ''; }, 2500);
}

let myTypingT;
function chatTyping() {
  clearTimeout(myTypingT);
  socket?.emit('typing');
  myTypingT = setTimeout(() => {}, 2000);
}

function renderOnline(list) {
  document.getElementById('online-row').innerHTML = (list || []).map((u, i) =>
    `<div class="w-[27px] h-[27px] rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-deep ${i > 0 ? '-ml-[6px]' : ''} cursor-default transition-transform hover:scale-110 hover:z-[5]" style="background:${u.color}" title="${esc(u.username)}">${initials(u.username)}</div>`
  ).join('');
}

function showInviteModal() {
  document.getElementById('modal-code').textContent = currentCode;
  document.getElementById('modal-link').textContent = `${location.origin}?code=${currentCode}`;
  // reset double-confirm state when reopening
  ['inv-modal-leave', 'inv-modal-delete'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) { btn.dataset.c = ''; btn.innerHTML = btn.id === 'inv-modal-leave' ? 'Leave group' : 'Delete group'; btn.classList.remove('!text-accent'); }
  });
  const del = document.getElementById('inv-modal-delete');
  if (del) del.classList.toggle('hidden', !isAdmin());
  document.getElementById('inv-modal').classList.remove('hidden');
}

function closeModal() { document.getElementById('inv-modal').classList.add('hidden'); }

function copyInvite() {
  navigator.clipboard.writeText(`${location.origin}?code=${currentCode}`).then(() => {
    document.querySelectorAll('[onclick="copyInvite()"]').forEach(b => {
      b.innerHTML = `${IC.check} Copied!`;
      setTimeout(() => { b.innerHTML = `${IC.copy} Copy link`; }, 2000);
    });
  });
}
