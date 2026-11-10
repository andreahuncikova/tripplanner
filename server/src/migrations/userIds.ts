// One-time change of old trips: votes, "ready" and expenses used to be stored by username,
// now they are stored by user id (models/Group.ts). This turns one old group document into the update
// that fixes it. It only reads the document, so it can be tested without a database.
// Run it on the database with: npm run migrate:user-ids   (add -- --apply to really write)

type Doc = Record<string, unknown>;
type Id = { toString(): string };

export interface Migration {
  set: Doc;                 // new fields for $set
  unset: string[];          // old fields for $unset
  unknownNames: string[];   // names that are not one member (left the trip, or two members with that name)
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export function migrateGroup(g: Doc): Migration | null {
  // Name -> user id, from the members, then from other places that store both (people who left)
  const byName = new Map<string, Id>();
  const twice = new Set<string>();
  const learn = (name: unknown, id: unknown) => {
    if (typeof name !== 'string' || id == null) return;
    const known = byName.get(name);
    if (known && String(known) !== String(id)) twice.add(name);
    else byName.set(name, id as Id);
  };
  list(g.members).forEach(m => learn((m as Doc).username, (m as Doc).userId));
  learn(g.adminUsername, g.adminUserId);
  list(g.availability).forEach(a => learn((a as Doc).username, (a as Doc).userId));
  list(g.activities).forEach(a => learn((a as Doc).addedBy, (a as Doc).userId));
  list(g.messages).forEach(m => learn((m as Doc).username, (m as Doc).userId));

  const unknownNames = new Set<string>();
  // Two members with the same name cannot be told apart, so their old votes are dropped
  const idOf = (name: unknown): Id | null => {
    if (typeof name !== 'string') return null;
    const id = twice.has(name) ? undefined : byName.get(name);
    if (!id) unknownNames.add(name);
    return id ?? null;
  };
  const idsOf = (names: unknown) => list(names).map(idOf).filter((id): id is Id => id !== null);

  const set: Doc = {};
  const unset: string[] = [];

  const dests = list(g.destinations) as Doc[];
  if (dests.some(d => 'votes' in d || (typeof d.by === 'string' && !d.byUserId))) {
    set.destinations = dests.map(({ votes, ...d }) => ({
      ...d,
      byUserId: d.byUserId ?? idOf(d.by),
      voterIds: d.voterIds ?? idsOf(votes),
    }));
  }

  const ranges = list(g.dateRanges) as Doc[];
  if (ranges.some(r => 'votes' in r)) {
    set.dateRanges = ranges.map(({ votes, ...r }) => ({ ...r, voterIds: r.voterIds ?? idsOf(votes) }));
  }

  if ('availabilityReady' in g) {
    set.readyUserIds = g.readyUserIds ?? idsOf(g.availabilityReady);
    unset.push('availabilityReady');
  }

  const expenses = list(g.expenses) as Doc[];
  if (expenses.some(e => 'paidBy' in e || 'splitAmong' in e || 'addedBy' in e)) {
    set.expenses = expenses.map(({ paidBy, paidByColor: _color, splitAmong, addedBy, ...e }) => ({
      ...e,
      paidByUserId: e.paidByUserId ?? idOf(paidBy),
      splitAmongUserIds: e.splitAmongUserIds ?? idsOf(splitAmong),
      addedByUserId: e.addedByUserId ?? idOf(addedBy),
    }));
  }

  if (!Object.keys(set).length && !unset.length) return null;   // already in the new shape
  return { set, unset, unknownNames: [...unknownNames] };
}
