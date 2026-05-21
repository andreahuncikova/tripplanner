const mongoose = require('mongoose');
const { Schema } = mongoose;

// _id: false means Mongoose won't add an _id to these sub-documents
const MsgSchema = new Schema({
  userId: Schema.Types.ObjectId, username: String, color: String,
  text: String, time: String,
  system: { type: Boolean, default: false }, // system messages come from the server, not a user
}, { _id: false });

const DestSchema = new Schema({
  name:  { type: String, required: true },
  by:    String,
  votes: { type: [String], default: [] }, // array of usernames who voted for this destination
});

const AvailSchema = new Schema({
  userId: Schema.Types.ObjectId, username: String, color: String,
  unavailableDates: { type: [String], default: [] }, // dates stored as "YYYY-MM-DD" strings
}, { _id: false });

const RangeSchema = new Schema({
  label: String, start: String, end: String,
  votes:    { type: [String],  default: [] },
  selected: { type: Boolean,   default: false }, // true once admin confirms this window
}, { _id: false });

const ActivitySchema = new Schema({
  text: String, addedBy: String, userId: Schema.Types.ObjectId,
  calDate: String, calTime: String, // optional placement on the trip calendar
  createdAt: { type: Date, default: Date.now },
});

const PackItemSchema = new Schema({
  text: { type: String, required: true }, addedBy: String,
  packed: { type: Boolean, default: false }, packedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const ExpenseSchema = new Schema({
  description: String, amount: Number,
  currency:    { type: String, default: 'EUR' },
  paidBy: String, paidByColor: String, // color stored here so we don't need a separate join
  splitAmong: [String], addedBy: String,
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
    enum: ['destinations', 'calendar', 'date_vote', 'done'],
  },
  members:           { type: [MemberSchema],   default: [] },
  destinations:      { type: [DestSchema],     default: [] },
  approvedDest:      { type: String,           default: null },
  availability:      { type: [AvailSchema],    default: [] },
  availabilityReady: { type: [String],         default: [] }, // usernames who confirmed they're done marking days
  dateRanges:        { type: [RangeSchema],    default: [] }, // computed free windows, filled by avail:compute
  finalDate:         { type: String,           default: null },
  finalDateLabel:    { type: String,           default: null },
  activities:        { type: [ActivitySchema], default: [] },
  expenses:          { type: [ExpenseSchema],  default: [] },
  packingList:       { type: [PackItemSchema], default: [] },
  messages:          { type: [MsgSchema],      default: [] },
  createdAt:         { type: Date,             default: Date.now },
});

module.exports = mongoose.model('Group', GroupSchema);
