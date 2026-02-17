const express = require('express');
const router = express.Router();
const { Threshold, ActivityLog } = require('../models');
const { protect, allowWrite } = require('../middleware/auth');
const axios = require('axios');

// All routes require authentication
router.use(protect);

// ===================================================================
// THRESHOLD ROUTES
// ===================================================================

// @route   GET /api/thresholds
// @desc    Get current thresholds
// @access  Private
router.get('/', async (req, res) => {
  try {
    const thresholds = await Threshold.getCurrent();

    res.json({
      success: true,
      data: {
        soil1: thresholds.soil1,
        soil2: thresholds.soil2,
        temp_high: thresholds.temp_high,
        temp_low: thresholds.temp_low,
        hum_high: thresholds.hum_high,
        hum_low: thresholds.hum_low,
        npk_n: thresholds.npk_n,
        npk_p: thresholds.npk_p,
        npk_k: thresholds.npk_k,
        lastUpdatedBy: thresholds.lastUpdatedBy,
        lastSyncedWithArduino: thresholds.lastSyncedWithArduino,
        updatedAt: thresholds.updatedAt,
      },
    });

  } catch (error) {
    console.error('Error fetching thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   PUT /api/thresholds
// @desc    Update one or more thresholds
// @access  Private (write permission)
router.put('/', allowWrite, async (req, res) => {
  try {
    const updates = req.body;
    const thresholds = await Threshold.getCurrent();

    // Valid threshold keys
    const validKeys = ['soil1', 'soil2', 'temp_high', 'temp_low', 'hum_high', 'hum_low', 'npk_n', 'npk_p', 'npk_k'];

    // Apply updates
    const changed = {};
    for (const key of validKeys) {
      if (updates[key] !== undefined) {
        thresholds[key] = updates[key];
        changed[key] = updates[key];
      }
    }

    thresholds.lastUpdatedBy = req.user._id;
    await thresholds.save();

    // Send to Pi/Arduino via Pi's local API
    try {
      const piBaseUrl = process.env.PI_BASE_URL || 'http://localhost:5000';
      const piApiKey = process.env.PI_API_KEY;

      // Send bulk update to Pi
      await axios.post(`${piBaseUrl}/api/thresholds/bulk`, changed, {
        headers: { 'X-API-Key': piApiKey },
        timeout: 5000,
      });

      thresholds.lastSyncedWithArduino = new Date();
      await thresholds.save();

    } catch (piError) {
      console.error('Failed to sync with Pi:', piError.message);
      // Don't fail the request — backend is updated, Pi will sync eventually
    }

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'threshold_changed',
      details: { changed },
      ipAddress: req.ip,
    });

    // Broadcast to WebSocket clients
    const io = req.app.get('io');
    if (io) {
      io.emit('threshold_update', {
        ...changed,
        updatedBy: req.user.username,
      });
    }

    res.json({
      success: true,
      data: thresholds,
      message: 'Thresholds updated successfully',
    });

  } catch (error) {
    console.error('Error updating thresholds:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

module.exports = router;
