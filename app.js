// Main application file - Fixed Share Directory Logging
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { errorHandler } = require('./utils/ErrorHandler');
const logger = require('./utils/Logger');
const appConfig = require('./config/app');
const path = require('path');

// Create Express app
const app = express();

// CORS middleware for LIFF
app.use((req, res, next) => {
  // Allow requests from LIFF
  res.header('Access-Control-Allow-Origin', 'https://liff.line.me');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Middleware for raw body (needed for webhook signature verification)
app.use(bodyParser.json({ 
  verify: (req, res, buf, encoding) => {
    // Store raw body for webhook signature verification
    if (req.headers['x-line-signature']) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/liff', express.static(path.join(__dirname, 'public/liff')));
app.use('/temp', express.static(path.join(__dirname, 'public/temp'))); // For temporary share images
app.use('/share', express.static(path.join(__dirname, 'public/share'))); // For share pages

// LIFF root handler
app.get('/', (req, res) => {
  // Check if this is a LIFF request
  const params = new URLSearchParams(req.query);
  if (params.has('page') || params.has('lot')) {
    res.sendFile(path.join(__dirname, 'public/liff/index.html'));
  } else {
    res.send('RC QC Line System');
  }
});

// Web view route for PC browsers
app.get('/view', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/liff/view-web.html'));
});

// Share page route
app.get('/share/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/share/index.html'));
});

// Import controllers
const webhookController = require('./controllers/WebhookController');
const uploadController = require('./controllers/UploadController');
const lineService = require('./services/LineService');

// Import API routes
const apiRoutes = require('./routes/api');
const botShareRoutes = require('./routes/botShare');
const shareRoutes = require('./routes/share');
const shareApiRoutes = require('./routes/shareApi'); // NEW share API routes

// Setup routes
app.post('/webhook', webhookController.handleWebhook);

// API routes for LIFF
app.use('/api', apiRoutes);
app.use('/api', botShareRoutes);
app.use('/api', shareRoutes); // This will handle /api/share/* routes
app.use('/api', shareApiRoutes); // NEW enhanced share API routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'RC_QC_Line',
    version: '2.0.0'
  });
});

// Add system monitoring endpoint
app.get('/status', (req, res) => {
  const stats = webhookController.getSystemStatistics();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    statistics: stats
  });
});

// Error handling middleware
app.use(errorHandler);

// Enhanced cleanup timer for pending uploads and expired states (every 5 minutes)
setInterval(() => {
  try {
    // Clean up pending uploads
    const cleanedUploads = uploadController.cleanupPendingUploads();
    if (cleanedUploads > 0) {
      logger.info(`Cleaned up ${cleanedUploads} expired upload sessions`);
    }
    
    // Clean up expired user states
    const cleanedStates = lineService.cleanupExpiredStates();
    if (cleanedStates > 0) {
      logger.info(`Cleaned up ${cleanedStates} expired user states`);
    }
    
    // Log system statistics periodically (every hour)
    const currentMinute = new Date().getMinutes();
    if (currentMinute === 0) { // Top of the hour
      const stats = webhookController.getSystemStatistics();
      logger.info('System Statistics:', stats);
    }
    
  } catch (error) {
    logger.error('Error during cleanup:', error);
  }
}, 5 * 60 * 1000); // 5 minutes

// System monitoring (every 30 minutes)
setInterval(() => {
  try {
    logger.info('Running system monitoring...');
    
    // Get upload statistics for monitoring
    const uploadStats = uploadController.getUploadStatistics();
    if (uploadStats.totalPendingUploads > 0) {
      logger.info('Current upload statistics:', uploadStats);
    }
    
    // Get active states for monitoring
    const activeStates = lineService.getActiveStates();
    const stateCount = Object.keys(activeStates).length;
    if (stateCount > 0) {
      logger.info(`Active user states: ${stateCount}`);
    }
    
  } catch (error) {
    logger.error('Error during system monitoring:', error);
  }
}, 30 * 60 * 1000); // 30 minutes

