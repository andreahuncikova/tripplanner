import { describe, it, expect } from 'vitest';
import { migrateGroup } from '../src/migrations/userIds';

const MIA = 'u-mia', BEN = 'u-ben', EVA = 'u-eva';
const ids = (v: unknown) => (v as unknown[]).map(String);

// A trip as the old version stored it: people by username
const oldTrip = () => ({
  adminUsername: 'Mia', adminUserId: MIA,
  members: [{ userId: MIA, username: 'Mia' }, { userId: BEN, username: 'Ben' }],
  destinations: [{ _id: 'd1', name: 'Lisbon', by: 'Ben', votes: ['Mia', 'Ben'] }],
  dateRanges: [{ label: '1 – 9 May', start: '2027-05-01', end: '2027-05-09', votes: ['Ben'], selected: false }],
  availabilityReady: ['Mia'],
  availability: [{ userId: EVA, username: 'Eva', unavailableDates: [] }],
  expenses: [{ _id: 'e1', description: 'Dinner', amount: 60, paidBy: 'Ben', paidByColor: '#000', splitAmong: ['Mia', 'Ben', 'Eva'], addedBy: 'Ben' }],
  messages: [],
});

describe('migrateGroup', () => {
  it('turns usernames into user ids', () => {
    const m = migrateGroup(oldTrip())!;
    const [dest] = m.set.destinations as Record<string, unknown>[];
    expect(dest.byUserId).toBe(BEN);
    expect(ids(dest.voterIds)).toEqual([MIA, BEN]);
    expect('votes' in dest).toBe(false);

    const [range] = m.set.dateRanges as Record<string, unknown>[];
    expect(ids(range.voterIds)).toEqual([BEN]);

    expect(ids(m.set.readyUserIds)).toEqual([MIA]);
    expect(m.unset).toEqual(['availabilityReady']);

    const [exp] = m.set.expenses as Record<string, unknown>[];
    expect(exp.paidByUserId).toBe(BEN);
    expect(exp.addedByUserId).toBe(BEN);
    expect(ids(exp.splitAmongUserIds)).toEqual([MIA, BEN, EVA]);   // Eva left, but is known from her availability
    expect('paidBy' in exp || 'paidByColor' in exp || 'splitAmong' in exp).toBe(false);
  });

  it('keeps the other fields of every item', () => {
    const m = migrateGroup(oldTrip())!;
    const [dest] = m.set.destinations as Record<string, unknown>[];
    const [exp] = m.set.expenses as Record<string, unknown>[];
    expect(dest).toMatchObject({ _id: 'd1', name: 'Lisbon', by: 'Ben' });
    expect(exp).toMatchObject({ _id: 'e1', description: 'Dinner', amount: 60 });
  });

  it('drops names it cannot match, and names that two members share', () => {
    const trip = oldTrip();
    trip.members.push({ userId: 'u-mia-2', username: 'Mia' });          // a second "Mia"
    trip.destinations[0].votes = ['Mia', 'Ben', 'Stranger'];
    const m = migrateGroup(trip)!;
    const [dest] = m.set.destinations as Record<string, unknown>[];
    expect(ids(dest.voterIds)).toEqual([BEN]);
    expect(m.unknownNames.sort()).toEqual(['Mia', 'Stranger']);
  });

  it('does nothing for a trip that is already in the new shape', () => {
    expect(migrateGroup({
      members: [{ userId: MIA, username: 'Mia' }],
      destinations: [{ name: 'Lisbon', by: 'Mia', byUserId: MIA, voterIds: [MIA] }],
      dateRanges: [{ label: 'x', voterIds: [] }],
      readyUserIds: [],
      expenses: [{ description: 'Taxi', paidByUserId: MIA, splitAmongUserIds: [MIA], addedByUserId: MIA }],
    })).toBeNull();
  });
});
