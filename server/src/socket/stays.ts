import { isValidObjectId, Types } from 'mongoose';
import Group from '../models/Group';
import Stay from '../models/Stay';
import { checkAreaName } from '../validation';
import { allowPreview, checkLink, getPreview, PreviewError } from '../preview';
import { broadcastStays, MAX_AREAS, MAX_STAYS } from '../stays';
import { sameId } from './helpers';
import type { AppSocket, Ctx } from '../types';

// Stays tab: save stay links, like them, sort them into areas. Every member may do all of it,
// because in most groups the planning is shared; only removing a stay is for whoever added it and the organiser.
export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  // The open trip with its areas, or null when the socket has no trip open
  async function openTrip() {
    const s = sessions[socket.id];
    if (!s) return null;
    const g = await Group.findById(s.groupId, { areas: 1, adminUserId: 1 });
    return g ? { s, g } : null;
  }
  // An area id from the client: one of this trip's areas, or null for "no area"
  const areaOf = (g: { areas: { _id: unknown }[] }, id: unknown) =>
    id != null && g.areas.some(a => String(a._id) === String(id)) ? String(id) : null;

  socket.on('stay:add', async (data, done) => {
    const reply = typeof done === 'function' ? done : () => {};
    try {
      let link: URL;
      try { link = checkLink(data?.url); } catch (e) { return reply({ error: (e as Error).message }); }
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const { s, g } = open;
      if (await Stay.countDocuments({ groupId: g._id }) >= MAX_STAYS) {
        return reply({ error: `A trip can have at most ${MAX_STAYS} stays` });
      }
      if (!allowPreview(userId)) return reply({ error: 'Too many links at once — please try again in a few minutes' });

      const p = await getPreview(link);
      if (await Stay.exists({ groupId: g._id, url: p.url })) return reply({ error: 'This stay is already saved' });
      await Stay.create({
        groupId: g._id, areaId: areaOf(g, data?.areaId), addedByUserId: userId,
        url: p.url, platform: p.platform, title: p.title, image: p.image, price: p.price, location: p.location, placeId: p.placeId, imageCredit: p.imageCredit,
        complete: p.complete,
      });
      reply({ ok: true });
      await broadcastStays(io, s.code, g);
    } catch (e) {
      if (e instanceof PreviewError) return reply({ error: e.message });
      console.error('[stay:add]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  // Like or unlike: one like per member, a second tap takes it back
  socket.on('stay:like', async stayId => {
    try {
      if (!isValidObjectId(stayId)) return;
      const open = await openTrip();
      if (!open) return;
      const me = new Types.ObjectId(userId);
      const stay = await Stay.findOne({ _id: stayId, groupId: open.g._id }, { likeUserIds: 1 });
      if (!stay) return;
      const liked = stay.likeUserIds.some(id => sameId(id, userId));
      await Stay.updateOne({ _id: stay._id }, liked ? { $pull: { likeUserIds: me } } : { $addToSet: { likeUserIds: me } });
      await broadcastStays(io, open.s.code, open.g);
    } catch (e) { console.error('[stay:like]', (e as Error).message); }
  });

  // Move a stay to another area, or out of all areas (areaId null)
  socket.on('stay:move', async data => {
    try {
      if (!isValidObjectId(data?.id)) return;
      const open = await openTrip();
      if (!open) return;
      if (data.areaId != null && !areaOf(open.g, data.areaId)) return;   // an area of another trip, or gone
      await Stay.updateOne({ _id: data.id, groupId: open.g._id }, { areaId: areaOf(open.g, data.areaId) });
      await broadcastStays(io, open.s.code, open.g);
    } catch (e) { console.error('[stay:move]', (e as Error).message); }
  });

  socket.on('stay:remove', async stayId => {
    try {
      if (!isValidObjectId(stayId)) return;
      const open = await openTrip();
      if (!open) return;
      const stay = await Stay.findOne({ _id: stayId, groupId: open.g._id }, { addedByUserId: 1 });
      if (!stay) return;
      if (!sameId(stay.addedByUserId, userId) && !sameId(open.g.adminUserId, userId)) {
        socket.emit('err', 'Only who added a stay, or the organiser, can remove it');
        return;
      }
      await stay.deleteOne();
      await broadcastStays(io, open.s.code, open.g);
    } catch (e) { console.error('[stay:remove]', (e as Error).message); }
  });

  socket.on('area:add', async (name, done) => {
    const reply = typeof done === 'function' ? done : () => {};
    try {
      const check = checkAreaName(name);
      if (!check.ok) return reply({ error: check.error });
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const { s, g } = open;
      if (g.areas.length >= MAX_AREAS) return reply({ error: `A trip can have at most ${MAX_AREAS} areas` });
      if (g.areas.some(a => a.name.toLowerCase() === check.value.toLowerCase())) {
        return reply({ error: 'There is already an area with this name' });
      }
      g.areas.push({ name: check.value });
      await g.save();
      reply({ ok: true, id: String(g.areas.at(-1)!._id) });
      await broadcastStays(io, s.code, g);
    } catch (e) {
      console.error('[area:add]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  socket.on('area:rename', async data => {
    try {
      const check = checkAreaName(data?.name);
      if (!check.ok) { socket.emit('err', check.error); return; }
      const open = await openTrip();
      if (!open) return;
      const { s, g } = open;
      const area = g.areas.find(a => String(a._id) === String(data?.id));
      if (!area) return;
      if (g.areas.some(a => a !== area && a.name.toLowerCase() === check.value.toLowerCase())) {
        socket.emit('err', 'There is already an area with this name');
        return;
      }
      area.name = check.value;
      await g.save();
      await broadcastStays(io, s.code, g);
    } catch (e) { console.error('[area:rename]', (e as Error).message); }
  });
}
