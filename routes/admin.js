const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ActivityLog, ForgotPasswordRequest, SystemAlert } = require('../models');
const { protect, adminOnly, headAdminOnly } = require('../middleware/auth');

// All admin routes require admin privileges
router.use(protect, adminOnly);

// ===================================================================
// USER MANAGEMENT
// ===================================================================

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Admin
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users.map(u => u.toSafeObject()),
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   GET /api/admin/users/online
// @desc    Get currently online users
// @access  Admin
router.get('/users/online', async (req, res) => {
  try {
    const onlineUsers = await User.find({ isOnline: true })
      .select('username email role isOnline lastLogin')
      .sort({ lastLogin: -1 });

    res.json({
      success: true,
      count: onlineUsers.length,
      data: onlineUsers,
    });

  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const userToDelete = await User.findById(req.params.id);

    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Prevent deleting head admin
    if (userToDelete.role === 'head_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete head admin',
      });
    }

    // Prevent non-head-admins from deleting admins
    if (userToDelete.role === 'admin' && req.user.role !== 'head_admin') {
      return res.status(403).json({
        success: false,
        error: 'Only head admin can delete other admins',
      });
    }

    await userToDelete.deleteOne();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'user_deleted',
      details: { deletedUser: userToDelete.username },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `User ${userToDelete.username} deleted successfully`,
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   PUT /api/admin/users/:id/ban
// @desc    Ban or unban user
// @access  Admin
router.put('/users/:id/ban', async (req, res) => {
  try {
    const { banned } = req.body; // true or false

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.role === 'head_admin' || user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot ban administrators',
      });
    }

    user.status = banned ? 'banned' : 'active';
    await user.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'user_banned',
      details: {
        targetUser: user.username,
        banned,
      },
      ipAddress: req.ip,
    });

    // Force disconnect if currently online
    if (banned && user.isOnline) {
      const io = req.app.get('io');
      if (io && user.socketId) {
        io.to(user.socketId).emit('force_disconnect', {
          reason: 'Your account has been banned',
        });
      }
    }

    res.json({
      success: true,
      message: `User ${banned ? 'banned' : 'unbanned'} successfully`,
      data: user.toSafeObject(),
    });

  } catch (error) {
    console.error('Error banning user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   PUT /api/admin/users/:id/restrict
// @desc    Restrict or unrestrict user (view-only mode)
// @access  Admin
router.put('/users/:id/restrict', async (req, res) => {
  try {
    const { restricted } = req.body; // true or false

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.role === 'head_admin' || user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot restrict administrators',
      });
    }

    user.status = restricted ? 'restricted' : 'active';
    await user.save();

    res.json({
      success: true,
      message: `User ${restricted ? 'restricted' : 'unrestricted'} successfully`,
      data: user.toSafeObject(),
    });

  } catch (error) {
    console.error('Error restricting user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// ROLE MANAGEMENT (Head Admin Only)
// ===================================================================

// @route   PUT /api/admin/users/:id/promote
// @desc    Promote user to admin
// @access  Head Admin only
router.put('/users/:id/promote', headAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'User is already an admin',
      });
    }

    if (user.role === 'head_admin') {
      return res.status(400).json({
        success: false,
        error: 'User is already head admin',
      });
    }

    user.role = 'admin';
    await user.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'user_promoted',
      details: { promotedUser: user.username, newRole: 'admin' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `${user.username} promoted to admin`,
      data: user.toSafeObject(),
    });

  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   PUT /api/admin/users/:id/demote
// @desc    Demote admin to regular user
// @access  Head Admin only
router.put('/users/:id/demote', headAdminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    if (user.role === 'head_admin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot demote head admin',
      });
    }

    if (user.role === 'user') {
      return res.status(400).json({
        success: false,
        error: 'User is already a regular user',
      });
    }

    user.role = 'user';
    await user.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'user_demoted',
      details: { demotedUser: user.username, newRole: 'user' },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `${user.username} demoted to regular user`,
      data: user.toSafeObject(),
    });

  } catch (error) {
    console.error('Error demoting user:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// ACTIVITY LOG
// ===================================================================

// @route   GET /api/admin/activity/24h
// @desc    Get 24-hour activity log
// @access  Admin
router.get('/activity/24h', async (req, res) => {
  try {
    const logs = await ActivityLog.getLast24Hours();

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });

  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// FORGOT PASSWORD REQUESTS
// ===================================================================

// @route   GET /api/admin/forgot-password/pending
// @desc    Get pending password reset requests
// @access  Admin
router.get('/forgot-password/pending', async (req, res) => {
  try {
    const requests = await ForgotPasswordRequest.find({ status: 'pending' })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: requests.length,
      data: requests,
    });

  } catch (error) {
    console.error('Error fetching password requests:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   POST /api/admin/forgot-password/:id/approve
// @desc    Approve password reset and set new password
// @access  Admin
router.post('/forgot-password/:id/approve', async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password required',
      });
    }

    const request = await ForgotPasswordRequest.findById(req.params.id).populate('user');

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Request already resolved',
      });
    }

    // Update user password
    const user = request.user;
    user.password = newPassword;
    await user.save();

    // Update request
    request.status = 'approved';
    request.approvedBy = req.user._id;
    request.resolvedAt = new Date();
    await request.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'forgot_password_approved',
      details: { forUser: user.username },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Password reset approved and new password set',
    });

  } catch (error) {
    console.error('Error approving password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   POST /api/admin/forgot-password/:id/reject
// @desc    Reject password reset request
// @access  Admin
router.post('/forgot-password/:id/reject', async (req, res) => {
  try {
    const request = await ForgotPasswordRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        error: 'Request not found',
      });
    }

    request.status = 'rejected';
    request.approvedBy = req.user._id;
    request.resolvedAt = new Date();
    await request.save();

    // Log activity
    await ActivityLog.create({
      user: req.user._id,
      username: req.user.username,
      action: 'forgot_password_rejected',
      details: { requestId: request._id },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Password reset request rejected',
    });

  } catch (error) {
    console.error('Error rejecting password reset:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// ===================================================================
// SYSTEM ALERTS
// ===================================================================

// @route   GET /api/admin/alerts
// @desc    Get system alerts
// @access  Admin
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await SystemAlert.find()
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      count: alerts.length,
      data: alerts,
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

// @route   PUT /api/admin/alerts/:id/acknowledge
// @desc    Acknowledge an alert
// @access  Admin
router.put('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const alert = await SystemAlert.findById(req.params.id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    alert.acknowledged = true;
    alert.acknowledgedBy = req.user._id;
    await alert.save();

    res.json({
      success: true,
      message: 'Alert acknowledged',
    });

  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({
      success: false,
      error: 'Server error',
    });
  }
});

module.exports = router;
