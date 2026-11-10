import Group from '../models/Group';
import { broadcastState, toClient, sameId, memberIds } from './helpers';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  socket.on('expense:add', async ({ description, amount, currency, paidByUserId, splitAmongUserIds }) => {
    try {
      const s = sessions[socket.id];
      if (!s || !description?.trim() || !amount || amount <= 0) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'done') return;
      // The payer and everyone who shares the cost must be members of this trip
      const [payer] = memberIds(g, [paidByUserId]);
      if (!payer) return;
      const split = memberIds(g, splitAmongUserIds);
      g.expenses.push({
        description:       description.trim(),
        amount:            Number(amount),
        currency:          currency || 'EUR',
        paidByUserId:      payer,
        // Nobody chosen: the cost is shared by the whole group
        splitAmongUserIds: split.length ? split : memberIds(g, g.members.map(m => m.userId)),
        addedByUserId:     userId,
      });
      await g.save();
      io.to(s.code).emit('expense:new', toClient(g.expenses.at(-1)));
    } catch (e) { console.error('[expense:add]', (e as Error).message); }
  });

  // Only the person who added it or the admin can edit
  socket.on('expense:edit', async ({ id, description, amount, currency, paidByUserId, splitAmongUserIds }) => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const exp = g.expenses.id(id);
      if (!exp || (!sameId(exp.addedByUserId, userId) && !sameId(g.adminUserId, userId))) return;
      const [payer] = memberIds(g, [paidByUserId]);
      const split = memberIds(g, splitAmongUserIds);
      exp.description = description;
      exp.amount      = amount;
      exp.currency    = currency || exp.currency;
      // A payer or split that is not a member keeps the old value
      if (payer) exp.set('paidByUserId', payer);
      if (split.length) exp.set('splitAmongUserIds', split);
      await g.save();
      await broadcastState(io, sessions, s.code);
    } catch (e) { console.error('[expense:edit]', (e as Error).message); }
  });

  socket.on('expense:remove', async expenseId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return;
      const exp = g.expenses.id(expenseId);
      if (!exp || (!sameId(exp.addedByUserId, userId) && !sameId(g.adminUserId, userId))) return;
      exp.deleteOne();
      await g.save();
      io.to(s.code).emit('expense:removed', expenseId);
    } catch (e) { console.error('[expense:remove]', (e as Error).message); }
  });
}
