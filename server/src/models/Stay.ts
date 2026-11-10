import { Schema, model, InferSchemaType } from 'mongoose';

// One saved stay link of a trip. Stays have their own collection, like the chat messages,
// so the trip document does not grow with every link and is not loaded whole for a like.
// The details (title, photo, price, location) come from the link preview and may be missing.
const StaySchema = new Schema({
  groupId:  { type: Schema.Types.ObjectId, required: true },  // the trip (Group)
  areaId:   { type: Schema.Types.ObjectId, default: null },   // one of the trip's areas, or none yet
  url:      { type: String, required: true },                 // the link after redirects
  platform: { type: String, required: true },                 // booking, airbnb… (StayPlatform)
  title:    String,
  image:    String,
  price:    { type: { amount: Number, currency: String }, default: undefined, _id: false },
  location: String,
  placeId:  String,                                          // the photo is from Google Maps (preview/places.ts)
  images:   { type: [String], default: undefined },          // every photo, images[0] is image
  imageCredits: { type: [String], default: undefined },     // credit for each Google Maps photo
  complete: { type: Boolean, default: false },
  addedByUserId: { type: Schema.Types.ObjectId, required: true },
  likeUserIds:   { type: [Schema.Types.ObjectId], default: [] },
  createdAt: { type: Date, default: Date.now },
});

// The Stays tab loads all stays of one trip, newest first
StaySchema.index({ groupId: 1, createdAt: -1 });

export type IStay = InferSchemaType<typeof StaySchema>;

export default model('Stay', StaySchema);
