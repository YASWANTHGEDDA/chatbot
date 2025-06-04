const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Please provide a username'],
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },
  role: {
    type: String,
    enum: ['mentor', 'mentee', 'admin'],
    required: [true, 'Please provide a role'],
    default: 'mentee',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Password hashing middleware
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    console.error("Attempted to compare password, but password field was not loaded on the User object.");
    throw new Error("Password field not available for comparison.");
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Static method to find user by credentials
UserSchema.statics.findByCredentials = async function(username, password) {
  const user = await this.findOne({ username }).select('+password');
  if (!user) {
    console.log(`findByCredentials: User not found for username: ${username}`);
    return null;
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    console.log(`findByCredentials: Password mismatch for username: ${username}`);
    return null;
  }
  console.log(`findByCredentials: Credentials match for username: ${username}`);
  return user;
};

const User = mongoose.model('User', UserSchema);
module.exports = User;