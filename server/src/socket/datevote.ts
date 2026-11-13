import Group from '../models/Group';
import { broadcastState, toClient, sameId, hasId, objectId } from './helpers';
import { addSystemMessage } from '../messages';
import { formatTripLabel } from '../utils';
import { checkConfirmDates, checkTripLength } from '../validation';
import type { AppSocket, Ctx } from '../types';

export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  // The organiser sets how many days the trip will last, while the group marks days or votes.
  // Windows shorter than that cannot be voted on or confirmed
  socket.on('trip:setDuration', async dur => {
    try {
      const s = sessions[socket.id];
      const input = checkTripLength(dur);
      if (!s || !input.ok) return;
      const g = await Group.findOne({ inviteCode: s.code });
      // Known dates already fix the length of the trip
      if (!g || !sameId(g.adminUserId, userId) || g.datesKnown || !['calendar', 'date_vote'].includes(g.phase)) return;
      g.tripDuration = input.value;
      await g.save();
      await broadcastState(io, sessions, s.code);
    } catch (e) { console.error('[trip:setDuration]', (e as Error).message); }
  });

  socket.on('range:vote', async idx => {
    try {
      const s = sessions[socket.id];
      if (!s || !Number.isInteger(idx)) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'date_vote') return;
      const range = g.dateRanges[idx];
      const alreadyVoted = range ? hasId(range.voterIds, userId) : false;
      // Clear the user's previous vote across all ranges — one vote at a time
      g.dateRanges.forEach(r => { r.set('voterIds', r.voterIds.filter(v => !sameId(v, userId))); });
      if (!alreadyVoted && range) range.voterIds.push(objectId(userId));
      await g.save();
      io.to(s.code).emit('range:votes', toClient(g.dateRanges));
    } catch (e) { console.error('[range:vote]', (e as Error).message); }
  });

  // The organiser confirms the trip dates inside one free window — moves the group to the planning phase.
  // The old server took any start day; now the whole trip must fit in the window, so nobody is busy on one of its days
  socket.on('range:confirm', async data => {
    try {
      const s = sessions[socket.id];
      if (!s || !Number.isInteger(data?.idx)) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !sameId(g.adminUserId, userId) || g.phase !== 'date_vote') return;
      const r = g.dateRanges[data.idx];
      if (!r?.start || !r.end) return;
      const dates = checkConfirmDates({ start: r.start, end: r.end }, data.start, g.tripDuration);
      if (!dates.ok) return;
      const label = formatTripLabel(dates.value.start, dates.value.days);
      g.dateRanges.forEach((x, i) => { x.selected = i === data.idx; });
      g.finalDate      = dates.value.start;
      g.finalDateLabel = label;
      g.tripDuration   = dates.value.days;
      g.phase          = 'done';
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', await addSystemMessage(g._id, `Trip confirmed: ${label}! Start adding activities.`));
    } catch (e) { console.error('[range:confirm]', (e as Error).message); }
  });

  // Admin moves the whole group back one phase — each step also clears the data from that phase
  socket.on('phase:back', async () => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || String(g.adminUserId) !== String(userId)) return;
      let msg = '';
      // Steps the group skipped when the trip was created (known destination, known dates) are skipped going back too
      if (g.phase === 'done' && g.datesKnown) {
        if (g.destinationKnown) return;                       // nothing to go back to
        g.phase = 'destinations'; g.approvedDest = null; g.set('activities', []);
        msg = 'Back to destination selection.';
      } else if (g.phase === 'calendar' && g.destinationKnown) {
        return;
      } else if (g.phase === 'done') {
        g.phase = 'date_vote'; g.finalDate = null; g.finalDateLabel = null;
        g.set('activities', []); g.dateRanges.forEach(r => { r.selected = false; });
        msg = 'Trip unconfirmed — back to date voting.';
      } else if (g.phase === 'date_vote') {
        g.phase = 'calendar'; g.set('dateRanges', []);
        msg = 'Back to availability calendar.';
      } else if (g.phase === 'calendar') {
        // The destination is chosen again, and the marked days and "I'm done" start from nothing
        g.phase = 'destinations'; g.approvedDest = null; g.set('availability', []); g.set('readyUserIds', []);
        msg = 'Back to destination selection.';
      } else { return; }
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', await addSystemMessage(g._id, msg));
    } catch (e) { console.error('[phase:back]', (e as Error).message); }
  });
}
