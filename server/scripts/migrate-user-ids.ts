// Changes old trips in the database from usernames to user ids (see src/migrations/userIds.ts).
//   npm run migrate:user-ids              shows what would change, writes nothing
//   npm run migrate:user-ids -- --apply   writes the changes
// It uses MONGO_URI from server/.env, so check which database that is before using --apply.
import 'dotenv/config';
import '../src/dns';
import mongoose from 'mongoose';
import { migrateGroup } from '../src/migrations/userIds';

const apply = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
  // The raw collection, because the old fields (votes, availabilityReady, paidBy…) are no longer in the schema
  const groups = mongoose.connection.collection('groups');

  let changed = 0, total = 0;
  for await (const g of groups.find()) {
    total++;
    const m = migrateGroup(g);
    if (!m) continue;
    changed++;
    console.log(`${g.inviteCode} "${g.name}": ${Object.keys(m.set).join(', ')}` +
      (m.unknownNames.length ? `  (dropped, not one member: ${m.unknownNames.join(', ')})` : ''));
    if (apply) {
      await groups.updateOne({ _id: g._id }, {
        $set: m.set,
        ...(m.unset.length && { $unset: Object.fromEntries(m.unset.map(f => [f, ''])) }),
      });
    }
  }
  console.log(`\n${changed} of ${total} trips ${apply ? 'changed' : 'would change (dry run, nothing written; add -- --apply to write)'}.`);
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
