require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const connectDB = require('./config/database');
const User = require('./models/User');

// ===================================================================
// INITIALIZE APP
// ===================================================================
const app = express();
const server = http.createServer(app);

// ===================================================================
// CORS ORIGINS — parse and trim so spaces in env vars don't break it
// ===================================================================
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
  : [];

console.log('Allowed CORS origins:', allowedOrigins);

const originFn = (origin, callback) => {
  // Allow server-to-server, curl, Postman (no origin header)
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) return callback(null, true);
  console.warn(`CORS blocked: ${origin}`);
  callback(new Error(`CORS: origin ${origin} not allowed`));
};

// ===================================================================
// SOCKET.IO SETUP
// ===================================================================
const io = new Server(server, {
  cors: {
    origin: originFn,
    credentials: true,
  },
});

// Make io accessible to routes
app.set('io', io);

// ===================================================================
// MIDDLEWARE
// ===================================================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable for Socket.IO compatibility
}));

// CORS
app.use(cors({
  origin: originFn,
  credentials: true,
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Sanitize NoSQL queries
app.use(mongoSanitize());

// Compression
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 1000,
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ===================================================================
// ROUTES
// ===================================================================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/pi', require('./routes/pi'));
app.use('/api/sensors', require('./routes/sensors'));
app.use('/api/thresholds', require('./routes/thresholds'));
app.use('/api/manual', require('./routes/manual'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/settings', require('./routes/settings'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    service: 'greenhouse-backend',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Greenhouse API v1.0.0',
    docs: '/api/health',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Server error',
  });
});

// ===================================================================
// SOCKET.IO AUTHENTICATION & EVENTS
// ===================================================================
const jwt = require('jsonwebtoken');

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new Error('User not found'));
    }

    if (user.status === 'banned') {
      return next(new Error('Account banned'));
    }

    socket.userId = user._id.toString();
    socket.username = user.username;
    socket.role = user.role;

    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
});

io.on('connection', async (socket) => {
  console.log(`✓ User connected: ${socket.username} (${socket.userId})`);

  // Update user online status
  try {
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      socketId: socket.id,
    });
  } catch (error) {
    console.error('Error updating user online status:', error);
  }

  // Broadcast user online to admins
  io.emit('user_online', {
    userId: socket.userId,
    username: socket.username,
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`✗ User disconnected: ${socket.username}`);

    try {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        socketId: null,
      });
    } catch (error) {
      console.error('Error updating user offline status:', error);
    }

    // Broadcast user offline
    io.emit('user_offline', {
      userId: socket.userId,
      username: socket.username,
    });
  });

  socket.on('request_live_data', () => {
    socket.emit('live_data_requested');
  });
});

// ===================================================================
// DATABASE CONNECTION & SERVER START
// ===================================================================
const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║   Smart Greenhouse Backend — Production Server          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log(`  🌿 Server running on port ${PORT}`);
      console.log(`  📡 WebSocket ready for live updates`);
      console.log(`  🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('');
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

startServer();

module.exports = app;
