const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ForgotPasswordRequest, ActivityLog } = require('../models');
const { protect, allowWrite } = require('../middleware/auth');

// ===================================================================
// @route   POST /api/auth/register
// @desc    Register new user (first user becomes head_admin)
// @access  Public
// ===================================================================
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username, email, and password',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email or username already exists',
      });
    }

    // Check if this is the first user
    const userCount = await User.countDocuments();
    const role = userCount === 0 ? 'head_admin' : 'user';

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role,
    });

    // Log activity
    await ActivityLog.create({
      user: user._id,
      username: user.username,
      action: 'user_created',
      details: { role },
      ipAddress: req.ip,
    });

    // Send token
    sendTokenResponse(user, 201, res, `Account created successfully. ${role === 'head_admin' ? 'You are the Head Admin!' : 'Welcome!'}`);

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration',
    });
  }
});

// ===================================================================
// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
// ===================================================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide username and password',
      });
    }

    // Find user (include password field)
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Check if user is banned
    if (user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been banned. Contact an administrator.',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    user.isOnline = true;
    await user.save({ validateBeforeSave: false });

    // Log activity
    await ActivityLog.create({
      user: user._id,
      username: user.username,
      action: 'login',
      ipAddress: req.ip,
    });

    // Send token
    sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login',
    });
  }
});

// ===================================================================
// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
// ===================================================================
router.post('/logout', protect, async (req, res) => {
  try {
    req.user.isOnline = false;
    req.user.socketId = null;
    await req.user.save({ validateBeforeSave: false });

    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'logout',
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout',
    });
  }
});

// ===================================================================
// @route   GET /api/auth/me
// @desc    Get current logged-in user
// @access  Private
// ===================================================================
router.get('/me', protect, (req, res) => {
  res.json({
    success: true,
    data: req.user.toSafeObject(),
  });
});

// ===================================================================
// @route   POST /api/auth/forgot-password
// @desc    Submit forgot password request
// @access  Public
// ===================================================================
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, message, rememberedPassword } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username or email required',
      });
    }

    // Find user
    const user = await User.findOne({
      $or: [{ username }, { email: username }]
    });

    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If your account exists, your request has been submitted to administrators.',
      });
    }

    // Check if there's already a pending request
    const existingRequest = await ForgotPasswordRequest.findOne({
      user: user._id,
      status: 'pending',
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        error: 'You already have a pending password reset request',
      });
    }

    // Create request
    await ForgotPasswordRequest.create({
      user: user._id,
      username: user.username,
      email: user.email,
      message: message || 'No message provided',
      rememberedPassword: rememberedPassword || null, // Store as-is, admin will test it
    });

    res.json({
      success: true,
      message: 'Password reset request submitted. An administrator will review it shortly.',
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// @route   PUT /api/auth/change-password
// @desc    Change own password
// @access  Private
// ===================================================================
router.put('/change-password', protect, allowWrite, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password required',
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log activity
    await ActivityLog.create({
      user: user._id,
      username: user.username,
      action: 'password_changed',
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// HELPER: Send JWT response
// ===================================================================
function sendTokenResponse(user, statusCode, res, message) {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    message,
    token,
    user: user.toSafeObject(),
  });
}

module.exports = router;
