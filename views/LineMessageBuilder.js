// Builder for LINE messages - Fixed Version
const lineConfig = require('../config/line');
const dateFormatter = require('../utils/DateFormatter');

class LineMessageBuilder {
  constructor() {
    this.dateFormatter = dateFormatter;
  }

  // Build a simple text message
  buildTextMessage(text) {
    return {
      type: 'text',
      text: text
    };
  }

  // Build an image message
  buildImageMessage(originalUrl, previewUrl = null) {
    // Ensure URL uses BASE_URL environment variable for external access
    if (originalUrl.startsWith('/')) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      originalUrl = baseUrl + originalUrl;
      previewUrl = previewUrl ? baseUrl + previewUrl : originalUrl;
    }
    
    return {
      type: 'image',
      originalContentUrl: originalUrl,
      previewImageUrl: previewUrl || originalUrl
    };
  }

  // Build a quick reply item
  buildQuickReplyItem(label, text, data = null) {
    return {
      type: 'action',
      action: {
        type: data ? 'postback' : 'message',
        label: label,
        ...(data ? { 
          data: data,
          displayText: text
        } : { 
          text: text 
        })
      }
    };
  }

  // Build a message with quick reply options
  buildQuickReplyMessage(text, items) {
    return {
      type: 'text',
      text: text,
      quickReply: {
        items: items
      }
    };
  }

  // Build a message asking for Lot number
  buildLotNumberRequestMessage(action) {
    const text = action === lineConfig.userActions.upload
      ? 'กรุณาระบุเลข Lot สำหรับรูปภาพที่อัปโหลด'
      : 'กรุณาระบุเลข Lot ที่ต้องการดูรูปภาพ';
    
    return this.buildTextMessage(text);
  }

  // Build a message showing image upload success
  buildUploadSuccessMessage(result) {
    const { lot, images } = result;
    const imageCount = images.length;
    const lotNumber = lot.lot_number;
    const date = this.dateFormatter.formatDisplayDate(images[0].imageDate);
    
    let text = `✅ อัปโหลดสำเร็จ ${imageCount} รูปภาพ\n`;
    text += `📦 Lot: ${lotNumber}\n`;
    text += `📅 วันที่: ${date}\n\n`;
    
    if (imageCount > 0) {
      const savedSize = images.reduce((total, img) => {
        return total + (img.originalSize - img.compressedSize);
      }, 0);
      
      const savedMB = (savedSize / (1024 * 1024)).toFixed(2);
      text += `💾 ประหยัดพื้นที่ได้: ${savedMB} MB`;
    }
    
    return this.buildTextMessage(text);
  }

  // Build messages for showing images (Fixed Strategy)
  buildImageViewMessages(result) {
    const { lotNumber, imageDate, images } = result;
    const formattedDate = this.dateFormatter.formatDisplayDate(imageDate);
    const messages = [];
    
    // If no images found
    if (images.length === 0) {
      return [this.buildNoImagesFoundMessage(lotNumber, imageDate)];
    }
    
    // Add header message with count
    const headerText = `📸 Lot: ${lotNumber}\n📅 ${formattedDate}\n🎯 พบ ${images.length} รูปภาพ`;
    messages.push(this.buildTextMessage(headerText));
    
    // Strategy: Send ALL images as native messages for reliability
    // LINE supports up to 5 messages per reply, then use push
    const allNativeImages = this.buildAllNativeImages(images);
    messages.push(...allNativeImages);
    
    // Add footer with summary if many images
    if (images.length > 10) {
      const footerText = `✅ แสดงครบทั้ง ${images.length} รูปแล้ว`;
      messages.push(this.buildTextMessage(footerText));
    }
    
    return messages;
  }

  // Build ALL images as native images (most reliable method)
  buildAllNativeImages(images) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    return images.map(image => {
      const imageUrl = image.url.startsWith('http') 
        ? image.url 
        : `${baseUrl}${image.url}`;
      
      return this.buildImageMessage(imageUrl);
    });
  }

  // Build native images (subset)
  buildNativeImages(images) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    return images.map(image => {
      const imageUrl = image.url.startsWith('http') 
        ? image.url 
        : `${baseUrl}${image.url}`;
      
      return this.buildImageMessage(imageUrl);
    });
  }

  // Build image carousel (for reference, but simplified)
  buildImageCarousel(images, lotNumber) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    
    const carouselColumns = images.slice(0, 10).map((image, index) => {
      const imageUrl = image.url.startsWith('http') 
        ? image.url 
        : `${baseUrl}${image.url}`;
      
      return {
        imageUrl: imageUrl,
        action: {
          type: "postback",
          data: `action=carousel_share&image_url=${encodeURIComponent(imageUrl)}&index=${index + 1}&lot=${lotNumber}`,
          displayText: `แชร์รูปที่ ${index + 1}`
        }
      };
    });
    
    return {
      type: "template",
      altText: `🎠 Carousel - ${lotNumber} (${images.length} รูป)`,
      template: {
        type: "image_carousel",
        columns: carouselColumns
      }
    };
  }

  // Build a message for no images found
  buildNoImagesFoundMessage(lotNumber, date = null) {
    let message = `❌ ไม่พบรูปภาพสำหรับ Lot: ${lotNumber}`;
    
    if (date) {
      const formattedDate = this.dateFormatter.formatDisplayDate(date);
      message += ` วันที่: ${formattedDate}`;
    }
    
    message += '\n\n💡 กรุณาตรวจสอบ:\n• เลข Lot ถูกต้องหรือไม่\n• มีการอัปโหลดรูปภาพแล้วหรือไม่';
    
    return this.buildTextMessage(message);
  }

  // Build an error message
  buildErrorMessage(message) {
    return this.buildTextMessage(`❌ เกิดข้อผิดพลาด: ${message}`);
  }

  // Build Flex Message for image deletion selection (Simplified)
  buildImageDeleteFlexMessage(lotNumber, imageDate, images) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const formattedDate = this.dateFormatter.formatDisplayDate(imageDate);
    
    // Limit to first 6 images for deletion UI
    const deleteImages = images.slice(0, 6);
    
    const imageBoxes = deleteImages.map((image, index) => {
      const imageUrl = image.url.startsWith('http') 
        ? image.url 
        : `${baseUrl}${image.url}`;
      
      return {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "image",
            url: imageUrl,
            aspectRatio: "1:1",
            aspectMode: "cover",
            size: "full"
          },
          {
            type: "button",
            style: "primary",
            color: "#FF0000",
            action: {
              type: "postback",
              label: `ลบรูปที่ ${index + 1}`,
              data: `action=delete_image&image_id=${image.image_id}&lot=${lotNumber}&date=${this.dateFormatter.formatISODate(imageDate)}`,
              displayText: `ลบรูปที่ ${index + 1}`
            },
            margin: "sm",
            height: "sm"
          }
        ],
        flex: 1,
        margin: "xs"
      };
    });
    
    // Arrange in rows of 2
    const rows = [];
    for (let i = 0; i < imageBoxes.length; i += 2) {
      const rowImages = imageBoxes.slice(i, i + 2);
      
      // Fill empty slot if needed
      if (rowImages.length === 1) {
        rowImages.push({
          type: "box",
          layout: "vertical",
          contents: [],
          flex: 1
        });
      }
      
      rows.push({
        type: "box",
        layout: "horizontal",
        contents: rowImages,
        spacing: "sm",
        margin: "sm"
      });
    }
    
    return {
      type: "flex",
      altText: `🗑️ เลือกรูปที่จะลบ - ${lotNumber}`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `🗑️ เลือกรูปที่จะลบ`,
              weight: "bold",
              size: "lg",
              color: "#FF0000"
            },
            {
              type: "text",
              text: `📦 Lot: ${lotNumber} | 📅 ${formattedDate}`,
              size: "sm",
              color: "#666666",
              margin: "xs"
            }
          ],
          paddingAll: "12px",
          backgroundColor: "#FFF0F0"
        },
        body: {
          type: "box",
          layout: "vertical",
          contents: rows,
          paddingAll: "8px",
          spacing: "sm"
        },
        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: images.length > 6 ? `แสดง 6 จาก ${images.length} รูป` : `${images.length} รูปทั้งหมด`,
              size: "xs",
              color: "#999999",
              align: "center"
            }
          ],
          paddingAll: "8px"
        }
      }
    };
  }
}

module.exports = new LineMessageBuilder();