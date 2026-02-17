const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ===================================================================
// PROTECT ROUTES — JWT authentication
// ===================================================================
exports.protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies (if using cookie-based auth)
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'User no longer exists',
      });
    }

    // Check if user is banned
    if (req.user.status === 'banned') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been banned',
      });
    }

    // Check if user is restricted (can only view, no actions)
    req.isRestricted = req.user.status === 'restricted';

    next();
  } catch (error) {
    console.error('JWT verification failed:', error);
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route',
    });
  }
};

// ===================================================================
// ADMIN-ONLY ROUTES
// ===================================================================
exports.adminOnly = (req, res, next) => {
  if (!req.user || !req.user.isAdmin()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.',
    });
  }
  next();
};

// ===================================================================
// HEAD ADMIN-ONLY ROUTES
// ===================================================================
exports.headAdminOnly = (req, res, next) => {
  if (!req.user || !req.user.isHeadAdmin()) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Head Admin privileges required.',
    });
  }
  next();
};

// ===================================================================
// PREVENT RESTRICTED USERS FROM WRITE ACTIONS
// ===================================================================
exports.allowWrite = (req, res, next) => {
  if (req.isRestricted) {
    return res.status(403).json({
      success: false,
      error: 'Your account is restricted. You can only view data.',
    });
  }
  next();
};

// ===================================================================
// PI API KEY AUTHENTICATION (for Raspberry Pi endpoints)
// ===================================================================
exports.piAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
    });
  }

  if (apiKey !== process.env.PI_API_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  next();
};
