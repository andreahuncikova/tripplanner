import Group, { GroupDoc } from '../models/Group';
import { broadcastState, toClient, sameId } from './helpers';
import { isKnownCurrency } from '../fx';
import { checkExpense, type CheckedExpense } from '../validation';
import type { AppSocket, Ctx, ExpenseResult } from '../types';

type Result = { ok: true; value: CheckedExpense } | { ok: false; error: string };

export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  // The rules for an expense, the same for adding and changing: who paid and who shares the cost must be members,
  // the currency must have an exchange rate, and exact amounts must add up to the whole (validation.ts)
  async function check(g: GroupDoc, data: unknown): Promise<Result> {
    const input = checkExpense(data, g.members.map(m => String(m.userId)), g.currency || 'EUR');
    if (!input.ok) return input;
    if (!(await isKnownCurrency(input.value.currency))) return { ok: false, error: 'There is no exchange rate for this currency' };
    return input;
  }
  // Answers the form, so it can show what went wrong instead of losing the expense without a word
  const answer = (ack: ((r: ExpenseResult) => void) | undefined, r: ExpenseResult) => { if (typeof ack === 'function') ack(r); };

  socket.on('expense:add', async (data, ack) => {
    try {
      const s = sessions[socket.id];
      if (!s) return answer(ack, { error: 'Open the trip again and try once more' });
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'done') return answer(ack, { error: 'Expenses can be added when the dates are confirmed' });
      const input = await check(g, data);
      if (!input.ok) return answer(ack, { error: input.error });
      g.expenses.push({ ...input.value, addedByUserId: userId });
      await g.save();
      io.to(s.code).emit('expense:new', toClient(g.expenses.at(-1)));
      answer(ack, { ok: true });
    } catch (e) {
      console.error('[expense:add]', (e as Error).message);
      answer(ack, { error: 'Server error — please try again' });
    }
  });

  // Only the person who added it or the admin can edit
  socket.on('expense:edit', async (data, ack) => {
    try {
      const s = sessions[socket.id];
      if (!s) return answer(ack, { error: 'Open the trip again and try once more' });
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g) return answer(ack, { error: 'Trip not found' });
      const exp = g.expenses.id(data?.id);
      if (!exp || (!sameId(exp.addedByUserId, userId) && !sameId(g.adminUserId, userId))) return answer(ack, { error: 'You cannot change this expense' });
      const input = await check(g, data);
      if (!input.ok) return answer(ack, { error: input.error });
      // A split by exact amounts that becomes an equal split loses its amounts
      exp.set({ ...input.value, shares: input.value.shares ?? undefined });
      await g.save();
      await broadcastState(io, sessions, s.code);
      answer(ack, { ok: true });
    } catch (e) {
      console.error('[expense:edit]', (e as Error).message);
      answer(ack, { error: 'Server error — please try again' });
    }
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
