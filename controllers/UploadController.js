// Path: RC_QC_Line/controllers/UploadController.js
// Controller for handling image uploads with PERFECT order tracking and group chat support
const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const lineConfig = require('../config/line');
const lineService = require('../services/LineService');
const imageService = require('../services/ImageService');
const dateFormatter = require('../utils/DateFormatter');
const lineMessageBuilder = require('../views/LineMessageBuilder');
const logger = require('../utils/Logger');
const { asyncHandler, AppError } = require('../utils/ErrorHandler');

class UploadController {
  constructor() {
    this.pendingUploads = new Map(); // Store pending uploads by user ID
    this.uploadTimers = new Map(); // Store timers for processing uploads
    this.imageCounter = new Map(); // Global counter for each user session
  }

  // Process all pending images after a delay (supports unlimited images)
  scheduleImageProcessing(userId, lotNumber, chatContext = null, delayMs = 5000) {
    // Clear existing timer if any
    if (this.uploadTimers.has(userId)) {
      clearTimeout(this.uploadTimers.get(userId));
    }

    // Set new timer with longer delay for large image sets
    const pendingUpload = this.pendingUploads.get(userId);
    let actualDelay = delayMs;
    
    // Increase delay for large image sets
    if (pendingUpload && pendingUpload.images.length > 10) {
      actualDelay = Math.min(10000, delayMs + (pendingUpload.images.length * 200)); // Max 10 seconds
    }

    const timer = setTimeout(async () => {
      await this.processPendingImages(userId, lotNumber, chatContext);
      this.uploadTimers.delete(userId);
    }, actualDelay);

    this.uploadTimers.set(userId, timer);
    
    // Log the schedule for debugging
    logger.info(`Scheduled image processing for user ${userId} in ${actualDelay}ms (${pendingUpload ? pendingUpload.images.length : 0} images)`);
  }

