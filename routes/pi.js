const express = require('express');
const router = express.Router();
const Reading = require('../models/Reading');
const { Event, PiStatus, SystemAlert } = require('../models');
const { piAuth } = require('../middleware/auth');

// All Pi routes require API key authentication
router.use(piAuth);

// ===================================================================
// @route   POST /api/pi/readings
// @desc    Receive batch of sensor readings from Pi
// @access  Pi (API key)
// ===================================================================
router.post('/readings', async (req, res) => {
  try {
    const { readings } = req.body;

    if (!readings || !Array.isArray(readings)) {
      return res.status(400).json({
        success: false,
        error: 'Readings array required',
      });
    }

    // Insert all readings
    const inserted = await Reading.insertMany(
      readings.map(r => ({
        ...r,
        received_at: new Date(),
        recorded_at: r.recorded_at ? new Date(r.recorded_at) : new Date(),
      }))
    );

    // Broadcast to connected WebSocket clients
    const io = req.app.get('io');
    if (io && inserted.length > 0) {
      io.emit('new_reading', inserted[inserted.length - 1]); // Latest reading
    }

    res.json({
      success: true,
      count: inserted.length,
    });

  } catch (error) {
    console.error('Error inserting readings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save readings',
    });
  }
});

// ===================================================================
// @route   POST /api/pi/events
// @desc    Receive automation events from Pi
// @access  Pi (API key)
// ===================================================================
router.post('/events', async (req, res) => {
  try {
    const { events } = req.body;

    if (!events || !Array.isArray(events)) {
      return res.status(400).json({
        success: false,
        error: 'Events array required',
      });
    }

    const inserted = await Event.insertMany(
      events.map(e => ({
        ...e,
        received_at: new Date(),
        recorded_at: e.recorded_at ? new Date(e.recorded_at) : new Date(),
      }))
    );

    // Broadcast events
    const io = req.app.get('io');
    if (io && inserted.length > 0) {
      inserted.forEach(event => {
        io.emit('automation_event', event);
      });
    }

    res.json({
      success: true,
      count: inserted.length,
    });

  } catch (error) {
    console.error('Error inserting events:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save events',
    });
  }
});

// ===================================================================
// @route   POST /api/pi/heartbeat
// @desc    Pi status heartbeat
// @access  Pi (API key)
// ===================================================================
router.post('/heartbeat', async (req, res) => {
  try {
    const statusData = req.body;

    await PiStatus.updateStatus(statusData);

    // Broadcast status to clients
    const io = req.app.get('io');
    if (io) {
      io.emit('pi_status', statusData);
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update status',
    });
  }
});

// ===================================================================
// @route   POST /api/pi/alerts
// @desc    Receive system alerts from Pi
// @access  Pi (API key)
// ===================================================================
router.post('/alerts', async (req, res) => {
  try {
    const { alerts } = req.body;

    if (!alerts || !Array.isArray(alerts)) {
      return res.status(400).json({
        success: false,
        error: 'Alerts array required',
      });
    }

    const inserted = await SystemAlert.insertMany(
      alerts.map(a => ({
        ...a,
        source: 'pi',
        timestamp: a.timestamp ? new Date(a.timestamp) : new Date(),
      }))
    );

    // Broadcast critical alerts immediately
    const io = req.app.get('io');
    if (io) {
      inserted.forEach(alert => {
        if (alert.level === 'CRITICAL' || alert.level === 'ERROR') {
          io.emit('system_alert', alert);
        }
      });
    }

    res.json({
      success: true,
      count: inserted.length,
    });

  } catch (error) {
    console.error('Alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save alerts',
    });
  }
});

module.exports = router;
