const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  username: { type: String, required: true, trim: true, maxlength: 30 },
  color:    { type: String, default: '#4A90A4' },
  createdAt:{ type: Date, default: Date.now }
});

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.toSafe = function() {
  return { _id: this._id, email: this.email, username: this.username, color: this.color };
};

module.exports = mongoose.model('User', UserSchema);
