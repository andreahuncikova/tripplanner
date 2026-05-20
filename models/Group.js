const mongoose = require('mongoose');
const { Schema } = mongoose;

const MsgSchema = new Schema({
  userId:   Schema.Types.ObjectId,
  username: String,
  color:    String,
  text:     String,
  time:     String,
  system:   { type: Boolean, default: false },
}, { _id: false });

const DestSchema = new Schema({
  name:    { type: String, required: true },
  emoji:   { type: String, default: '🌍' },
  by:      String,
  votes:   { type: [String], default: [] },
});

const AvailSchema = new Schema({
  userId:           Schema.Types.ObjectId,
  username:         String,
  color:            String,
  unavailableDates: { type: [String], default: [] },
}, { _id: false });

const RangeSchema = new Schema({
  label:    String,
  start:    String,
  end:      String,
  votes:    { type: [String], default: [] },
  selected: { type: Boolean, default: false },
}, { _id: false });

const ActivitySchema = new Schema({
  text:      String,
  addedBy:   String,
  userId:    Schema.Types.ObjectId,
  calDate:   String,
  calTime:   String,
  createdAt: { type: Date, default: Date.now },
});

const PackItemSchema = new Schema({
  text:     { type: String, required: true },
  addedBy:  String,
  packed:   { type: Boolean, default: false },
  packedBy: { type: String, default: null },
  createdAt:{ type: Date, default: Date.now },
});

const ExpenseSchema = new Schema({
  description:  String,
  amount:       Number,
  currency:     { type: String, default: 'EUR' },
  paidBy:       String,
  paidByColor:  String,
  splitAmong:   [String],
  addedBy:      String,
  createdAt:    { type: Date, default: Date.now },
});

const MemberSchema = new Schema({
  userId:   Schema.Types.ObjectId,
  username: String,
  color:    String,
  joinedAt: { type: Date, default: Date.now },
}, { _id: false });

const GroupSchema = new Schema({
  inviteCode:          { type: String, unique: true, required: true },
  name:                { type: String, required: true },
  adminUserId:         Schema.Types.ObjectId,
  adminUsername:       String,
  tripDuration:        { type: Number, default: null },
  tripWindowStart:     { type: String, default: null },
  tripWindowEnd:       { type: String, default: null },

 
  phase:               { type: String, default: 'destinations', enum: ['destinations','calendar','date_vote','done'] },

  members:             { type: [MemberSchema],  default: [] },
  destinations:        { type: [DestSchema],    default: [] },
  approvedDest:        { type: String, default: null },
  approvedDestEmoji:   { type: String, default: null },

  availability:        { type: [AvailSchema],   default: [] },
  availabilityReady:   { type: [String],        default: [] },
  dateRanges:          { type: [RangeSchema],   default: [] },
  finalDate:           { type: String, default: null },
  finalDateLabel:      { type: String, default: null },

  activities:          { type: [ActivitySchema],  default: [] },
  expenses:            { type: [ExpenseSchema],   default: [] },
  packingList:         { type: [PackItemSchema],  default: [] },
  messages:            { type: [MsgSchema],      default: [] },
  createdAt:           { type: Date, default: Date.now },
});

module.exports = mongoose.model('Group', GroupSchema);
