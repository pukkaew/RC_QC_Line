// Service for sharing actual images to selected chats
const line = require('@line/bot-sdk');
const logger = require('../utils/Logger');
const { v4: uuidv4 } = require('uuid');

class ImageShareService {
  constructor() {
    this.client = new line.Client({
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
    });
    
    // Store share sessions temporarily
    this.shareSessions = new Map();
  }

  // Create a share session
  async createShareSession(userId, images, lotNumber, imageDate) {
    try {
      const sessionId = uuidv4();
      const session = {
        id: sessionId,
        userId: userId,
        images: images,
        lotNumber: lotNumber,
        imageDate: imageDate,
        createdAt: new Date(),
        status: 'pending'
      };
      
      this.shareSessions.set(sessionId, session);
      
      // Auto cleanup after 5 minutes
      setTimeout(() => {
        this.shareSessions.delete(sessionId);
      }, 5 * 60 * 1000);
      
      logger.info(`Created share session: ${sessionId} for user: ${userId}`);
      
      return {
        sessionId: sessionId,
        shareUrl: this.generateShareUrl(sessionId)
      };
    } catch (error) {
      logger.error('Error creating share session:', error);
      throw error;
    }
  }

  // Generate share URL
  generateShareUrl(sessionId) {
    const baseUrl = process.env.BASE_URL || 'https://line.ruxchai.co.th';
    return `${baseUrl}/share/${sessionId}`;
  }

  // Get share session
  getShareSession(sessionId) {
    return this.shareSessions.get(sessionId);
  }

  // Send images to a specific chat
  async sendImagesToChat(sessionId, targetId, targetType = 'user') {
    try {
      const session = this.shareSessions.get(sessionId);
      
      if (!session) {
        throw new Error('Share session not found or expired');
      }
      
      // Prepare messages
      const messages = [];
      
      // Header message
      messages.push({
        type: 'text',
        text: `📸 รูปภาพ QC\n📦 Lot: ${session.lotNumber}\n📅 ${new Date(session.imageDate).toLocaleDateString('th-TH')}\n🖼️ จำนวน ${session.images.length} รูป`
      });
      
      // Add images (max 5 per send due to LINE limitation)
      const maxImages = Math.min(session.images.length, 5);
      for (let i = 0; i < maxImages; i++) {
        messages.push({
          type: 'image',
          originalContentUrl: session.images[i].url,
          previewImageUrl: session.images[i].url
        });
      }
      
      // Send messages based on target type
      if (targetType === 'group') {
        await this.client.pushMessage(targetId, messages);
      } else if (targetType === 'user') {
        await this.client.pushMessage(targetId, messages);
      } else if (targetType === 'room') {
        await this.client.pushMessage(targetId, messages);
      }
      
      // Send remaining images if more than 5
      if (session.images.length > 5) {
        for (let i = 5; i < session.images.length; i += 5) {
          const batch = session.images.slice(i, i + 5).map(img => ({
            type: 'image',
            originalContentUrl: img.url,
            previewImageUrl: img.url
          }));
          
          await new Promise(resolve => setTimeout(resolve, 500)); // Delay between batches
          await this.client.pushMessage(targetId, batch);
        }
        
        // Send completion message
        await this.client.pushMessage(targetId, {
          type: 'text',
          text: `✅ ส่งรูปภาพทั้งหมด ${session.images.length} รูป เรียบร้อยแล้ว`
        });
      }
      
      // Update session status
      session.status = 'sent';
      session.sentTo = targetId;
      session.sentAt = new Date();
      
      logger.info(`Sent ${session.images.length} images to ${targetType}: ${targetId}`);
      
      return {
        success: true,
        count: session.images.length,
        targetId: targetId,
        targetType: targetType
      };
      
    } catch (error) {
      logger.error('Error sending images to chat:', error);
      throw error;
    }
  }

  // Create shareable link message
  createShareableMessage(sessionId) {
    const shareUrl = this.generateShareUrl(sessionId);
    const session = this.shareSessions.get(sessionId);
    
    if (!session) {
      throw new Error('Share session not found');
    }
    
    return {
      type: 'flex',
      altText: 'แชร์รูปภาพ QC',
      contents: {
        type: 'bubble',
        hero: {
          type: 'image',
          url: session.images[0].url,
          size: 'full',
          aspectRatio: '1:1',
          aspectMode: 'cover'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '📸 แชร์รูปภาพ QC',
              weight: 'bold',
              size: 'lg',
              color: '#00B900'
            },
            {
              type: 'text',
              text: `Lot: ${session.lotNumber}`,
              size: 'md',
              margin: 'md'
            },
            {
              type: 'text',
              text: `จำนวน: ${session.images.length} รูป`,
              size: 'sm',
              color: '#666666'
            },
            {
              type: 'separator',
              margin: 'xl'
            },
            {
              type: 'text',
              text: 'กดปุ่มด้านล่างเพื่อรับรูปภาพ',
              size: 'sm',
              color: '#999999',
              margin: 'md',
              wrap: true
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              style: 'primary',
              action: {
                type: 'uri',
                label: '📥 รับรูปภาพ',
                uri: shareUrl
              },
              color: '#00B900'
            }
          ]
        }
      }
    };
  }

  // Clean expired sessions
  cleanExpiredSessions() {
    const now = new Date();
    const expireTime = 5 * 60 * 1000; // 5 minutes
    
    for (const [sessionId, session] of this.shareSessions.entries()) {
      if (now - session.createdAt > expireTime) {
        this.shareSessions.delete(sessionId);
        logger.info(`Cleaned expired session: ${sessionId}`);
      }
    }
  }
}

module.exports = new ImageShareService();