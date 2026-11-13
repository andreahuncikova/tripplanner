import Group from '../models/Group';
import { broadcastState, getOnline, serialize, toClient, sameId, hasId, objectId } from './helpers';
import { addSystemMessage } from '../messages';
import { checkDestinationName } from '../validation';
import type { AppSocket, Ctx } from '../types';

// More would not fit on one screen, and nobody needs them to choose one place
const MAX_DESTINATIONS = 20;

export default function register(socket: AppSocket, { io, sessions, userId, username }: Ctx) {
  // Any member can suggest a new destination while the group is choosing one. The same place twice
  // ("bali" and "Bali") would split the votes, so it is not added again.
  socket.on('dest:suggest', async name => {
    try {
      const s = sessions[socket.id];
      const input = checkDestinationName(name);
      if (!s || !input.ok) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'destinations' || g.destinations.length >= MAX_DESTINATIONS) return;
      if (g.destinations.some(d => d.name.toLowerCase() === input.value.toLowerCase())) return;
      g.destinations.push({ name: input.value, by: username, byUserId: userId, voterIds: [] });
      await g.save();
      // Only emit the new destination instead of the full state — more efficient
      io.to(s.code).emit('dest:new', toClient(g.destinations.at(-1)));
    } catch (e) { console.error('[dest:suggest]', (e as Error).message); }
  });

  socket.on('dest:vote', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'destinations') return;
      const d = g.destinations.id(destId);
      if (!d) return;
      const alreadyVoted = hasId(d.voterIds, userId);
      // Remove the user's vote from all destinations first (only one vote allowed at a time)
      g.destinations.forEach(x => { x.set('voterIds', x.voterIds.filter(v => !sameId(v, userId))); });
      // If they hadn't voted for this one yet, add the vote; otherwise it's a toggle-off
      if (!alreadyVoted) d.voterIds.push(objectId(userId));
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:vote]', (e as Error).message); }
  });

  // Only the organiser approves, and only while the group is choosing. This moves the group to marking free days,
  // or straight to the planning phase when the dates were known from the start
  socket.on('dest:approve', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || !sameId(g.adminUserId, userId) || g.phase !== 'destinations') return;
      const d = g.destinations.id(destId);
      if (!d) return;
      g.approvedDest = d.name;
      g.phase = g.datesKnown ? 'done' : 'calendar';
      await g.save();
      await broadcastState(io, sessions, s.code);
      io.to(s.code).emit('msg', await addSystemMessage(g._id, `Destination approved: ${d.name}.`));
    } catch (e) { console.error('[dest:approve]', (e as Error).message); }
  });

  // Only the person who suggested it or the admin can edit/remove
  socket.on('dest:edit', async ({ id, name }) => {
    try {
      const s = sessions[socket.id];
      const input = checkDestinationName(name);
      if (!s || !input.ok) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'destinations') return;
      const dest = g.destinations.find(d => String(d._id) === String(id));
      if (!dest || (!sameId(dest.byUserId, userId) && !sameId(g.adminUserId, userId))) return;
      dest.name = input.value;
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:edit]', (e as Error).message); }
  });

  socket.on('dest:remove', async destId => {
    try {
      const s = sessions[socket.id];
      if (!s) return;
      const g = await Group.findOne({ inviteCode: s.code });
      if (!g || g.phase !== 'destinations') return;
      const dest = g.destinations.find(d => String(d._id) === String(destId));
      if (!dest || (!sameId(dest.byUserId, userId) && !sameId(g.adminUserId, userId))) return;
      dest.deleteOne();
      await g.save();
      io.to(s.code).emit('state', serialize(g, getOnline(sessions, s.code)));
    } catch (e) { console.error('[dest:remove]', (e as Error).message); }
  });
}
