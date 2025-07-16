// Controller for handling Lot correction - Updated for Multi-Chat Support (Final Fix)
const lineConfig = require('../config/line');
const lineService = require('../services/LineService');
const logger = require('../utils/Logger');
const { asyncHandler, AppError } = require('../utils/ErrorHandler');
const sql = require('mssql');

class CorrectController {
  // Request old Lot number for correction
  async requestOldLot(userId, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Set user state to waiting for old Lot with chat context
      lineService.setUserState(userId, lineConfig.userStates.waitingForLot, {
        action: 'correct'
      }, chatId);
      
      // Ask for old Lot number
      const message = {
        type: 'text',
        text: 'กรุณาระบุเลข Lot เดิมที่ต้องการแก้ไข'
      };
      
      await lineService.replyMessage(replyToken, message);
    } catch (error) {
      logger.error('Error requesting old Lot number:', error);
      throw error;
    }
  }

  // Process old Lot number
  async processOldLot(userId, oldLot, replyToken, chatContext = null) {
    try {
      // Validate old Lot number
      if (!oldLot || oldLot.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาระบุเลข Lot เดิมอีกครั้ง')
        );
        return;
      }
      
      // Check if old Lot exists
      const hasImages = await this.checkLotHasImages(oldLot.trim());
      
      if (!hasImages) {
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage(`ไม่พบรูปภาพสำหรับ Lot: ${oldLot.trim()} ที่สามารถแก้ไขได้`)
        );
        return;
      }
      
      // Check if images are recent enough to edit (less than 24 hours)
      const hasRecentImages = await this.checkLotHasRecentImages(oldLot.trim());
      
      if (!hasRecentImages) {
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage(`ไม่สามารถแก้ไข Lot: ${oldLot.trim()} ได้ เนื่องจากรูปภาพถูกอัปโหลดเกิน 24 ชั่วโมงแล้ว`)
        );
        return;
      }
      
      // Request new Lot number
      await this.requestNewLot(userId, oldLot.trim(), replyToken, chatContext);
    } catch (error) {
      logger.error('Error processing old Lot number:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการตรวจสอบเลข Lot เดิม โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Request new Lot number
  async requestNewLot(userId, oldLot, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Set user state to waiting for new Lot with chat context
      lineService.setUserState(userId, lineConfig.userStates.waitingForNewLot, {
        oldLot: oldLot
      }, chatId);
      
      // Ask for new Lot number
      const message = {
        type: 'text',
        text: `กรุณาระบุเลข Lot ใหม่ที่ต้องการแก้ไขจาก ${oldLot}`
      };
      
      await lineService.replyMessage(replyToken, message);
    } catch (error) {
      logger.error('Error requesting new Lot number:', error);
      throw error;
    }
  }

  // Process new Lot number
  async processNewLot(userId, oldLot, newLot, replyToken, chatContext = null) {
    try {
      // Validate new Lot number
      if (!newLot || newLot.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ใหม่ไม่ถูกต้อง กรุณาระบุเลข Lot ใหม่อีกครั้ง')
        );
        return;
      }
      
      // Correct the Lot
      await this.correctLot(userId, oldLot, newLot.trim(), replyToken, chatContext);
    } catch (error) {
      logger.error('Error processing new Lot number:', error);
      throw error;
    }
  }

  // Correct Lot number
  async correctLot(userId, oldLot, newLot, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Validate inputs
      if (!oldLot || !newLot || oldLot.trim() === '' || newLot.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง')
        );
        return;
      }
      
      // Trim the input
      const oldLotTrimmed = oldLot.trim();
      const newLotTrimmed = newLot.trim();
      
      // Update the Lot
      const result = await this.updateLotNumber(oldLotTrimmed, newLotTrimmed);
      
      if (result.success) {
        // Reset user state
        lineService.clearUserState(userId, chatId);
        
        // Send success message
        const successMessage = {
          type: 'text',
          text: `แก้ไขเลข Lot จาก ${oldLotTrimmed} เป็น ${newLotTrimmed} สำเร็จแล้ว\nจำนวนรูปภาพที่แก้ไข: ${result.count} รูป`
        };
        
        await lineService.replyMessage(replyToken, successMessage);
      } else {
        // Send error message
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage(`ไม่สามารถแก้ไขเลข Lot ได้: ${result.message}`)
        );
      }
    } catch (error) {
      logger.error('Error correcting Lot number:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการแก้ไขเลข Lot โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Check if a Lot has any images
  async checkLotHasImages(lotNumber) {
    try {
      // Connect to database
      await sql.connect(require('../config/database').config);
      
      // Check if lot exists with active images
      const result = await sql.query`
        SELECT COUNT(*) AS count
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE l.lot_number = ${lotNumber}
          AND i.status = 'active'
      `;
      
      await sql.close();
      
      return result.recordset[0].count > 0;
    } catch (error) {
      logger.error('Error checking if Lot has images:', error);
      if (sql.connected) await sql.close();
      throw error;
    }
  }

  // Check if a Lot has recent images (less than 24 hours old)
  async checkLotHasRecentImages(lotNumber) {
    try {
      // Connect to database
      await sql.connect(require('../config/database').config);
      
      // Check if lot has images uploaded in the last 24 hours
      const result = await sql.query`
        SELECT COUNT(*) AS count
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE l.lot_number = ${lotNumber}
          AND i.status = 'active'
          AND DATEDIFF(HOUR, i.uploaded_at, GETDATE()) < 24
      `;
      
      await sql.close();
      
      return result.recordset[0].count > 0;
    } catch (error) {
      logger.error('Error checking if Lot has recent images:', error);
      if (sql.connected) await sql.close();
      throw error;
    }
  }

  // Update Lot number - FIXED: Use OUTPUT clause for reliable row count
  async updateLotNumber(oldLot, newLot) {
    try {
      // Connect to database
      await sql.connect(require('../config/database').config);
      
      // Start transaction
      const transaction = new sql.Transaction();
      await transaction.begin();
      
      try {
        // Find the old Lot
        const oldLotResult = await new sql.Request(transaction).query`
          SELECT lot_id FROM Lots WHERE lot_number = ${oldLot}
        `;
        
        if (oldLotResult.recordset.length === 0) {
          await transaction.rollback();
          return { success: false, message: `ไม่พบ Lot ${oldLot}` };
        }
        
        const oldLotId = oldLotResult.recordset[0].lot_id;
        
        // Check for recent images
        const recentImagesResult = await new sql.Request(transaction).query`
          SELECT COUNT(*) AS count
          FROM Images
          WHERE lot_id = ${oldLotId}
            AND status = 'active'
            AND DATEDIFF(HOUR, uploaded_at, GETDATE()) < 24
        `;
        
        if (recentImagesResult.recordset[0].count === 0) {
          await transaction.rollback();
          return { success: false, message: `ไม่มีรูปภาพที่อัปโหลดภายใน 24 ชั่วโมงสำหรับ Lot ${oldLot}` };
        }
        
        // Find or create the new Lot
        let newLotId;
        const newLotResult = await new sql.Request(transaction).query`
          SELECT lot_id FROM Lots WHERE lot_number = ${newLot}
        `;
        
        if (newLotResult.recordset.length === 0) {
          // Create new Lot
          const insertLotResult = await new sql.Request(transaction).query`
            INSERT INTO Lots (lot_number, created_at, updated_at, status)
            VALUES (${newLot}, GETDATE(), GETDATE(), 'active');
            
            SELECT SCOPE_IDENTITY() AS lot_id;
          `;
          newLotId = insertLotResult.recordset[0].lot_id;
          logger.info(`Created new Lot: ${newLot} with ID: ${newLotId}`);
        } else {
          newLotId = newLotResult.recordset[0].lot_id;
          logger.info(`Using existing Lot: ${newLot} with ID: ${newLotId}`);
        }
        
        // Update images using OUTPUT clause for reliable row count
        const updateResult = await new sql.Request(transaction).query`
          UPDATE Images
          SET lot_id = ${newLotId}
          OUTPUT DELETED.image_id, INSERTED.image_id
          WHERE lot_id = ${oldLotId}
            AND status = 'active'
            AND DATEDIFF(HOUR, uploaded_at, GETDATE()) < 24
        `;
        
        const updatedCount = updateResult.recordset.length;
        
        // Log the update details
        logger.info(`Updated ${updatedCount} images from Lot ${oldLot} (ID: ${oldLotId}) to Lot ${newLot} (ID: ${newLotId})`);
        
        // Commit transaction
        await transaction.commit();
        
        return { success: true, count: updatedCount };
      } catch (error) {
        // Rollback transaction on error
        await transaction.rollback();
        logger.error('Transaction error:', error);
        return { success: false, message: error.message };
      }
    } catch (error) {
      logger.error('Error updating Lot number:', error);
      if (sql.connected) await sql.close();
      throw error;
    } finally {
      if (sql.connected) await sql.close();
    }
  }
}

module.exports = new CorrectController();