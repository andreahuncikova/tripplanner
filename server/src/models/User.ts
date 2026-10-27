import { Schema, model, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  email: string;
  password: string;
  username: string;
  color: string;
}

// The user data that is safe to send to the browser (no password)
export interface SafeUser {
  _id: Types.ObjectId;
  email: string;
  username: string;
  color: string;
}

interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  toSafe(): SafeUser;
}

type UserModel = Model<IUser, {}, IUserMethods>;

const UserSchema = new Schema<IUser, UserModel, IUserMethods>({
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  // Hides password from queries
  password: { type: String, required: true, minlength: 6, select: false },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  color:    { type: String, default: '#4A90A4' },
});

// Hash password before saving
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare login password
UserSchema.methods.comparePassword = function(candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

// Return safe user data
UserSchema.methods.toSafe = function() {
  return { _id: this._id, email: this.email, username: this.username, color: this.color };
};

export default model<IUser, UserModel>('User', UserSchema);
