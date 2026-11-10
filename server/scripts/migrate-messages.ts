// Moves chat messages out of old trips into the messages collection (see src/migrations/messages.ts).
//   npm run migrate:messages              shows what would change, writes nothing
//   npm run migrate:messages -- --apply   writes the changes
// It uses MONGO_URI from server/.env, so check which database that is before using --apply.
import 'dotenv/config';
import '../src/dns';
import mongoose from 'mongoose';
import { messagesToMove } from '../src/migrations/messages';

const apply = process.argv.includes('--apply');

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(uri);
  // The raw collections, because "messages" is no longer in the Group schema
  const groups   = mongoose.connection.collection('groups');
  const messages = mongoose.connection.collection('messages');

  let moved = 0, total = 0;
  for await (const g of groups.find({ messages: { $exists: true } })) {
    total++;
    const list = messagesToMove(g);
    moved += list.length;
    console.log(`${g.inviteCode} "${g.name}": ${list.length} messages`);
    if (apply) {
      // Insert first, then remove the array. Moved messages are marked, so if the script stops in between,
      // running it again does not copy them twice (new messages written meanwhile are not marked)
      const already = await messages.countDocuments({ groupId: g._id, migrated: true });
      if (!already && list.length) await messages.insertMany(list.map(m => ({ ...m, migrated: true })));
      await groups.updateOne({ _id: g._id }, { $unset: { messages: '' } });
    }
  }
  console.log(`\n${total} old trips, ${moved} messages ` +
    (apply ? 'moved.' : 'would move (dry run, nothing written; add -- --apply to write).'));
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
