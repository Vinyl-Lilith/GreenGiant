const express = require('express');
const router = express.Router();
const { ActivityLog } = require('../models');
const { protect, allowWrite } = require('../middleware/auth');
const axios = require('axios');

// All routes require authentication and write permission
router.use(protect, allowWrite);

// ===================================================================
// @route   POST /api/manual/control
// @desc    Manual control of actuators
// @access  Private (write permission)
// ===================================================================
router.post('/control', async (req, res) => {
  try {
    const { actuator, state, pwm } = req.body;

    const validActuators = [
      'pump_water', 'pump_nutrient',
      'fan_exhaust', 'peltier',
      'fan_peltier_hot', 'fan_peltier_cold'
    ];

    if (!actuator || !validActuators.includes(actuator)) {
      return res.status(400).json({
        success: false,
        error: `Invalid actuator. Valid options: ${validActuators.join(', ')}`,
      });
    }

    if (typeof state !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'State must be true or false',
      });
    }

    // Build command for Pi
    const command = {
      actuator,
      state,
    };

    if (pwm !== undefined && (actuator === 'fan_exhaust' || actuator === 'peltier')) {
      command.pwm = Math.max(0, Math.min(255, parseInt(pwm)));
    }

    // Send to Pi
    try {
      const piBaseUrl = process.env.PI_BASE_URL || 'http://localhost:5000';
      const piApiKey = process.env.PI_API_KEY;

      const response = await axios.post(
        `${piBaseUrl}/api/manual`,
        command,
        {
          headers: { 'X-API-Key': piApiKey },
          timeout: 5000,
        }
      );

      // Log activity
      await ActivityLog.create({
        user: req.user._id,
        username: req.user.username,
        action: 'manual_control',
        details: { actuator, state, pwm },
        ipAddress: req.ip,
      });

      // Broadcast to WebSocket clients
      const io = req.app.get('io');
      if (io) {
        io.emit('manual_control', {
          actuator,
          state,
          pwm,
          controlledBy: req.user.username,
          timestamp: new Date(),
        });
      }

      res.json({
        success: true,
        message: `${actuator} ${state ? 'turned ON' : 'turned OFF'}`,
        data: response.data,
      });

    } catch (piError) {
      console.error('Failed to send command to Pi:', piError.message);
      return res.status(503).json({
        success: false,
        error: 'Failed to communicate with greenhouse controller',
      });
    }

  } catch (error) {
    console.error('Manual control error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   POST /api/manual/auto
// @desc    Resume automatic mode (disable manual override)
// @access  Private (write permission)
// ===================================================================
router.post('/auto', async (req, res) => {
  try {
    const piBaseUrl = process.env.PI_BASE_URL || 'http://localhost:5000';
    const piApiKey = process.env.PI_API_KEY;

    const response = await axios.post(
      `${piBaseUrl}/api/auto`,
      {},
      {
        headers: { 'X-API-Key': piApiKey },
        timeout: 5000,
      }
    );

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'manual_control',
      details: { action: 'resume_auto' },
      ipAddress: req.ip,
    });

    // Broadcast
    const io = req.app.get('io');
    if (io) {
      io.emit('auto_mode_resumed', {
        resumedBy: req.user.username,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: 'Automatic mode resumed',
      data: response.data,
    });

  } catch (error) {
    console.error('Auto mode error:', error);
    res.status(503).json({
      success: false,
      error: 'Failed to communicate with greenhouse controller',
    });
  }
});

module.exports = router;
