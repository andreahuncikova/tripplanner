import { isValidObjectId, Types } from 'mongoose';
import Group from '../models/Group';
import Stay from '../models/Stay';
import { checkAreaName, checkStayDetails, checkStayNights } from '../validation';
import { isKnownCurrency } from '../fx';
import { deleteFile, findFile } from '../files';
import { addDay } from '../../../shared/nights';
import { allowPreview, checkLink, getPreview, PreviewError } from '../preview';
import { areaForCity, broadcastStays, MAX_AREAS, MAX_STAYS } from '../stays';
import { sameId } from './helpers';
import type { AppSocket, Ctx } from '../types';

// Stays tab: save stay links, like them, sort them into areas. Every member may do all of it,
// because in most groups the planning is shared; only removing a stay is for whoever added it and the organiser.
export default function register(socket: AppSocket, { io, sessions, userId }: Ctx) {
  // The open trip with its areas, or null when the socket has no trip open
  async function openTrip() {
    const s = sessions[socket.id];
    if (!s) return null;
    const g = await Group.findById(s.groupId, { areas: 1, adminUserId: 1, finalDate: 1, tripDuration: 1 });
    return g ? { s, g } : null;
  }
  // An area id from the client: one of this trip's areas, or null for "no area"
  const areaOf = (g: { areas: { _id: unknown }[] }, id: unknown) =>
    id != null && g.areas.some(a => String(a._id) === String(id)) ? String(id) : null;

  // A stay added under All goes into the area of its city, e.g. a hotel in Ubud into "Ubud".
  // When the trip has no such area yet, it is made, so the group does not have to make areas by hand.
  // The areas are read again here, because reading the link took a few seconds and someone may have added one.
  async function areaFromCity(groupId: unknown, city: string | undefined): Promise<string | null> {
    const fresh = await Group.findById(groupId, { areas: 1 });
    if (!fresh) return null;
    const found = areaForCity(fresh.areas, city);
    if (!found) return null;
    if (found !== 'new') return String(found._id);
    const name = checkAreaName(city);
    if (!name.ok) return null;
    fresh.areas.push({ name: name.value });
    await fresh.save();
    return String(fresh.areas.at(-1)!._id);
  }

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
      const areaId = areaOf(g, data?.areaId) ?? await areaFromCity(g._id, p.city);
      await Stay.create({
        groupId: g._id, areaId, addedByUserId: userId,
        url: p.url, platform: p.platform, title: p.title, image: p.image, price: p.price, location: p.location,
        city: p.city, cityCredit: p.cityCredit, placeId: p.placeId, images: p.images, imageCredits: p.imageCredits,
        complete: p.complete,
      });
      reply({ ok: true });
      await broadcastStays(io, s.code, (await Group.findById(g._id, { areas: 1 })) ?? g);
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
      const stay = await Stay.findOne({ _id: stayId, groupId: open.g._id }, { addedByUserId: 1, image: 1 });
      if (!stay) return;
      if (!sameId(stay.addedByUserId, userId) && !sameId(open.g.adminUserId, userId)) {
        socket.emit('err', 'Only who added a stay, or the organiser, can remove it');
        return;
      }
      await stay.deleteOne();
      // A photo uploaded by hand goes with the stay
      if (stay.image?.startsWith('/api/files/')) {
        const f = await findFile(stay.image.slice('/api/files/'.length));
        if (f) await deleteFile(f._id).catch(() => {});
      }
      await broadcastStays(io, open.s.code, open.g);
    } catch (e) { console.error('[stay:remove]', (e as Error).message); }
  });

  // Choose the nights of a stay (any member, like moving it to an area), or clear them
  socket.on('stay:nights', async (data, done) => {
    const reply = typeof done === 'function' ? done : () => {};
    try {
      if (!isValidObjectId(data?.id)) return reply({ error: 'This stay no longer exists' });
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const { s, g } = open;
      // Once the dates are confirmed the nights must fit in them: the first day to the last day of the trip
      const trip = g.finalDate && g.tripDuration
        ? { start: g.finalDate, end: addDay(g.finalDate, g.tripDuration - 1) } : null;
      const check = checkStayNights(data.nights, trip);
      if (!check.ok) return reply({ error: check.error });
      // A stay without nights cannot stay booked
      const nights = check.value ?? { checkIn: null, checkOut: null, booked: false };
      const r = await Stay.updateOne({ _id: data.id, groupId: g._id }, nights);
      if (!r.matchedCount) return reply({ error: 'This stay no longer exists' });
      reply({ ok: true });
      await broadcastStays(io, s.code, g);
    } catch (e) {
      console.error('[stay:nights]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  // Mark a stay as booked (any member, whoever made the booking) or take it back
  socket.on('stay:booked', async (data, done) => {
    const reply = typeof done === 'function' ? done : () => {};
    try {
      if (!isValidObjectId(data?.id)) return reply({ error: 'This stay no longer exists' });
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const { s, g } = open;
      const stay = await Stay.findOne({ _id: data.id, groupId: g._id }, { checkIn: 1, checkOut: 1 });
      if (!stay) return reply({ error: 'This stay no longer exists' });
      const booked = data.booked === true;
      if (booked && !(stay.checkIn && stay.checkOut)) return reply({ error: 'Choose the nights first' });
      await Stay.updateOne({ _id: stay._id }, { booked });
      reply({ ok: true });
      await broadcastStays(io, s.code, g);
    } catch (e) {
      console.error('[stay:booked]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
  });

  // Fill in or correct a stay by hand (any member, like the nights). The form sends all four fields,
  // which replace what the link preview found.
  socket.on('stay:edit', async (data, done) => {
    const reply = typeof done === 'function' ? done : () => {};
    try {
      if (!isValidObjectId(data?.id)) return reply({ error: 'This stay no longer exists' });
      const check = checkStayDetails(data);
      if (!check.ok) return reply({ error: check.error });
      const d = check.value;
      if (d.price && !(await isKnownCurrency(d.price.currency))) return reply({ error: 'There is no exchange rate for this currency' });
      const open = await openTrip();
      if (!open) return reply({ error: 'Open the trip first' });
      const { s, g } = open;
      const stay = await Stay.findOne({ _id: data.id, groupId: g._id });
      if (!stay) return reply({ error: 'This stay no longer exists' });

      // A new photo must be a stay photo uploaded to this trip, so nobody can show another trip's file here
      const fileOf = (url: string | null | undefined) => (url?.startsWith('/api/files/') ? url.slice('/api/files/'.length) : null);
      let newPhoto: string | null = null;
      if (d.image !== 'keep' && d.image !== null) {
        const f = await findFile(fileOf(d.image)!);
        if (!f || f.meta.kind !== 'stay' || String(f.meta.groupId) !== String(g._id)) return reply({ error: 'Please upload the photo again' });
        newPhoto = d.image;
      }
      // The photo it had before, when it was uploaded by hand and is now replaced or removed: deleted to save space
      const oldUpload = d.image !== 'keep' ? fileOf(stay.image) : null;

      // A location typed by hand: its first part is the city ("Ubud, Indonesia" → "Ubud"), and OpenStreetMap
      // is no longer its source. An unchanged location keeps its city and credit.
      if (d.location !== (stay.location ?? null)) {
        stay.set({ city: d.location?.split(',')[0].trim() || undefined, cityCredit: undefined });
      }
      stay.set({ title: d.title ?? undefined, price: d.price ?? undefined, location: d.location ?? undefined });
      if (d.image !== 'keep') {
        stay.set({ image: newPhoto ?? undefined, images: newPhoto ? [newPhoto] : undefined, placeId: undefined, imageCredits: undefined });
      }
      stay.complete = !!(stay.title && stay.image && stay.price?.amount != null && stay.location);
      await stay.save();
      if (oldUpload && oldUpload !== fileOf(newPhoto)) {
        const old = await findFile(oldUpload);
        if (old) await deleteFile(old._id).catch(() => {});
      }
      reply({ ok: true });
      await broadcastStays(io, s.code, g);
    } catch (e) {
      console.error('[stay:edit]', (e as Error).message);
      reply({ error: 'Server error — please try again' });
    }
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
