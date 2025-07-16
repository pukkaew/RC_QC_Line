// Service for deleting images
const lineService = require('./LineService');
const imageService = require('./ImageService');
const datePickerService = require('./DatePickerService');
const imageModel = require('../models/ImageModel');
const lotModel = require('../models/LotModel');
const logger = require('../utils/Logger');
const { AppError } = require('../utils/ErrorHandler');

class DeleteService {
  // Get images for a specific lot and date with delete options
  async getImagesWithDeleteOptions(lotNumber, date) {
    try {
      // Get images from database
      const result = await imageService.getImagesByLotAndDate(lotNumber, date);
      
      if (!result.images || result.images.length === 0) {
        return {
          lotNumber,
          date,
          hasImages: false,
          message: `ไม่พบรูปภาพสำหรับ Lot: ${lotNumber} วันที่: ${date}`
        };
      }
      
      // Create delete options for each image
      const images = result.images.map((image, index) => ({
        ...image,
        deleteAction: `delete_image_${image.image_id}`
      }));
      
      return {
        lotNumber,
        date,
        hasImages: true,
        images,
        count: images.length
      };
    } catch (error) {
      logger.error('Error getting images with delete options:', error);
      throw error;
    }
  }

  // Create delete confirmation message
  async createDeleteConfirmationMessage(imageId, lotNumber, date) {
    try {
      // Get image details
      const query = `
        SELECT i.*, l.lot_number 
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE i.image_id = @imageId
      `;
      
      const params = [
        { name: 'imageId', type: require('mssql').Int, value: imageId }
      ];
      
      const result = await require('../services/DatabaseService').executeQuery(query, params);
      
      if (!result.recordset || result.recordset.length === 0) {
        throw new AppError('Image not found', 404);
      }
      
      const image = result.recordset[0];
      
      // Create confirmation flex message
      const confirmMessage = {
        type: "flex",
        altText: "ยืนยันการลบรูปภาพ",
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ยืนยันการลบรูปภาพ",
                weight: "bold",
                size: "lg"
              },
              {
                type: "text",
                text: `Lot: ${lotNumber}`,
                size: "md",
                margin: "md"
              },
              {
                type: "text",
                text: `วันที่: ${new Date(date).toLocaleDateString('th-TH')}`,
                size: "md",
                margin: "sm"
              },
              {
                type: "text",
                text: "คุณต้องการลบรูปภาพนี้ใช่หรือไม่?",
                size: "md",
                margin: "md",
                color: "#FF0000"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "button",
                style: "secondary",
                action: {
                  type: "postback",
                  label: "ยกเลิก",
                  data: `action=cancel_delete&lot=${lotNumber}&date=${date}`,
                  displayText: "ยกเลิกการลบรูปภาพ"
                }
              },
              {
                type: "button",
                style: "primary",
                color: "#FF0000",
                action: {
                  type: "postback",
                  label: "ลบรูปภาพ",
                  data: `action=confirm_delete&image_id=${imageId}&lot=${lotNumber}&date=${date}`,
                  displayText: "ยืนยันลบรูปภาพ"
                }
              }
            ],
            spacing: "md"
          }
        }
      };
      
      return confirmMessage;
    } catch (error) {
      logger.error('Error creating delete confirmation message:', error);
      throw error;
    }
  }

  // Create image selection using LIFF
  async createImageDeleteSelector(lotNumber, date) {
    try {
      // Get images to check if they exist
      const result = await this.getImagesWithDeleteOptions(lotNumber, date);
      
      if (!result.hasImages) {
        return {
          type: "text",
          text: result.message
        };
      }
      
      // Build LIFF URL for delete interface
      const baseUrl = process.env.BASE_URL || 'https://line.ruxchai.co.th';
      // Use the same LIFF ID but with page parameter
      const liffUrl = `https://liff.line.me/2007575196-NWaXrZVE?page=delete&lot=${encodeURIComponent(lotNumber)}&date=${encodeURIComponent(date)}`;
      
      // Create flex message to open LIFF
      const flexMessage = {
        type: "flex",
        altText: `ลบรูปภาพ - Lot: ${lotNumber}`,
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "🗑️ ลบรูปภาพ QC",
                size: "xl",
                weight: "bold",
                color: "#FF0000"
              }
            ],
            paddingAll: "15px",
            backgroundColor: "#FFF0F0"
          },
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: `📦 Lot: ${lotNumber}`,
                size: "md",
                color: "#333333",
                margin: "sm"
              },
              {
                type: "text",
                text: `📅 วันที่: ${new Date(date).toLocaleDateString('th-TH')}`,
                size: "md",
                color: "#333333",
                margin: "sm"
              },
              {
                type: "text",
                text: `🖼️ จำนวน: ${result.count} รูป`,
                size: "md",
                weight: "bold",
                color: "#FF0000",
                margin: "sm"
              },
              {
                type: "separator",
                margin: "lg"
              },
              {
                type: "text",
                text: "กดปุ่มด้านล่างเพื่อเลือกรูปที่ต้องการลบ",
                size: "sm",
                color: "#666666",
                margin: "lg",
                wrap: true
              }
            ],
            paddingAll: "20px"
          },
          footer: {
            type: "box",
            layout: "vertical",
            spacing: "sm",
            contents: [
              {
                type: "button",
                style: "primary",
                height: "md",
                action: {
                  type: "uri",
                  label: "🗑️ เลือกรูปที่จะลบ",
                  uri: liffUrl
                },
                color: "#FF0000"
              },
              {
                type: "text",
                text: "💡 สามารถเลือกลบหลายรูปพร้อมกันได้",
                size: "xs",
                color: "#999999",
                align: "center",
                margin: "sm"
              }
            ],
            paddingAll: "15px"
          }
        }
      };
      
      return flexMessage;
    } catch (error) {
      logger.error('Error creating image delete selector:', error);
      throw error;
    }
  }

  // Delete an image
  async deleteImage(imageId) {
    try {
      return await imageService.deleteImage(imageId);
    } catch (error) {
      logger.error('Error deleting image:', error);
      throw error;
    }
  }
}

module.exports = new DeleteService();