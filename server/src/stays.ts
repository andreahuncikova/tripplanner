import { Types } from 'mongoose';
import Stay from './models/Stay';
import type { IGroup } from './models/Group';
import type { IO, StaysState } from './types';

type GroupId = Types.ObjectId | string;

// A trip may have at most this many stays and areas, so one group cannot fill the database
export const MAX_STAYS = 100;
export const MAX_AREAS = 20;

// Names compared the way people read them: "Ubud", "ubud " and "Ubúd" are the same area
export const sameName = (a: string, b: string) => {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  return norm(a) === norm(b);
};

// Which area a new stay from this city goes into: an existing area with the city's name,
// 'new' when the trip has none yet (the caller makes it), or null to leave the stay without an area
export function areaForCity<A extends { _id: unknown; name: string }>(areas: A[], city: string | undefined): A | 'new' | null {
  if (!city?.trim()) return null;
  return areas.find(a => sameName(a.name, city)) ?? (areas.length < MAX_AREAS ? 'new' : null);
}

// All stays and areas of a trip, as the client sees them (ids and dates as text).
// Order: booked stays first, then the most liked, then the newest. The sort is stable, so stays with as many likes
// keep the newest-first order from the database. Every like sends the list again, so the cards move for everyone.
export async function staysState(g: Pick<IGroup, 'areas'> & { _id: GroupId }): Promise<StaysState> {
  const stays = (await Stay.find({ groupId: g._id }).sort({ createdAt: -1, _id: -1 }).lean())
    .sort((a, b) => Number(!!b.booked) - Number(!!a.booked) || (b.likeUserIds?.length ?? 0) - (a.likeUserIds?.length ?? 0));
  return {
    areas: g.areas.map(a => ({ _id: String((a as { _id: unknown })._id), name: a.name })),
    stays: stays.map(s => ({
      _id: String(s._id),
      areaId: s.areaId ? String(s.areaId) : null,
      url: s.url,
      platform: s.platform as StaysState['stays'][number]['platform'],
      ...(s.title && { title: s.title }),
      ...(s.image && { image: s.image }),
      ...(s.price?.amount != null && s.price.currency && { price: { amount: s.price.amount, currency: s.price.currency } }),
      ...(s.location && { location: s.location }),
      ...(s.city && { city: s.city }),
      ...(s.cityCredit === 'osm' && { cityCredit: 'osm' as const }),
      ...(s.placeId && { placeId: s.placeId }),
      ...(s.images?.length && { images: s.images }),
      ...(s.imageCredits?.length && { imageCredits: s.imageCredits }),
      complete: s.complete,
      ...(s.checkIn && s.checkOut && { nights: { checkIn: s.checkIn, checkOut: s.checkOut } }),
      booked: !!(s.booked && s.checkIn && s.checkOut),
      addedByUserId: String(s.addedByUserId),
      likeUserIds: s.likeUserIds.map(String),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

// Sends the stays and areas to everyone who has the trip open
export async function broadcastStays(io: IO, code: string, g: Pick<IGroup, 'areas'> & { _id: GroupId }) {
  io.to(code).emit('stays', await staysState(g));
}

// When a trip is deleted
export async function deleteStays(groupId: GroupId) {
  await Stay.deleteMany({ groupId });
}

// When someone leaves a trip their likes no longer count, like their votes. The stays they added stay.
export async function removeLikes(groupId: GroupId, userId: unknown) {
  if (userId == null) return;
  await Stay.updateMany({ groupId }, { $pull: { likeUserIds: new Types.ObjectId(String(userId)) } });
}
