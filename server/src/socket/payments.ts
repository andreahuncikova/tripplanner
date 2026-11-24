import Group from '../models/Group';
import { broadcastState, sameId } from './helpers';
import { fxRates } from '../fx';
import { checkPayment } from '../validation';
import { settleUp, toUnits } from '../../../shared/money';
import type { AppSocket, Ctx, PaymentResult, TripState } from '../types';

// Settle up in the Budget tab. A payment goes through three states:
// not paid (no record, only a line in Settle up) → paid (the payer says they sent it) → confirmed (the one who got it says it arrived).
export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  const answer = (ack: ((r: PaymentResult) => void) | undefined, r: PaymentResult) => { if (typeof ack === 'function') ack(r); };
  const trip = async () => {
    const s = sessions[socket.id];
    return s ? { code: s.code, g: await Group.findOne({ inviteCode: s.code }) } : null;
  };

  socket.on('payment:add', async (data, ack) => {
    try {
      const t = await trip();
      if (!t) return answer(ack, { error: 'Open the trip again and try once more' });
      const { g, code } = t;
      if (!g || g.phase !== 'done') return answer(ack, { error: 'Trip not found' });
      const currency = g.currency || 'EUR';
      const input = checkPayment(data, g.members.map(m => String(m.userId)), userId, currency);
      if (!input.ok) return answer(ack, { error: input.error });
      // Only what Settle up says the user owes this person, so a double tap or an old screen cannot pay twice
      const { rates } = await fxRates.get();
      // As JSON the ids are text, the same as on the client, so both count Settle up the same way
      const { expenses, payments } = JSON.parse(JSON.stringify({ expenses: g.expenses, payments: g.payments })) as Pick<TripState, 'expenses' | 'payments'>;
      const owed = settleUp(expenses, currency, rates, payments).find(x => x.from === userId && x.to === input.value.toUserId);
      if (!owed) return answer(ack, { error: 'You do not owe this person anything right now' });
      if (toUnits(input.value.amount, currency) > toUnits(owed.amount, currency)) return answer(ack, { error: 'That is more than you owe this person' });
      g.payments.push({ fromUserId: userId, toUserId: input.value.toUserId, amount: input.value.amount, currency, status: 'paid' });
      await g.save();
      await broadcastState(io, sessions, code);
      answer(ack, { ok: true });
    } catch (e) {
      console.error('[payment:add]', (e as Error).message);
      answer(ack, { error: 'Server error — please try again' });
    }
  });

  // Only the person who got the money can confirm it
  socket.on('payment:confirm', async (paymentId, ack) => {
    try {
      const t = await trip();
      if (!t?.g) return answer(ack, { error: 'Trip not found' });
      const p = t.g.payments.id(paymentId);
      if (!p || !sameId(p.toUserId, userId)) return answer(ack, { error: 'Only the person who got the money can confirm it' });
      if (p.status !== 'confirmed') {
        p.status = 'confirmed';
        p.confirmedAt = new Date();
        await t.g.save();
        await broadcastState(io, sessions, t.code);
      }
      answer(ack, { ok: true });
    } catch (e) {
      console.error('[payment:confirm]', (e as Error).message);
      answer(ack, { error: 'Server error — please try again' });
    }
  });

  // The payer takes it back ("Undo"), or the one who should have got it says it never arrived.
  // A confirmed payment stays, because both agreed on it.
  socket.on('payment:remove', async (paymentId, ack) => {
    try {
      const t = await trip();
      if (!t?.g) return answer(ack, { error: 'Trip not found' });
      const p = t.g.payments.id(paymentId);
      if (!p || !(sameId(p.fromUserId, userId) || sameId(p.toUserId, userId))) return answer(ack, { error: 'Only the two people in this payment can change it' });
      if (p.status === 'confirmed') return answer(ack, { error: 'This payment is already confirmed' });
      p.deleteOne();
      await t.g.save();
      await broadcastState(io, sessions, t.code);
      answer(ack, { ok: true });
    } catch (e) {
      console.error('[payment:remove]', (e as Error).message);
      answer(ack, { error: 'Server error — please try again' });
    }
  });
}
