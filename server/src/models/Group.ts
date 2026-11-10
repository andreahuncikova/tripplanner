import { Schema, model, InferSchemaType } from 'mongoose';

// _id: false means Mongoose won't add an _id to these sub-documents
const MsgSchema = new Schema({
  userId: Schema.Types.ObjectId, username: String, color: String,
  text: String, time: String,
  system: { type: Boolean, default: false }, // system messages come from the server, not a user
}, { _id: false });

// People are stored by user id, not by username: two members can have the same name,
// and a name can change. The name fields (by, addedBy, username) are only for display.
const DestSchema = new Schema({
  name:     { type: String, required: true },
  by:       String,                                            // name of who suggested it, for display
  byUserId: Schema.Types.ObjectId,                             // who suggested it (may edit or remove it)
  voterIds: { type: [Schema.Types.ObjectId], default: [] },    // members who voted for this destination
});

const AvailSchema = new Schema({
  userId: Schema.Types.ObjectId, username: String, color: String,
  unavailableDates: { type: [String], default: [] }, // dates stored as "YYYY-MM-DD" strings
}, { _id: false });

const RangeSchema = new Schema({
  label: String, start: String, end: String,
  voterIds: { type: [Schema.Types.ObjectId], default: [] },    // members who voted for this window
  selected: { type: Boolean,   default: false }, // true once admin confirms this window
}, { _id: false });

const ActivitySchema = new Schema({
  text: String, addedBy: String, userId: Schema.Types.ObjectId,
  calDate: String, calTime: String, // optional placement on the trip calendar
  createdAt: { type: Date, default: Date.now },
});

// Names and colours of the payer and the others come from the members list on the client
const ExpenseSchema = new Schema({
  description: String, amount: Number,
  currency:    { type: String, default: 'EUR' },
  paidByUserId:      Schema.Types.ObjectId,                    // who paid
  splitAmongUserIds: { type: [Schema.Types.ObjectId], default: [] }, // who shares the cost
  addedByUserId:     Schema.Types.ObjectId,                    // who added it (may edit or remove it)
  createdAt: { type: Date, default: Date.now },
});

const MemberSchema = new Schema({
  userId: Schema.Types.ObjectId, username: String, color: String,
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

// The main document that holds everything for one trip group.
// The trip moves through 4 phases in order: destinations → calendar → date_vote → done
const GroupSchema = new Schema({
  inviteCode:    { type: String, unique: true, required: true },
  name:          { type: String, required: true },
  adminUserId:   Schema.Types.ObjectId,
  adminUsername: String,
  tripDuration:  { type: Number, default: null },
  tripWindowStart: { type: String, default: null }, // "YYYY-MM-DD" — first day of the allowed travel period
  tripWindowEnd:   { type: String, default: null }, // "YYYY-MM-DD" — last day of the allowed travel period
  phase: {
    type: String, default: 'destinations',
    enum: ['destinations', 'calendar', 'date_vote', 'done'] as const,
  },
  members:           { type: [MemberSchema],   default: [] },
  destinations:      { type: [DestSchema],     default: [] },
  approvedDest:      { type: String,           default: null },
  availability:      { type: [AvailSchema],    default: [] },
  readyUserIds:      { type: [Schema.Types.ObjectId], default: [] }, // members who confirmed they're done marking days
  dateRanges:        { type: [RangeSchema],    default: [] }, // computed free windows, filled by avail:compute
  finalDate:         { type: String,           default: null },
  finalDateLabel:    { type: String,           default: null },
  activities:        { type: [ActivitySchema], default: [] },
  expenses:          { type: [ExpenseSchema],  default: [] },
  messages:          { type: [MsgSchema],      default: [] },
  createdAt:         { type: Date,             default: Date.now },
});

// TypeScript reads the field types straight from the schema above, so we don't write them twice
export type IGroup = InferSchemaType<typeof GroupSchema>;

export default model('Group', GroupSchema);
