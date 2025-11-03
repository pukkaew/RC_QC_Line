// Service for date picker functionality with Album Preview
const lineService = require('./LineService');
const lineConfig = require('../config/line');
const dateFormatter = require('../utils/DateFormatter');
const logger = require('../utils/Logger');
const { AppError } = require('../utils/ErrorHandler');
const lotModel = require('../models/LotModel');
const imageModel = require('../models/ImageModel');

class DatePickerService {
  constructor() {
    this.dateFormatter = dateFormatter;
  }

  // Get available dates for a lot (dates that have images)
  async getAvailableDatesForLot(lotNumber) {
    try {
      logger.info(`DatePicker: Getting available dates for Lot: ${lotNumber}`);
      
      // Get lot info
      const lot = await lotModel.getByLotNumber(lotNumber);
      
      if (!lot) {
        logger.warn(`DatePicker: Lot ${lotNumber} not found in database`);
        return [];
      }
      
      logger.info(`DatePicker: Found Lot ${lotNumber} with ID: ${lot.lot_id}`);
      
      // Query for dates with images for this lot
      // FIXED: Count only images from the latest upload session per date (matching ImageModel logic)
      const query = `
        WITH LatestSessionPerDate AS (
          SELECT
            CONVERT(DATE, image_date) as image_date,
            MAX(upload_session_id) as latest_session_id
          FROM Images
          WHERE lot_id = @lotId
            AND status = 'active'
            AND upload_session_id IS NOT NULL
          GROUP BY CONVERT(DATE, image_date)
        )
        SELECT
          CONVERT(DATE, i.image_date) as date,
          COUNT(*) as count
        FROM Images i
        LEFT JOIN LatestSessionPerDate ls ON CONVERT(DATE, i.image_date) = ls.image_date
        WHERE i.lot_id = @lotId
          AND i.status = 'active'
          AND (
            -- Case 1: No sessions exist for this date (all are NULL) - count all images
            (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
            OR
            -- Case 2: Sessions exist - count ONLY images from the latest session
            (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
          )
        GROUP BY CONVERT(DATE, i.image_date)
        ORDER BY date DESC
      `;
      
      const params = [
        { name: 'lotId', type: require('mssql').Int, value: lot.lot_id }
      ];
      
      const result = await require('../services/DatabaseService').executeQuery(query, params);
      
      logger.info(`DatePicker: Found ${result.recordset.length} distinct dates with images for Lot ${lotNumber}`);
      
      // Log each available date
      result.recordset.forEach(row => {
        const dateStr = new Date(row.date).toISOString().split('T')[0];
        logger.info(`DatePicker: - ${dateStr}: ${row.count} images`);
      });
      
      // Format dates
      const availableDates = result.recordset.map(row => {
        const date = new Date(row.date);
        return {
          date: this.dateFormatter.formatISODate(date),
          display: this.dateFormatter.formatDisplayDate(date),
          thai: this.dateFormatter.formatThaiDate(date),
          count: row.count
        };
      });
      
      return availableDates;
    } catch (error) {
      logger.error('Error getting available dates for lot:', error);
      return [];
    }
  }