// Cleanup share temp files (every hour)
setInterval(async () => {
  try {
    const response = await fetch(`http://localhost:${PORT}/api/share/cleanup`, {
      method: 'POST'
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success && result.message.includes('Cleaned')) {
        logger.info(`Share cleanup: ${result.message}`);
      }
    }
  } catch (error) {
    logger.error('Error during share temp cleanup:', error);
  }
}, 60 * 60 * 1000); // 1 hour

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Webhook URL: ${process.env.BASE_URL}/webhook`);
  logger.info(`Health endpoint: ${process.env.BASE_URL}/health`);
  logger.info(`Status endpoint: ${process.env.BASE_URL}/status`);
  logger.info(`LIFF viewer: ${process.env.BASE_URL}/liff/view.html`);
  logger.info(`LIFF share: ${process.env.BASE_URL}/liff/share.html`);
  logger.info(`Web viewer: ${process.env.BASE_URL}/view`);
  logger.info('Note: For production, use HTTPS for webhook URL');
  logger.info('Multi-chat support enabled');
  logger.info('LIFF photo viewer enabled');
  logger.info('PC browser support enabled');
  logger.info('Enhanced image sharing enabled');
  
  // Log all available endpoints
  logger.info('\nAvailable endpoints:');
  logger.info('- POST /webhook (LINE webhook)');
  logger.info('- GET /health (Health check)');
  logger.info('- GET /status (System status)');
  logger.info('- GET /view (Web viewer for PC)');
  logger.info('- GET /api/images/:lot/:date (Get images)');
  logger.info('- GET /api/lots/:lot (Get lot info)');
  logger.info('- POST /api/bot-share (Bot share images)');
  logger.info('- GET /api/bot-share/health (Bot share health)');
  logger.info('- POST /api/create-share (Create share session)');
  logger.info('- GET /api/share/:sessionId (View share page)');
  logger.info('- POST /api/share/deliver (Deliver images to user)');
  logger.info('- GET /api/share/:sessionId/download (Download as ZIP)');
  logger.info('- POST /api/share/prepare-image (Prepare image for sharing)');
  logger.info('- POST /api/share/send-to-chat (Send images to selected chat)');
  logger.info('- GET /api/share/chats/:userId (Get user chats)');
  logger.info('- POST /api/share/cleanup (Cleanup temp files)');
  logger.info('- Static /uploads/* (Image files)');
  logger.info('- Static /liff/* (LIFF files)');
  logger.info('- Static /temp/* (Temporary share files)');
  logger.info('- Static /share/* (Share pages)');
  
  // Log share temp directory properly
  const shareTempDir = path.join(__dirname, 'public', 'temp', 'share');
  logger.info(`Share temp directory: ${shareTempDir}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Clean up resources
  try {
    const cleanedUploads = uploadController.cleanupPendingUploads();
    const cleanedStates = lineService.cleanupExpiredStates();
    logger.info(`Final cleanup: ${cleanedUploads} uploads, ${cleanedStates} states`);
    
    // Clean up share sessions if available
    const imageShareService = require('./services/ImageShareService');
    if (imageShareService && imageShareService.cleanExpiredSessions) {
      imageShareService.cleanExpiredSessions();
      logger.info('Cleaned up share sessions');
    }
  } catch (error) {
    logger.error('Error during shutdown cleanup:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Clean up resources
  try {
    const cleanedUploads = uploadController.cleanupPendingUploads();
    const cleanedStates = lineService.cleanupExpiredStates();
    logger.info(`Final cleanup: ${cleanedUploads} uploads, ${cleanedStates} states`);
    
    // Clean up share sessions if available
    const imageShareService = require('./services/ImageShareService');
    if (imageShareService && imageShareService.cleanExpiredSessions) {
      imageShareService.cleanExpiredSessions();
      logger.info('Cleaned up share sessions');
    }
  } catch (error) {
    logger.error('Error during shutdown cleanup:', error);
  }
  
  process.exit(0);
});

module.exports = app;