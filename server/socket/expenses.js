const Group = require('../models/Group');
const { broadcastState } = require('./helpers');

module.exports = function register(socket, { io, sessions, userId, username }) {
  socket.on('expense:add', async ({ description, amount, currency, paidBy, splitAmong }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !description?.trim() || !amount || amount <= 0) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'done') return;
      // Store the payer's color so we can render their avatar without an extra DB lookup
      const member = g.members.find(m => m.username === paidBy);
      g.expenses.push({
        description: description.trim(),
        amount:      parseFloat(amount),
        currency:    currency || 'EUR',
        paidBy,
        paidByColor: member?.color || '#888',
        splitAmong:  splitAmong || g.members.map(m => m.username),
        addedBy:     username,
      });
      await g.save();
      io.to(s.code).emit('expense:new', g.expenses.at(-1));
    } catch (e) { console.error('[expense:add]', e.message); }
  });

  // Only the person who added it or the admin can edit
  socket.on('expense:edit', async ({ id, description, amount, currency, paidBy, splitAmong }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const exp = g.expenses.id(id);
      if (!exp || (exp.addedBy !== username && g.adminUsername !== username)) return;
      exp.description = description;
      exp.amount      = amount;
      exp.currency    = currency;
      exp.paidBy      = paidBy;
      exp.paidByColor = g.members.find(m => m.username === paidBy)?.color || exp.paidByColor;
      exp.splitAmong  = splitAmong;
      await g.save();
      await broadcastState(io, sessions, s.code);
    } catch (e) { console.error('[expense:edit]', e.message); }
  });

  socket.on('expense:remove', async expenseId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const exp = g.expenses.id(expenseId);
      if (!exp || (exp.addedBy !== username && g.adminUsername !== username)) return;
      exp.deleteOne();
      await g.save();
      io.to(s.code).emit('expense:removed', expenseId);
    } catch (e) { console.error('[expense:remove]', e.message); }
  });
};