  // Send date picker for viewing images with album preview
  async sendViewDatePickerWithAlbum(userId, lotNumber, chatContext = null, replyToken = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Create the date picker flex message with postback action (not direct LIFF)
      const flexMessage = await this.createViewDatePickerFlexMessage(lotNumber, 'view');
      
      // Enhanced error handling for group chats
      try {
        // Send the message - use replyToken if provided, otherwise use push
        if (replyToken) {
          await lineService.replyMessage(replyToken, flexMessage);
        } else {
          if (chatContext?.isGroupChat) {
            await lineService.pushMessageToChat(chatId, flexMessage, chatContext.chatType);
          } else {
            await lineService.pushMessage(userId, flexMessage);
          }
        }
      } catch (sendError) {
        logger.error(`Error sending date picker to ${chatContext?.isGroupChat ? 'group' : 'direct'} chat:`, sendError);
        
        // Fallback: If flex message fails in group, send text message
        if (chatContext?.isGroupChat) {
          const fallbackMessage = await this.createTextDatePickerFallback(lotNumber, 'view');
          
          if (replyToken) {
            await lineService.replyMessage(replyToken, fallbackMessage);
          } else {
            await lineService.pushMessageToChat(chatId, fallbackMessage, chatContext.chatType);
          }
        } else {
          throw sendError; // Re-throw for direct chats
        }
      }
      
      // Update user state to waiting for date selection
      lineService.setUserState(userId, lineConfig.userStates.waitingForDate, {
        lotNumber,
        action: 'view'
      }, chatId);
      
      return true;
    } catch (error) {
      logger.error('Error sending view date picker with album:', error);
      throw new AppError('Failed to send date picker', 500, { error: error.message });
    }
  }

  // Send date picker for uploads
  async sendUploadDatePicker(userId, lotNumber, chatContext = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';
      
      // Create the date picker flex message
      const flexMessage = await this.createUploadDatePickerFlexMessage(lotNumber);
      
      // Send the message to the user
      if (chatContext?.isGroupChat) {
        await lineService.pushMessageToChat(chatId, flexMessage, chatContext.chatType);
      } else {
        await lineService.pushMessage(userId, flexMessage);
      }
      
      // Update user state to waiting for date selection with chat context
      lineService.setUserState(userId, lineService.userStates.waitingForDate, {
        lotNumber,
        action: 'upload'
      }, chatId);
      
      return true;
    } catch (error) {
      logger.error('Error sending upload date picker:', error);
      throw new AppError('Failed to send date picker', 500, { error: error.message });
    }
  }

  // Send date picker for deleting images
  async sendDeleteDatePicker(userId, lotNumber, chatContext = null, replyToken = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';

      // Create the date picker flex message with delete action
      const flexMessage = await this.createViewDatePickerFlexMessage(lotNumber, 'delete');

      // Enhanced error handling for group chats
      try {
        // Send the message - use replyToken if provided, otherwise use push
        if (replyToken) {
          await lineService.replyMessage(replyToken, flexMessage);
        } else {
          if (chatContext?.isGroupChat) {
            await lineService.pushMessageToChat(chatId, flexMessage, chatContext.chatType);
          } else {
            await lineService.pushMessage(userId, flexMessage);
          }
        }
      } catch (sendError) {
        logger.error(`Error sending delete date picker to ${chatContext?.isGroupChat ? 'group' : 'direct'} chat:`, sendError);

        // Fallback: If flex message fails in group, send text message with quick reply
        if (chatContext?.isGroupChat) {
          const fallbackMessage = await this.createTextDatePickerFallback(lotNumber, 'delete');

          if (replyToken) {
            await lineService.replyMessage(replyToken, fallbackMessage);
          } else {
            await lineService.pushMessageToChat(chatId, fallbackMessage, chatContext.chatType);
          }
        } else {
          throw sendError; // Re-throw for direct chats
        }
      }

      // Update user state to waiting for date selection with chat context
      lineService.setUserState(userId, lineConfig.userStates.waitingForDate, {
        lotNumber,
        action: 'delete'
      }, chatId);

      return true;
    } catch (error) {
      logger.error('Error sending delete date picker:', error);
      throw new AppError('Failed to send date picker', 500, { error: error.message });
    }
  }

  // Send date picker for deleting entire album
  async sendDeleteAlbumDatePicker(userId, lotNumber, chatContext = null, replyToken = null) {
    try {
      const chatId = chatContext?.chatId || 'direct';

      // Create the date picker flex message with deleteAlbum action
      const flexMessage = await this.createViewDatePickerFlexMessage(lotNumber, 'deleteAlbum');

      // Enhanced error handling for group chats
      try {
        // Send the message - use replyToken if provided, otherwise use push
        if (replyToken) {
          await lineService.replyMessage(replyToken, flexMessage);
        } else {
          if (chatContext?.isGroupChat) {
            await lineService.pushMessageToChat(chatId, flexMessage, chatContext.chatType);
          } else {
            await lineService.pushMessage(userId, flexMessage);
          }
        }
      } catch (sendError) {
        logger.error(`Error sending delete album date picker to ${chatContext?.isGroupChat ? 'group' : 'direct'} chat:`, sendError);

        // Fallback: If flex message fails in group, send text message with quick reply
        if (chatContext?.isGroupChat) {
          const fallbackMessage = await this.createTextDatePickerFallback(lotNumber, 'deleteAlbum');

          if (replyToken) {
            await lineService.replyMessage(replyToken, fallbackMessage);
          } else {
            await lineService.pushMessageToChat(chatId, fallbackMessage, chatContext.chatType);
          }
        } else {
          throw sendError; // Re-throw for direct chats
        }
      }

      // Update user state to waiting for date selection with chat context
      lineService.setUserState(userId, lineConfig.userStates.waitingForDate, {
        lotNumber,
        action: 'deleteAlbum'
      }, chatId);

      return true;
    } catch (error) {
      logger.error('Error sending delete album date picker:', error);
      throw new AppError('Failed to send date picker', 500, { error: error.message });
    }
  }

  // Create date picker flex message for uploads (current date only)
  async createUploadDatePickerFlexMessage(lotNumber) {
    // Get current date only
    const today = new Date();
    const currentDate = {
      date: this.dateFormatter.formatISODate(today),
      display: this.dateFormatter.formatDisplayDate(today),
      thai: this.dateFormatter.formatThaiDate(today)
    };
    
    // Create the flex message with only current date
    const flexMessage = {
      type: "flex",
      altText: "เลือกวันที่",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `เลือกวันที่สำหรับ Lot: ${lotNumber}`,
              weight: "bold",
              size: "lg",
              wrap: true
            },
            {
              type: "text",
              text: "กรุณาเลือกวันที่ที่ต้องการ",
              size: "sm",
              color: "#999999",
              margin: "md"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  action: {
                    type: "postback",
                    label: currentDate.display + " (วันนี้)",
                    data: `action=upload&lot=${lotNumber}&date=${currentDate.date}`,
                    displayText: `เลือกวันที่ ${currentDate.display} (วันนี้)`
                  },
                  margin: "sm",
                  height: "sm"
                }
              ]
            }
          ]
        }
      }
    };
    
    return flexMessage;
  }

  // Create date picker flex message with postback actions
  async createViewDatePickerFlexMessage(lotNumber, action = 'view') {
    logger.info(`DatePicker: Creating ${action} date picker for Lot: ${lotNumber}`);
    
    // Get dates that have images for this lot
    const availableDates = await this.getAvailableDatesForLot(lotNumber);
    
    if (availableDates.length === 0) {
      logger.warn(`DatePicker: No available dates found for Lot: ${lotNumber}`);
      
      // No images found for this lot
      return {
        type: "flex",
        altText: "ไม่พบรูปภาพ",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `ไม่พบรูปภาพสำหรับ Lot: ${lotNumber}`,
                weight: "bold",
                size: "md",
                wrap: true
              },
              {
                type: "text",
                text: "กรุณาตรวจสอบเลข Lot หรืออัปโหลดรูปภาพก่อน",
                size: "sm",
                color: "#999999",
                margin: "md",
                wrap: true
              }
            ]
          },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "button",
                style: "primary",
                action: {
                  type: "message",
                  label: "ดูรูปภาพ Lot อื่น",
                  text: "#view"
                }
              }
            ]
          }
        }
      };
    }
    
    logger.info(`DatePicker: Creating date picker with ${availableDates.length} available dates`);
    
    // Create date buttons with count
    const dateButtons = availableDates.map(dateObj => {
      // Add "(วันนี้)" for current date
      const isToday = dateObj.date === this.dateFormatter.getCurrentDate();
      const label = isToday 
        ? `${dateObj.display} (วันนี้) - ${dateObj.count} รูป` 
        : `${dateObj.display} - ${dateObj.count} รูป`;
      
      logger.info(`DatePicker: Adding date button: ${label} (${dateObj.date})`);
      
      return {
        type: "button",
        style: isToday ? "primary" : "secondary",
        action: {
          type: "postback",
          label: label,
          data: `action=${action}&lot=${lotNumber}&date=${dateObj.date}`,
          displayText: `เลือกวันที่ ${dateObj.display}`
        },
        margin: "sm",
        height: "sm"
      };
    });
    
    // Determine header text based on action
    let headerText = "📸 ดูอัลบั้มรูปภาพ";
    let headerColor = "#00B900";
    if (action === 'delete') {
      headerText = "🗑️ ลบรูปภาพ";
      headerColor = "#FF0000";
    }
    
    // Create the flex message with enhanced design
    const flexMessage = {
      type: "flex",
      altText: "เลือกวันที่",
      contents: {
        type: "bubble",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: headerText,
              weight: "bold",
              size: "xl",
              color: headerColor
            }
          ],
          paddingAll: "15px"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `📦 Lot: ${lotNumber}`,
              weight: "bold",
              size: "lg",
              wrap: true
            },
            {
              type: "text",
              text: "กรุณาเลือกวันที่ที่ต้องการ",
              size: "sm",
              color: "#666666",
              margin: "md"
            },
            {
              type: "separator",
              margin: "lg"
            },
            {
              type: "box",
              layout: "vertical",
              margin: "lg",
              spacing: "sm",
              contents: dateButtons
            }
          ]
        }
      }
    };
    
    return flexMessage;
  }

  // Create text-based date picker fallback for groups
  async createTextDatePickerFallback(lotNumber, action = 'view') {
    const availableDates = await this.getAvailableDatesForLot(lotNumber);
    
    if (availableDates.length === 0) {
      return {
        type: 'text',
        text: `ไม่พบรูปภาพสำหรับ Lot: ${lotNumber}\nกรุณาตรวจสอบเลข Lot หรืออัปโหลดรูปภาพก่อน`
      };
    }
    
    // Create quick reply items for available dates
    const quickReplyItems = availableDates.map(dateObj => {
      const isToday = dateObj.date === this.dateFormatter.getCurrentDate();
      const label = isToday 
        ? `${dateObj.display} (วันนี้)` 
        : dateObj.display;
      
      return {
        type: 'action',
        action: {
          type: 'postback',
          label: label,
          data: `action=${action}&lot=${lotNumber}&date=${dateObj.date}`,
          displayText: `เลือกวันที่ ${dateObj.display}`
        }
      };
    });
    
    return {
      type: 'text',
      text: `เลือกวันที่สำหรับ Lot: ${lotNumber}`,
      quickReply: {
        items: quickReplyItems
      }
    };
  }

  // Handle date selection from postback
  async handleDateSelection(userId, lotNumber, date, action, chatContext = null) {
    try {
      // Parse the date string
      const selectedDate = this.dateFormatter.parseDate(date);
      const formattedDate = this.dateFormatter.formatDisplayDate(selectedDate);
      
      // Create confirmation message
      const confirmMessage = lineService.createTextMessage(
        `คุณได้เลือกวันที่ ${formattedDate} สำหรับ Lot: ${lotNumber}`
      );
      
      // Send confirmation to user
      if (chatContext?.isGroupChat) {
        await lineService.pushMessageToChat(chatContext.chatId, confirmMessage, chatContext.chatType);
      } else {
        await lineService.pushMessage(userId, confirmMessage);
      }
      
      // Return the selected date information
      return {
        lotNumber,
        date: selectedDate,
        formattedDate,
        action
      };
    } catch (error) {
      logger.error('Error handling date selection:', error);
      throw new AppError('Failed to process date selection', 500, { error: error.message });
    }
  }
}

module.exports = new DatePickerService();