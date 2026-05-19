function packSuggest() {
  const inp = document.getElementById('pack-inp');
  const v   = inp.value.trim();
  if (!v || !socket) return;
  socket.emit('pack:add', v);
  inp.value = '';
}

function renderPackingList() {
  const el    = document.getElementById('pack-list');
  if (!el) return;
  const items = currentGroup.packingList || [];
  const packed = items.filter(i => i.packed).length;
  const total  = items.length;

  if (!total) {
    el.innerHTML = `<div class="flex-1 flex flex-col items-center justify-center gap-3 text-muted text-sm py-10">
      <i data-lucide="backpack" class="w-10 h-10 opacity-20"></i>
      <span>Nothing to pack yet.<br>Add items below.</span>
    </div>`;
    lucide.createIcons({ nodes: [el] });
    return;
  }

  const pct      = total > 0 ? Math.round((packed / total) * 100) : 0;
  const allDone  = packed === total;

  el.innerHTML = `
    <div class="mb-1">
      <div class="flex items-center justify-between text-[11px] text-muted font-medium mb-1.5">
        <span class="flex items-center gap-1">${IC.check} ${packed} of ${total} packed</span>
        ${allDone ? `<span class="text-green font-semibold">${IC.sparkles} All packed!</span>` : ''}
      </div>
      <div class="h-1 bg-rim rounded-full overflow-hidden">
        <div class="h-full bg-green rounded-full transition-[width_.4s_ease]" style="width:${pct}%"></div>
      </div>
    </div>
    ${items.map(item => {
      const canDel = item.addedBy === me?.username || currentGroup?.adminUsername === me?.username;
      return `<div class="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] border ${item.packed ? 'border-green/25 bg-green/[.04]' : 'border-rim bg-panel'} transition-all animate-up">
        <button
          class="w-5 h-5 rounded-[5px] border-[1.5px] flex items-center justify-center cursor-pointer flex-shrink-0 transition-all ${item.packed ? 'bg-green border-green text-white' : 'border-rim bg-transparent text-transparent hover:border-green/60'}"
          onclick="socket?.emit('pack:toggle','${item._id}')"
        >${IC.check}</button>
        <span class="flex-1 text-sm ${item.packed ? 'line-through text-muted' : 'text-ink'}">${esc(item.text)}</span>
        <span class="text-[10px] text-muted/70 flex-shrink-0">${esc(item.addedBy)}</span>
        ${canDel ? `<button class="w-5 h-5 rounded border border-rim bg-transparent text-muted flex items-center justify-center cursor-pointer transition-all hover:border-accent/40 hover:text-accent flex-shrink-0" onclick="confirmThen(this,()=>socket?.emit('pack:remove','${item._id}'))">${IC.x}</button>` : ''}
      </div>`;
    }).join('')}`;
}
