const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ActivityLog } = require('../models');
const { protect, allowWrite } = require('../middleware/auth');

// All settings routes require authentication
router.use(protect);

// ===================================================================
// @route   PUT /api/settings/username
// @desc    Change username
// @access  Private (write permission)
// ===================================================================
router.put('/username', allowWrite, async (req, res) => {
  try {
    const { newUsername } = req.body;

    if (!newUsername) {
      return res.status(400).json({
        success: false,
        error: 'New username required',
      });
    }

    // Check if username is already taken
    const existing = await User.findOne({
      username: newUsername,
      _id: { $ne: req.user._id }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Username already taken',
      });
    }

    const oldUsername = req.user.username;
    req.user.username = newUsername;
    await req.user.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: newUsername,
      action: 'password_changed', // Reusing this action type
      details: { oldUsername, newUsername },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Username updated successfully',
      data: req.user.toSafeObject(),
    });

  } catch (error) {
    console.error('Error updating username:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   PUT /api/settings/theme
// @desc    Change UI theme
// @access  Private
// ===================================================================
router.put('/theme', async (req, res) => {
  try {
    const { theme } = req.body;

    if (!['light', 'dark', 'auto'].includes(theme)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid theme. Choose: light, dark, or auto',
      });
    }

    req.user.theme = theme;
    await req.user.save();

    res.json({
      success: true,
      message: 'Theme updated successfully',
      data: { theme },
    });

  } catch (error) {
    console.error('Error updating theme:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   GET /api/settings
// @desc    Get current user settings
// @access  Private
// ===================================================================
router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      username: req.user.username,
      email: req.user.email,
      theme: req.user.theme,
      role: req.user.role,
      status: req.user.status,
    },
  });
});

module.exports = router;
