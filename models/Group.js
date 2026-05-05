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
  createdAt: { type: Date, default: Date.now },
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
  tripDuration:        { type: Number, default: 3 },

  // Flow: destinations → calendar → date_vote → done
  phase:               { type: String, default: 'destinations', enum: ['destinations','calendar','date_vote','done'] },

  members:             { type: [MemberSchema],  default: [] },
  destinations:        { type: [DestSchema],    default: [] },
  approvedDest:        { type: String, default: null },
  approvedDestEmoji:   { type: String, default: null },

  availability:        { type: [AvailSchema],   default: [] },
  dateRanges:          { type: [RangeSchema],   default: [] },
  finalDate:           { type: String, default: null },
  finalDateLabel:      { type: String, default: null },

  activities:          { type: [ActivitySchema], default: [] },
  messages:            { type: [MsgSchema],      default: [] },
  createdAt:           { type: Date, default: Date.now },
});

module.exports = mongoose.model('Group', GroupSchema);
