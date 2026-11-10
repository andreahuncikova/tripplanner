import { Types } from 'mongoose';
import Stay from './models/Stay';
import type { IGroup } from './models/Group';
import type { IO, StaysState } from './types';

type GroupId = Types.ObjectId | string;

// A trip may have at most this many stays and areas, so one group cannot fill the database
export const MAX_STAYS = 100;
export const MAX_AREAS = 20;

// All stays and areas of a trip, as the client sees them (ids and dates as text)
export async function staysState(g: Pick<IGroup, 'areas'> & { _id: GroupId }): Promise<StaysState> {
  const stays = await Stay.find({ groupId: g._id }).sort({ createdAt: -1, _id: -1 }).lean();
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
      ...(s.placeId && { placeId: s.placeId }),
      ...(s.images?.length && { images: s.images }),
      ...(s.imageCredits?.length && { imageCredits: s.imageCredits }),
      complete: s.complete,
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
