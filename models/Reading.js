const mongoose = require('mongoose');

const ReadingSchema = new mongoose.Schema({
  // Temperature & Humidity
  temp: {
    type: Number,
    required: true,
  },
  hum: {
    type: Number,
    required: true,
  },
  
  // Individual DHT sensors (for debugging)
  dht11: {
    ok: Boolean,
    temp: Number,
    hum: Number,
  },
  dht22: {
    ok: Boolean,
    temp: Number,
    hum: Number,
  },
  
  // Soil moisture
  soil1: {
    type: Number,
    required: true,
  },
  soil2: {
    type: Number,
    required: true,
  },
  
  // NPK sensor
  npk: {
    ok: Boolean,
    n: Number,
    p: Number,
    k: Number,
  },
  
  // Actuator states (snapshot)
  actuators: {
    pump_water: Boolean,
    pump_nutrient: Boolean,
    fan_exhaust: Boolean,
    peltier_pwm: Number,
    peltier_target: Number,
    peltier_ramping: Boolean,
    fan_peltier_hot: Boolean,
    fan_peltier_cold: Boolean,
    manual_override: Boolean,
  },
  
  // Timestamp from Arduino (if available)
  recorded_at: {
    type: Date,
  },
  
  // Timestamp when backend received it
  received_at: {
    type: Date,
    default: Date.now,
    index: true, // Index for fast time-range queries
  },
}, {
  timestamps: true,
});

// Index for efficient 24-hour queries
ReadingSchema.index({ received_at: -1 });

// Static method to get 24-hour data
ReadingSchema.statics.getLast24Hours = function() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.find({ received_at: { $gte: twentyFourHoursAgo } })
    .sort({ received_at: 1 })
    .lean();
};

// Static method to get data for a specific date
ReadingSchema.statics.getByDate = function(dateStr) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  
  return this.find({
    received_at: { $gte: start, $lte: end }
  }).sort({ received_at: 1 }).lean();
};

module.exports = mongoose.model('Reading', ReadingSchema);
