import Group from '../models/Group';
import { checkActivity } from '../validation';
import { addDay } from '../../../shared/nights';
import { getOnline, sameId, serialize, toClient } from './helpers';
import type { ActivityResult } from '../../../shared/types';
import type { AppSocket, Ctx } from '../types';

// The itinerary: activities with a day, a time, a place and a note. Every member may add them,
// because in most groups the planning is shared; only who added an activity, or the organiser, may change or remove it,
// as in the baseline. Each event answers with an acknowledgement, so the form can show why something was refused.
export default function register(socket: AppSocket, { io, sessions, userId, username }: Ctx) {
  const answer = (ack: unknown) => (typeof ack === 'function' ? ack as (r: ActivityResult) => void : () => {});

  // The open trip and its first and last day, or null days while it has no dates
  async function openTrip() {
    const s = sessions[socket.id];
    if (!s) return null;
    const g = await Group.findOne({ inviteCode: s.code });
    if (!g) return null;
    const days = g.finalDate && g.tripDuration ? { start: g.finalDate, end: addDay(g.finalDate, g.tripDuration - 1) } : null;
    return { s, g, days };
  }

  socket.on('activity:add', async (data, ack) => {
    const reply = answer(ack);
    try {
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const check = checkActivity(data, open.days);
      if (!check.ok) return reply({ error: check.error });
      if (open.g.activities.length >= 300) return reply({ error: 'A trip can have at most 300 activities' });
      open.g.activities.push({ ...check.value, addedBy: username, userId });
      await open.g.save();
      reply({ ok: true });
      io.to(open.s.code).emit('activity:new', toClient(open.g.activities.at(-1)));
    } catch (e) {
      console.error('[activity:add]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  socket.on('activity:edit', async (data, ack) => {
    const reply = answer(ack);
    try {
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const act = open.g.activities.find(a => String(a._id) === String(data?.id));
      if (!act) return reply({ error: 'This activity no longer exists' });
      if (!sameId(act.userId, userId) && !sameId(open.g.adminUserId, userId)) {
        return reply({ error: 'Only who added an activity, or the organiser, can change it' });
      }
      const check = checkActivity(data, open.days);
      if (!check.ok) return reply({ error: check.error });
      act.set(check.value);
      await open.g.save();
      reply({ ok: true });
      io.to(open.s.code).emit('state', serialize(open.g, getOnline(sessions, open.s.code)));
    } catch (e) {
      console.error('[activity:edit]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  socket.on('activity:remove', async (actId, ack) => {
    const reply = answer(ack);
    try {
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const act = open.g.activities.find(a => String(a._id) === String(actId));
      if (!act) return reply({ error: 'This activity no longer exists' });
      if (!sameId(act.userId, userId) && !sameId(open.g.adminUserId, userId)) {
        return reply({ error: 'Only who added an activity, or the organiser, can remove it' });
      }
      act.deleteOne();
      await open.g.save();
      reply({ ok: true });
      io.to(open.s.code).emit('state', serialize(open.g, getOnline(sessions, open.s.code)));
    } catch (e) {
      console.error('[activity:remove]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });
}
