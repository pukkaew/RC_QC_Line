// Enhanced Share API routes for image sharing with temp download
// File: RC_QC_Line/routes/shareApi.js

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const lineService = require('../services/LineService');
const imageService = require('../services/ImageService');
const logger = require('../utils/Logger');

// Temp directory for share preparation
const TEMP_DIR = path.join(__dirname, '../public/temp/share');

// Ensure temp directory exists
async function ensureTempDirectory() {
  try {
    await fs.mkdir(TEMP_DIR, { recursive: true });
    logger.info('Share temp directory ensured:', TEMP_DIR);
  } catch (error) {
    logger.error('Error creating share temp directory:', error);
  }
}

// Initialize temp directory
ensureTempDirectory();

// Prepare single image for sharing
router.post('/share/prepare-image', async (req, res) => {
  try {
    const { imageId, lotNumber, imageDate, index } = req.body;
    
    logger.info(`Preparing image for share - ID: ${imageId}, Lot: ${lotNumber}, Index: ${index}`);
    
    // Get image info from database
    const imageModel = require('../models/ImageModel');
    const images = await imageModel.getById(imageId);
    
    if (!images || images.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }
    
    const image = images[0];
    
    // Create unique temp filename
    const timestamp = Date.now();
    const tempFilename = `share_${lotNumber}_${timestamp}_${index}.jpg`;
    const tempPath = path.join(TEMP_DIR, tempFilename);
    
    // Source file path
    const sourcePath = path.join(__dirname, '..', image.file_path);
    
    // Copy file to temp directory
    await fs.copyFile(sourcePath, tempPath);
    
    logger.info(`Image copied to temp: ${tempFilename}`);
    
    // Return paths
    res.json({
      success: true,
      imageId: imageId,
      tempPath: tempPath,
      tempUrl: `/temp/share/${tempFilename}`,
      fullPath: path.resolve(tempPath),
      filename: tempFilename,
      originalPath: sourcePath
    });
    
  } catch (error) {
    logger.error('Error preparing image:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare image',
      error: error.message
    });
  }
});

// Send images to selected chat (No-Auth Version like delete)
router.post('/share/send-to-chat', async (req, res) => {
  try {
    const { userId, chatId, chatType, chatName, images, lotNumber, imageDate } = req.body;
    
    logger.info(`Share request - User: ${userId}, Chat: ${chatName} (${chatType}), Images: ${images.length}`);
    
    // Validate inputs
    if (!images || images.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images to share'
      });
    }
    
    // No-Auth version: Just prepare download links instead of sending via LINE API
    const baseUrl = process.env.BASE_URL || 'https://line.ruxchai.co.th';
    const downloadLinks = [];
    
    // Generate download links for all images
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const imageUrl = image.tempUrl ? `${baseUrl}${image.tempUrl}` : `${baseUrl}${image.url}`;
      
      downloadLinks.push({
        index: i + 1,
        filename: image.filename,
        url: imageUrl,
        fullPath: image.fullPath
      });
    }
    
    // Create a shareable message with download instructions
    const shareMessage = `📸 รูปภาพ QC พร้อมแชร์\n📦 Lot: ${lotNumber}\n📅 ${new Date(imageDate).toLocaleDateString('th-TH')}\n🖼️ จำนวน ${images.length} รูป\n\n💡 วิธีแชร์:\n1. กดค้างที่ลิงก์ด้านล่าง\n2. เลือก "คัดลอก"\n3. วางในห้องแชทที่ต้องการ\n\n🔗 ลิงก์ดาวน์โหลด:`;
    
    // Generate shortened share link or use direct links
    const shareLinks = downloadLinks.map((link, idx) => 
      `${idx + 1}. ${link.filename}\n${link.url}`
    ).join('\n\n');
    
    // Schedule cleanup of temp files after 30 minutes
    setTimeout(() => {
      cleanupTempFiles(images);
    }, 30 * 60 * 1000);
    
    // Return success with download info
    res.json({
      success: true,
      message: `เตรียมลิงก์แชร์ ${images.length} รูป เรียบร้อยแล้ว`,
      count: images.length,
      shareMessage: shareMessage,
      shareLinks: shareLinks,
      downloadLinks: downloadLinks,
      instruction: 'คัดลอกลิงก์ด้านบนไปแชร์ในห้องแชทที่ต้องการ',
      files: images.map(img => ({
        filename: img.filename,
        fullPath: img.fullPath,
        url: `${baseUrl}${img.tempUrl || img.url}`
      }))
    });
    
  } catch (error) {
    logger.error('Error preparing share links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to prepare share links',
      error: error.message
    });
  }
});

// Cleanup temp files
async function cleanupTempFiles(images) {
  for (const image of images) {
    if (image.tempPath) {
      try {
        await fs.unlink(image.tempPath);
        logger.info(`Cleaned up temp file: ${image.filename}`);
      } catch (error) {
        logger.warn(`Could not clean up temp file: ${image.filename}`, error);
      }
    }
  }
}

// Get available chats for user (mock endpoint for demo)
router.get('/share/chats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // In real implementation, this would fetch actual user's groups/rooms from LINE
    // For demo, return mock data
    const mockChats = [
      {
        id: 'personal',
        name: 'ส่งให้ตัวเอง',
        type: 'personal',
        icon: '👤'
      },
      {
        id: 'C1234567890abcdef',
        name: 'ทีม QC',
        type: 'group',
        icon: '👥'
      },
      {
        id: 'C0987654321fedcba',
        name: 'Production Team',
        type: 'group',
        icon: '👥'
      }
    ];
    
    res.json({
      success: true,
      chats: mockChats,
      count: mockChats.length
    });
    
  } catch (error) {
    logger.error('Error getting user chats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chats'
    });
  }
});

// Cleanup old temp files (can be called by scheduler)
router.post('/share/cleanup', async (req, res) => {
  try {
    const files = await fs.readdir(TEMP_DIR);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    let cleaned = 0;
    
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtimeMs > maxAge) {
        await fs.unlink(filePath);
        cleaned++;
        logger.info(`Cleaned old temp file: ${file}`);
      }
    }
    
    res.json({
      success: true,
      message: `Cleaned ${cleaned} old temp files`
    });
    
  } catch (error) {
    logger.error('Error cleaning temp files:', error);
    res.status(500).json({
      success: false,
      message: 'Cleanup failed'
    });
  }
});

module.exports = router;