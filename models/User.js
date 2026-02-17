const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't return password by default
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'head_admin'],
    default: 'user',
  },
  status: {
    type: String,
    enum: ['active', 'banned', 'restricted'],
    default: 'active',
  },
  theme: {
    type: String,
    enum: ['light', 'dark', 'auto'],
    default: 'light',
  },
  lastLogin: {
    type: Date,
  },
  isOnline: {
    type: Boolean,
    default: false,
  },
  socketId: String, // Current Socket.IO connection ID
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Check if user can perform admin actions
UserSchema.methods.isAdmin = function() {
  return this.role === 'admin' || this.role === 'head_admin';
};

UserSchema.methods.isHeadAdmin = function() {
  return this.role === 'head_admin';
};

// Safe user object (no sensitive data)
UserSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    status: this.status,
    theme: this.theme,
    isOnline: this.isOnline,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', UserSchema);
