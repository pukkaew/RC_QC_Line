// Controller for handling image deletion - Updated for Multi-Chat Support (Fixed)
const lineConfig = require('../config/line');
const lineService = require('../services/LineService');
const deleteService = require('../services/DeleteService');
const datePickerService = require('../services/DatePickerService');
const logger = require('../utils/Logger');
const { asyncHandler, AppError } = require('../utils/ErrorHandler');

class DeleteController {
  // Request Lot number for deleting images
  async requestLotNumber(userId, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Set user state to waiting for Lot number with chat context
      lineService.setUserState(userId, lineConfig.userStates.waitingForLot, {
        action: 'delete'
      }, chatId);
      
      // Ask for Lot number
      const requestMessage = {
        type: 'text',
        text: 'กรุณาระบุเลข Lot ของรูปภาพที่ต้องการลบ'
      };
      
      await lineService.replyMessage(replyToken, requestMessage);
    } catch (error) {
      logger.error('Error requesting Lot number for deleting:', error);
      throw error;
    }
  }

  // Process Lot number and show date picker with available dates
  async processLotNumber(userId, lotNumber, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Validate lot number
      if (!lotNumber || lotNumber.trim() === '') {
        await lineService.replyMessage(
          replyToken, 
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาระบุเลข Lot อีกครั้ง')
        );
        return;
      }
      
      // Show date picker with only dates that have images and delete action (NO CONFIRMATION MESSAGE)
      // Pass replyToken to sendDeleteDatePicker so it can reply directly
      await datePickerService.sendDeleteDatePicker(userId, lotNumber.trim(), chatContext, replyToken);
      
    } catch (error) {
      logger.error('Error processing Lot number for deleting:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการประมวลผลเลข Lot โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Process date selection and show images for deletion
  async processDateSelection(userId, lotNumber, date, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Reset user state
      lineService.setUserState(userId, lineConfig.userStates.idle, {}, chatId);
      
      // Create image delete selector
      const deleteSelector = await deleteService.createImageDeleteSelector(lotNumber, date);
      
      // Send message
      await lineService.replyMessage(replyToken, deleteSelector);
    } catch (error) {
      logger.error('Error processing date selection for deletion:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการดึงรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Handle image deletion request (confirmation)
  async handleDeleteRequest(userId, imageId, lotNumber, date, replyToken, chatContext = null) {
    try {
      // Create confirmation message
      const confirmMessage = await deleteService.createDeleteConfirmationMessage(imageId, lotNumber, date);
      
      // Send confirmation
      await lineService.replyMessage(replyToken, confirmMessage);
    } catch (error) {
      logger.error('Error handling delete request:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการดำเนินการลบรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Handle delete confirmation
  async handleDeleteConfirmation(userId, imageId, lotNumber, date, replyToken, chatContext = null) {
    try {
      // Delete the image
      await deleteService.deleteImage(imageId);
      
      // Send success message
      const successMessage = {
        type: 'text',
        text: `ลบรูปภาพสำเร็จ\nLot: ${lotNumber}\nวันที่: ${new Date(date).toLocaleDateString('th-TH')}`
      };
      
      await lineService.replyMessage(replyToken, successMessage);
    } catch (error) {
      logger.error('Error confirming image deletion:', error);
      
      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการลบรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));
      
      throw error;
    }
  }

  // Handle delete cancellation
  async handleDeleteCancellation(userId, lotNumber, date, replyToken, chatContext = null) {
    try {
      // Send cancellation message
      const cancelMessage = {
        type: 'text',
        text: 'ยกเลิกการลบรูปภาพแล้ว'
      };

      await lineService.replyMessage(replyToken, cancelMessage);
    } catch (error) {
      logger.error('Error handling delete cancellation:', error);
      throw error;
    }
  }

  // Process delete album - show date picker and confirmation
  async processDeleteAlbum(userId, lotNumber, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';

      // Validate lot number
      if (!lotNumber || lotNumber.trim() === '') {
        await lineService.replyMessage(
          replyToken,
          lineService.createTextMessage('เลข Lot ไม่ถูกต้อง กรุณาระบุเลข Lot อีกครั้ง')
        );
        return;
      }

      // Show date picker with only dates that have images
      await datePickerService.sendDeleteAlbumDatePicker(userId, lotNumber.trim(), chatContext, replyToken);

    } catch (error) {
      logger.error('Error processing delete album:', error);

      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการประมวลผลเลข Lot โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));

      throw error;
    }
  }

  // Show delete album confirmation after date selection
  async showDeleteAlbumConfirmation(userId, lotNumber, date, replyToken, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';

      // Reset user state
      lineService.setUserState(userId, lineConfig.userStates.idle, {}, chatId);

      // Create delete album confirmation message
      const confirmMessage = await deleteService.createDeleteAlbumConfirmation(lotNumber, date);

      // Send confirmation
      await lineService.replyMessage(replyToken, confirmMessage);

    } catch (error) {
      logger.error('Error showing delete album confirmation:', error);

      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการดึงรูปภาพ โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));

      throw error;
    }
  }

  // Handle delete album confirmation
  async handleDeleteAlbumConfirmation(userId, lotNumber, date, replyToken, chatContext = null) {
    try {
      // Delete the entire album
      const result = await deleteService.deleteAlbum(lotNumber, date);

      // Send success message
      const successMessage = {
        type: 'text',
        text: `✅ ลบอัลบั้มสำเร็จ\n\n` +
              `📦 Lot: ${lotNumber}\n` +
              `📅 วันที่: ${new Date(date).toLocaleDateString('th-TH')}\n` +
              `🗑️ ลบรูปภาพ: ${result.deletedCount}/${result.totalImages} รูป` +
              (result.errors.length > 0 ? `\n\n⚠️ มีข้อผิดพลาด ${result.errors.length} รายการ` : '')
      };

      await lineService.replyMessage(replyToken, successMessage);

      logger.info(`Album deleted successfully - Lot: ${lotNumber}, Date: ${date}, Count: ${result.deletedCount}`);

    } catch (error) {
      logger.error('Error confirming album deletion:', error);

      // Reply with error message
      const errorMessage = 'เกิดข้อผิดพลาดในการลบอัลบั้ม โปรดลองใหม่อีกครั้ง';
      await lineService.replyMessage(replyToken, lineService.createTextMessage(errorMessage));

      throw error;
    }
  }

  // Handle delete album cancellation
  async handleDeleteAlbumCancellation(userId, lotNumber, date, replyToken, chatContext = null) {
    try {
      // Send cancellation message
      const cancelMessage = {
        type: 'text',
        text: '✅ ยกเลิกการลบอัลบั้มแล้ว\n\nรูปภาพทั้งหมดยังคงอยู่'
      };

      await lineService.replyMessage(replyToken, cancelMessage);
    } catch (error) {
      logger.error('Error handling delete album cancellation:', error);
      throw error;
    }
  }
}

module.exports = new DeleteController();