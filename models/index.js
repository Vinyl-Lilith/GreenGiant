const mongoose = require('mongoose');

// ===================================================================
// EVENT MODEL — Automation events (pump on/off, fan changes, etc.)
// ===================================================================
const EventSchema = new mongoose.Schema({
  event: {
    type: String,
    required: true,
    index: true,
  },
  reason: String,
  recorded_at: {
    type: Date,
    index: true,
  },
  received_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

EventSchema.index({ received_at: -1 });

// ===================================================================
// ACTIVITY LOG — User actions (admin panel requirement)
// ===================================================================
const ActivityLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  username: String, // Denormalized for faster queries
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'threshold_changed',
      'manual_control',
      'user_created',
      'user_deleted',
      'user_banned',
      'user_promoted',
      'user_demoted',
      'password_changed',
      'forgot_password_approved',
      'forgot_password_rejected',
      'username_changed',
    ],
  },
  details: mongoose.Schema.Types.Mixed, // Flexible field for action-specific data
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

// TTL index — auto-delete logs older than 30 days
ActivityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Get 24-hour log
ActivityLogSchema.statics.getLast24Hours = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({ timestamp: { $gte: twentyFourHoursAgo } })
    .populate('user', 'username role')
    .sort({ timestamp: -1 })
    .lean();
};

// ===================================================================
// FORGOT PASSWORD REQUEST
// ===================================================================
const ForgotPasswordRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  username: String,
  email: String,
  message: String, // User's message to admin
  rememberedPassword: String, // Optional: hashed password user thinks they remember
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  newPassword: String, // Admin-set new password (hashed)
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  resolvedAt: Date,
}, {
  timestamps: true,
});

// ===================================================================
// THRESHOLD MODEL — Current Arduino thresholds
// ===================================================================
const ThresholdSchema = new mongoose.Schema({
  // Only one document exists — singleton pattern
  soil1: { type: Number, default: 60 },
  soil2: { type: Number, default: 60 },
  temp_high: { type: Number, default: 35 },
  temp_low: { type: Number, default: 15 },
  hum_high: { type: Number, default: 80 },
  hum_low: { type: Number, default: 30 },
  npk_n: { type: Number, default: 20 },
  npk_p: { type: Number, default: 20 },
  npk_k: { type: Number, default: 20 },
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  lastSyncedWithArduino: {
    type: Date,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Ensure only one threshold document exists
ThresholdSchema.statics.getCurrent = async function() {
  let threshold = await this.findOne();
  if (!threshold) {
    threshold = await this.create({});
  }
  return threshold;
};

// ===================================================================
// PI STATUS MODEL — Raspberry Pi heartbeat/status
// ===================================================================
const PiStatusSchema = new mongoose.Schema({
  // Only one document — singleton
  arduino_connected: Boolean,
  backend_reachable: Boolean,
  wifi_available: Boolean,
  arduino_port: String,
  webcam_device: String,
  webcam_active: Boolean,
  arduino_reboot_count: Number,
  pending_readings: Number,
  lastHeartbeat: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: true,
});

PiStatusSchema.statics.updateStatus = async function(data) {
  return this.findOneAndUpdate(
    {},
    { ...data, lastHeartbeat: new Date() },
    { upsert: true, new: true }
  );
};

// ===================================================================
// SYSTEM ALERT MODEL — Critical alerts from Pi/Arduino
// ===================================================================
const SystemAlertSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['INFO', 'WARNING', 'ERROR', 'CRITICAL'],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  source: {
    type: String,
    enum: ['pi', 'arduino', 'backend'],
    default: 'pi',
  },
  acknowledged: {
    type: Boolean,
    default: false,
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  timestamps: false,
});

// Auto-delete alerts older than 7 days
SystemAlertSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// ===================================================================
// EXPORTS
// ===================================================================
module.exports = {
  Event: mongoose.model('Event', EventSchema),
  ActivityLog: mongoose.model('ActivityLog', ActivityLogSchema),
  ForgotPasswordRequest: mongoose.model('ForgotPasswordRequest', ForgotPasswordRequestSchema),
  Threshold: mongoose.model('Threshold', ThresholdSchema),
  PiStatus: mongoose.model('PiStatus', PiStatusSchema),
  SystemAlert: mongoose.model('SystemAlert', SystemAlertSchema),
};