  // Handle image upload from LINE with specified Lot
  async handleImageUploadWithLot(userId, message, replyToken, lotNumber, chatContext) {
    try {
      const { id: messageId } = message;
      
      // Get image content from LINE
      const lineClient = new line.Client({
        channelAccessToken: lineConfig.channelAccessToken
      });
      
      // Get image content as a buffer
      const imageStream = await lineClient.getMessageContent(messageId);
      const chunks = [];
      
      imageStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // When image is fully received
      await new Promise((resolve, reject) => {
        imageStream.on('end', resolve);
        imageStream.on('error', reject);
      });

      const imageBuffer = Buffer.concat(chunks);
      
      // Get or create pending upload for the Lot
      let pendingUpload = this.pendingUploads.get(userId);
      
      if (!pendingUpload) {
        const sessionId = Date.now();
        pendingUpload = { 
          images: [], 
          lotNumber: lotNumber,
          lastUpdateTime: Date.now(),
          uploadSessionId: sessionId,
          chatContext: chatContext  // Store chat context
        };
        // Initialize counter for this session
        this.imageCounter.set(`${userId}_${sessionId}`, 0);
      }
      
      // Get and increment counter for guaranteed unique order
      const sessionKey = `${userId}_${pendingUpload.uploadSessionId}`;
      const currentCount = this.imageCounter.get(sessionKey) || 0;
      const imageOrder = currentCount + 1;
      this.imageCounter.set(sessionKey, imageOrder);
      
      // Add the image to the pending uploads with guaranteed unique order
      pendingUpload.images.push({
        buffer: imageBuffer,
        messageId: messageId,
        contentType: 'image/jpeg',
        receivedAt: Date.now(),
        imageOrder: imageOrder, // Guaranteed unique order
        sessionId: pendingUpload.uploadSessionId
      });
      
      pendingUpload.lastUpdateTime = Date.now();
      this.pendingUploads.set(userId, pendingUpload);
      
      logger.info(`Received image #${imageOrder} for user ${userId}, session ${pendingUpload.uploadSessionId}`);
      
      // Schedule processing with appropriate delay for image count
      this.scheduleImageProcessing(userId, lotNumber, chatContext);
      
    } catch (error) {
      logger.error('Error handling image upload with Lot:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.pushMessage(userId, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Process all pending images for a user (supports unlimited images)
  async processPendingImages(userId, lotNumber, chatContext = null) {
    try {
      const pendingUpload = this.pendingUploads.get(userId);
      if (!pendingUpload || pendingUpload.images.length === 0) {
        logger.warn(`No pending images found for user ${userId}`);
        return;
      }
      
      const imageCount = pendingUpload.images.length;
      const sessionId = pendingUpload.uploadSessionId;
      
      // Send processing notification for large uploads
      if (imageCount > 10) {
        const processingMessage = lineService.createTextMessage(
          `🔄 กำลังประมวลผล ${imageCount} รูปภาพ สำหรับ Lot: ${lotNumber} กรุณารอสักครู่...`
        );
        
        if (chatContext?.isGroupChat) {
          await lineService.pushMessageToChat(chatContext.chatId, processingMessage, chatContext.chatType);
        } else {
          await lineService.pushMessage(userId, processingMessage);
        }
      }
      
      // Sort images by imageOrder (guaranteed correct order)
      pendingUpload.images.sort((a, b) => a.imageOrder - b.imageOrder);
      
      // Log the order for debugging
      logger.info(`Processing ${imageCount} images for Lot ${lotNumber} (User: ${userId}, Session: ${sessionId})`);
      logger.info(`Image order: ${pendingUpload.images.map(img => img.imageOrder).join(', ')}`);
      
      // Use current date
      const currentDate = new Date();
      const formattedDate = dateFormatter.formatISODate(currentDate);
      
      // Create files array with order preserved in filename
      const files = pendingUpload.images.map((image) => {
        // Use the guaranteed unique imageOrder
        const orderPadded = String(image.imageOrder).padStart(4, '0');
        const timestamp = Date.now();
        const uuid = require('uuid').v4().slice(0, 8);
        return {
          buffer: image.buffer,
          originalname: `${timestamp}_${sessionId}_${orderPadded}_${uuid}.jpg`, // Match SQL expected pattern
          mimetype: image.contentType
        };
      });
      
      // Process and save images with progress updates for large uploads
      let result;
      try {
        if (imageCount > 20) {
          // Send progress update for very large uploads
          const progressMessage = lineService.createTextMessage(
            `⏳ กำลังบีบอัดและบันทึกรูปภาพ ${imageCount} รูป...`
          );
          
          if (chatContext?.isGroupChat) {
            await lineService.pushMessageToChat(chatContext.chatId, progressMessage, chatContext.chatType);
          } else {
            await lineService.pushMessage(userId, progressMessage);
          }
        }
        
        result = await imageService.processImages(files, lotNumber, formattedDate, userId);
        
      } catch (imageProcessError) {
        logger.error('Error during image processing:', imageProcessError);
        const errorMessage = lineService.createTextMessage(
          `❌ เกิดข้อผิดพลาดในการประมวลผลรูปภาพ: ${imageProcessError.message}\nกรุณาลองใหม่อีกครั้ง`
        );
        
        if (chatContext?.isGroupChat) {
          await lineService.pushMessageToChat(chatContext.chatId, errorMessage, chatContext.chatType);
        } else {
          await lineService.pushMessage(userId, errorMessage);
        }
        
        // Clear upload state on error
        const chatId = chatContext?.chatId || 'direct';
        lineService.setUploadInfo(userId, null, chatId);
        lineService.clearUserState(userId, chatId);
        
        return;
      }
      
      // Reset upload info and clear user state
      const chatId = chatContext?.chatId || 'direct';
      lineService.setUploadInfo(userId, null, chatId);
      lineService.clearUserState(userId, chatId);
      
      // Clear pending uploads and counter for this user
      this.pendingUploads.delete(userId);
      this.imageCounter.delete(`${userId}_${sessionId}`);
      
      // Build success message
      const successMessage = lineMessageBuilder.buildUploadSuccessMessage(result);
      
      // Send success message with additional info for large uploads
      if (result.successfulFiles !== result.totalFiles) {
        const errorMessage = `\n\n⚠️ ประมวลผลสำเร็จ ${result.successfulFiles}/${result.totalFiles} รูป`;
        successMessage.text += errorMessage;
      }
      
      if (imageCount > 10) {
        successMessage.text += `\n\n✅ ประมวลผลรูปภาพจำนวนมากเสร็จสิ้น!`;
      }
      
      // Send success message
      if (chatContext?.isGroupChat) {
        await lineService.pushMessageToChat(chatContext.chatId, successMessage, chatContext.chatType);
      } else {
        await lineService.pushMessage(userId, successMessage);
      }
      
      // Log upload completion
      logger.info(`Upload completed for user ${userId} in ${chatContext?.isGroupChat ? 'group' : 'direct'} chat (${chatId})`);
      
      // Return result
      return result;
    } catch (error) {
      logger.error('Error processing pending images:', error);
      
      // Send error message
      const errorMessage = lineService.createTextMessage(`❌ เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ: ${error.message}\nโปรดลองใหม่อีกครั้ง`);
      
      if (chatContext?.isGroupChat) {
        await lineService.pushMessageToChat(chatContext.chatId, errorMessage, chatContext.chatType);
      } else {
        await lineService.pushMessage(userId, errorMessage);
      }
      
      // Clear upload state on error
      const chatId = chatContext?.chatId || 'direct';
      lineService.setUploadInfo(userId, null, chatId);
      lineService.clearUserState(userId, chatId);
      
      // Clear pending uploads
      this.pendingUploads.delete(userId);
      
      throw error;
    }
  }

  // Handle regular image upload from LINE
  async handleImageUpload(userId, message, replyToken, chatContext) {
    try {
      const { id: messageId } = message;
      
      // Get image content from LINE
      const lineClient = new line.Client({
        channelAccessToken: lineConfig.channelAccessToken
      });
      
      // Get image content as a buffer
      const imageStream = await lineClient.getMessageContent(messageId);
      const chunks = [];
      
      imageStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      // When image is fully received
      await new Promise((resolve, reject) => {
        imageStream.on('end', resolve);
        imageStream.on('error', reject);
      });

      const imageBuffer = Buffer.concat(chunks);
      
      // Store pending upload in memory with chat context
      let pendingUpload = this.pendingUploads.get(userId);
      
      if (!pendingUpload) {
        const sessionId = Date.now();
        pendingUpload = {
          images: [],
          lastUpdateTime: Date.now(),
          uploadSessionId: sessionId,
          chatContext: chatContext  // Store chat context
        };
        // Initialize counter for this session
        this.imageCounter.set(`${userId}_${sessionId}`, 0);
      }
      
      // Get and increment counter for guaranteed unique order
      const sessionKey = `${userId}_${pendingUpload.uploadSessionId}`;
      const currentCount = this.imageCounter.get(sessionKey) || 0;
      const imageOrder = currentCount + 1;
      this.imageCounter.set(sessionKey, imageOrder);
      
      pendingUpload.images.push({
        buffer: imageBuffer,
        messageId: messageId,
        contentType: 'image/jpeg',
        receivedAt: Date.now(),
        imageOrder: imageOrder,
        sessionId: pendingUpload.uploadSessionId
      });
      
      pendingUpload.lastUpdateTime = Date.now();
      this.pendingUploads.set(userId, pendingUpload);
      
      logger.info(`Received image #${imageOrder} for user ${userId}`);
      
      // Ask for Lot number if this is the first image
      if (pendingUpload.images.length === 1) {
        // Wait a moment to see if more images are coming
        setTimeout(async () => {
          const currentUpload = this.pendingUploads.get(userId);
          if (currentUpload && !currentUpload.lotRequested) {
            await this.requestLotNumber(userId, null, currentUpload.images.length, chatContext);
          }
        }, 2000); // 2 seconds delay
      }
      
    } catch (error) {
      logger.error('Error handling image upload:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Request Lot number for uploaded images
  async requestLotNumber(userId, replyToken, imageCount = 1, chatContext) {
    try {
      const pendingUpload = this.pendingUploads.get(userId);
      
      if (!pendingUpload || pendingUpload.images.length === 0) {
        const message = 'ไม่มีรูปภาพรอการอัปโหลด กรุณาส่งรูปภาพก่อน';
        if (replyToken) {
          await lineService.replyMessage(replyToken, lineService.createTextMessage(message));
        } else {
          await lineService.pushMessage(userId, lineService.createTextMessage(message));
        }
        return;
      }
      
      // Set user state to waiting for Lot
      const chatId = chatContext?.chatId || 'direct';
      lineService.setUserState(userId, lineConfig.userStates.waitingForLot, {
        action: lineConfig.userActions.upload
      }, chatId);
      
      // Mark that we've requested a Lot number
      pendingUpload.lotRequested = true;
      this.pendingUploads.set(userId, pendingUpload);
      
      // Ask for Lot number with image count info
      const requestMessage = lineService.createTextMessage(
        `ได้รับรูปภาพทั้งหมด ${pendingUpload.images.length} รูป กรุณาระบุเลข Lot สำหรับรูปภาพที่อัปโหลด`
      );
      
      if (replyToken) {
        await lineService.replyMessage(replyToken, requestMessage);
      } else {
        await lineService.pushMessage(userId, requestMessage);
      }
    } catch (error) {
      logger.error('Error requesting Lot number:', error);
      throw error;
    }
  }

  // Setup upload with Lot already specified
  async setupUploadWithLot(userId, lotNumber, replyToken, chatContext) {
    try {
      // Validate lot number
      if (!lotNumber || lotNumber.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาระบุเลข Lot อีกครั้ง')
        );
        return;
      }
      
      // Set upload info with specified Lot
      const chatId = chatContext?.chatId || 'direct';
      lineService.setUploadInfo(userId, {
        isActive: true,
        lotNumber: lotNumber.trim(),
        startTime: Date.now()
      }, chatId);
      
      // Clear any pending uploads for this user
      this.pendingUploads.delete(userId);
      // Clear any existing counters
      for (const [key] of this.imageCounter.entries()) {
        if (key.startsWith(`${userId}_`)) {
          this.imageCounter.delete(key);
        }
      }
      
      // Confirm Lot number and ask for images
      await lineService.replyMessage(
        replyToken,
        lineService.createTextMessage(`ได้รับเลข Lot: ${lotNumber.trim()} กรุณาส่งรูปภาพที่ต้องการอัปโหลด`)
      );
    } catch (error) {
      logger.error('Error setting up upload with Lot:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการตั้งค่าการอัปโหลด โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Process Lot number and complete upload (using today's date)
  async processLotNumber(userId, lotNumber, replyToken, chatContext) {
    try {
      const pendingUpload = this.pendingUploads.get(userId);
      
      if (!pendingUpload || pendingUpload.images.length === 0) {
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage('ไม่มีรูปภาพรอการอัปโหลด กรุณาส่งรูปภาพก่อน')
        );
        return;
      }
      
      // Validate lot number
      if (!lotNumber || lotNumber.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาระบุเลข Lot อีกครั้ง')
        );
        return;
      }
      
      // Cancel any pending processing timer
      if (this.uploadTimers.has(userId)) {
        clearTimeout(this.uploadTimers.get(userId));
        this.uploadTimers.delete(userId);
      }
      
      // Sort images by imageOrder (guaranteed correct order)
      pendingUpload.images.sort((a, b) => a.imageOrder - b.imageOrder);
      
      // Use current date automatically
      const currentDate = new Date();
      const formattedDate = dateFormatter.formatISODate(currentDate);
      const sessionId = pendingUpload.uploadSessionId;
      
      // Prepare files for processing with order in filename
      const files = pendingUpload.images.map((image) => {
        const orderPadded = String(image.imageOrder).padStart(4, '0');
        const timestamp = Date.now();
        const uuid = require('uuid').v4().slice(0, 8);
        return {
          buffer: image.buffer,
          originalname: `${timestamp}_${sessionId}_${orderPadded}_${uuid}.jpg`, // Match SQL expected pattern
          mimetype: image.contentType
        };
      });
      
      // Process and save images
      const result = await imageService.processImages(files, lotNumber.trim(), formattedDate, userId);
      
      // Clear pending uploads and counter
      this.pendingUploads.delete(userId);
      this.imageCounter.delete(`${userId}_${sessionId}`);
      
      // Reset user state
      const chatId = chatContext?.chatId || 'direct';
      lineService.clearUserState(userId, chatId);
      
      // Build success message
      const successMessage = lineMessageBuilder.buildUploadSuccessMessage(result);
      
      // Send success message
      await lineService.replyMessage(replyToken, successMessage);
    } catch (error) {
      logger.error('Error processing Lot number for direct upload:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Process date selection and complete upload (backward compatibility)
  async processDateSelection(userId, lotNumber, date, replyToken, chatContext) {
    try {
      const pendingUpload = this.pendingUploads.get(userId);
      
      if (!pendingUpload || pendingUpload.images.length === 0) {
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage('ไม่มีรูปภาพรอการอัปโหลด กรุณาส่งรูปภาพก่อน')
        );
        return;
      }
      
      // Prepare files for processing
      const files = pendingUpload.images.map((image, index) => {
        return {
          buffer: image.buffer,
          originalname: `image_${Date.now()}_${index + 1}.jpg`,
          mimetype: image.contentType
        };
      });
      
      // Process and save images
      const result = await imageService.processImages(files, lotNumber, date, userId);
      
      // Clear pending uploads
      this.pendingUploads.delete(userId);
      
      // Reset user state
      const chatId = chatContext?.chatId || 'direct';
      lineService.clearUserState(userId, chatId);
      
      // Build success message
      const successMessage = lineMessageBuilder.buildUploadSuccessMessage(result);
      
      // Send success message
      await lineService.replyMessage(replyToken, successMessage);
    } catch (error) {
      logger.error('Error processing date selection for upload:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }
  
  // Clean up old pending uploads (can be called periodically)
  cleanupPendingUploads() {
    try {
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30 minutes
      let cleanedCount = 0;
      
      for (const [userId, upload] of this.pendingUploads.entries()) {
        if (now - upload.lastUpdateTime > timeout) {
          logger.info(`Cleaning up stale upload for user ${userId}`);
          this.pendingUploads.delete(userId);
          cleanedCount++;
          
          // Clear timer if exists
          if (this.uploadTimers.has(userId)) {
            clearTimeout(this.uploadTimers.get(userId));
            this.uploadTimers.delete(userId);
          }
          
          // Clear counter
          const sessionKey = `${userId}_${upload.uploadSessionId}`;
          if (this.imageCounter.has(sessionKey)) {
            this.imageCounter.delete(sessionKey);
          }
        }
      }
      
      return cleanedCount;
    } catch (error) {
      logger.error('Error cleaning up pending uploads:', error);
      return 0;
    }
  }

  // Get upload statistics for monitoring
  getUploadStatistics() {
    try {
      const stats = {
        totalPendingUploads: this.pendingUploads.size,
        activeTimers: this.uploadTimers.size,
        activeCounters: this.imageCounter.size,
        pendingByUser: {}
      };
      
      // Get details for each pending upload
      for (const [userId, upload] of this.pendingUploads.entries()) {
        const sessionKey = `${userId}_${upload.uploadSessionId}`;
        stats.pendingByUser[userId] = {
          imageCount: upload.images.length,
          lastUpdateTime: new Date(upload.lastUpdateTime).toISOString(),
          lotNumber: upload.lotNumber || 'not set',
          lotRequested: upload.lotRequested || false,
          sessionId: upload.uploadSessionId,
          currentOrder: this.imageCounter.get(sessionKey) || 0
        };
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting upload statistics:', error);
      return {
        totalPendingUploads: 0,
        activeTimers: 0,
        activeCounters: 0,
        pendingByUser: {},
        error: error.message
      };
    }
  }
}

module.exports = new UploadController();