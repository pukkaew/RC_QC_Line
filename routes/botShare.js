// API route for Bot to share images - Fixed Version
const express = require('express');
const router = express.Router();
const lineService = require('../services/LineService');
const imageService = require('../services/ImageService');
const logger = require('../utils/Logger');

// Health check endpoint - MUST BE FIRST
router.get('/bot-share/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Bot share API is running'
  });
});

// Test endpoint
router.get('/bot-share/test', (req, res) => {
  res.json({
    status: 'Bot share API is working',
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /api/bot-share/health',
      'GET /api/bot-share/test',
      'POST /api/bot-share'
    ]
  });
});

// Main endpoint for LIFF to request bot to send images
router.post('/bot-share', async (req, res) => {
  try {
    const { userId, lotNumber, imageDate, imageIds, accessToken } = req.body;
    
    logger.info(`Bot share request received:`, {
      userId,
      lotNumber,
      imageDate,
      imageIds: imageIds?.length || 0
    });
    
    // Validate request
    if (!userId || !lotNumber || !imageDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters',
        required: ['userId', 'lotNumber', 'imageDate']
      });
    }
    
    // Get images
    const result = await imageService.getImagesByLotAndDate(lotNumber, imageDate);
    
    if (!result.images || result.images.length === 0) {
      logger.warn(`No images found for Lot: ${lotNumber}, Date: ${imageDate}`);
      return res.status(404).json({
        success: false,
        message: 'No images found for the specified lot and date'
      });
    }
    
    // Filter selected images if imageIds provided
    let imagesToSend = result.images;
    if (imageIds && imageIds.length > 0) {
      imagesToSend = result.images.filter(img => imageIds.includes(img.image_id));
      logger.info(`Filtered to ${imagesToSend.length} selected images`);
    }
    
    // Prepare messages
    const messages = [];
    
    // Header message
    messages.push({
      type: 'text',
      text: `📸 รูปภาพ QC ที่คุณเลือก\n📦 Lot: ${lotNumber}\n📅 ${new Date(imageDate).toLocaleDateString('th-TH')}\n🖼️ จำนวน ${imagesToSend.length} รูป\n\n💡 คุณสามารถ forward รูปเหล่านี้ไปยังห้องแชทอื่นได้`
    });
    
    // Add instruction message
    messages.push({
      type: 'text', 
      text: '⬇️ กดค้างที่รูปแล้วเลือก "Forward" เพื่อส่งต่อ'
    });
    
    // Send images in batches (max 5 per message due to LINE limitation)
    const baseUrl = process.env.BASE_URL || 'https://line.ruxchai.co.th';
    let sentCount = 0;
    
    for (let i = 0; i < imagesToSend.length; i += 5) {
      const batch = imagesToSend.slice(i, i + 5);
      const batchMessages = batch.map(image => ({
        type: 'image',
        originalContentUrl: image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`,
        previewImageUrl: image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`
      }));
      
      // Send batch to user
      try {
        await lineService.pushMessage(userId, batchMessages);
        sentCount += batch.length;
        logger.info(`Sent batch ${Math.floor(i/5) + 1}: ${batch.length} images`);
        
        // Small delay between batches
        if (i + 5 < imagesToSend.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (sendError) {
        logger.error(`Error sending batch ${i/5 + 1}:`, sendError);
        
        // If LINE API error, return error response
        if (sendError.statusCode === 400) {
          return res.status(400).json({
            success: false,
            message: 'Failed to send images via LINE API',
            error: sendError.message,
            sentCount: sentCount
          });
        }
      }
    }
    
    // Send completion message if more than 5 images
    if (imagesToSend.length > 5) {
      try {
        await lineService.pushMessage(userId, {
          type: 'text',
          text: `✅ ส่งรูปภาพทั้งหมด ${imagesToSend.length} รูป เรียบร้อยแล้ว\n\n📌 คุณสามารถ:\n• กดค้างที่รูป → Forward ไปห้องอื่น\n• กดที่รูปเพื่อดูขนาดเต็ม\n• บันทึกรูปลงเครื่อง`
        });
      } catch (e) {
        logger.warn('Could not send completion message:', e.message);
      }
    }
    
    // Log success
    logger.info(`Successfully sent ${sentCount} images to user ${userId}`);
    
    // Return success response to LIFF
    res.json({
      success: true,
      message: `ส่งรูปภาพ ${sentCount} รูป เรียบร้อยแล้ว`,
      count: sentCount,
      lotNumber: lotNumber,
      imageDate: imageDate
    });
    
  } catch (error) {
    logger.error('Error in bot share:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
    });
  }
});

// Debug endpoint to check if route is loaded
router.get('/bot-share/debug', (req, res) => {
  res.json({
    message: 'Bot share routes are loaded',
    routes: router.stack.map(r => ({
      path: r.route?.path,
      methods: r.route?.methods
    }))
  });
});

module.exports = router;