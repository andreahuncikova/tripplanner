import { Schema, model } from 'mongoose';

// One chat message of a trip. Messages used to be an array inside the trip document,
// which grew with every message and was loaded whole each time anything in the trip changed.
// Now each message is its own document and the trip is found by groupId.
const MessageSchema = new Schema({
  groupId:  { type: Schema.Types.ObjectId, required: true },  // the trip (Group) it belongs to
  userId:   Schema.Types.ObjectId,                            // who wrote it; empty for system messages
  username: String, color: String,                            // for display, as they were when it was sent
  text:     { type: String, required: true },
  time:     String,                                           // "HH:MM" shown next to the message
  system:   { type: Boolean, default: false },                // from the server, e.g. "Bali was chosen"
  createdAt: { type: Date, default: Date.now },               // for sorting
});

// Opening a trip loads its newest messages, so they are indexed by trip and time
MessageSchema.index({ groupId: 1, createdAt: -1 });

export default model('Message', MessageSchema);
