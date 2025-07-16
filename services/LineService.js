// Path: RC_QC_Line/services/LineService.js
// Service for LINE API interactions - Updated for Multi-Chat Support
const line = require('@line/bot-sdk');
const lineConfig = require('../config/line');
const commandConfig = require('../config/commands');
const logger = require('../utils/Logger');
const { AppError } = require('../utils/ErrorHandler');

class LineService {
  constructor() {
    this.lineConfig = {
      channelAccessToken: lineConfig.channelAccessToken,
      channelSecret: lineConfig.channelSecret
    };
    
    this.client = new line.Client(this.lineConfig);
    this.messageTypes = lineConfig.messageTypes;
    
    // Multi-Chat Support: Use composite keys (userId + chatId)
    this.userStates = new Map(); // In-memory storage for user states per chat
    this.uploadInfo = new Map(); // Track users upload information per chat
  }

  // Generate composite key for multi-chat support
  generateChatKey(userId, chatId = 'direct') {
    return `${userId}:${chatId}`;
  }

  // Extract chat context from LINE event source
  getChatContext(source) {
    if (source.type === 'group') {
      return {
        chatType: 'group',
        chatId: source.groupId,
        isGroupChat: true
      };
    } else if (source.type === 'room') {
      return {
        chatType: 'room', 
        chatId: source.roomId,
        isGroupChat: true
      };
    } else {
      return {
        chatType: 'user',
        chatId: 'direct',
        isGroupChat: false
      };
    }
  }

  // Check if a message starts with a specific command prefix
  isCommand(text, commandType) {
    const prefix = commandConfig.prefixes[commandType];
    return text.trim().toLowerCase().startsWith(prefix.toLowerCase());
  }

  // Get user upload info with chat context
  getUploadInfo(userId, chatId = 'direct') {
    const chatKey = this.generateChatKey(userId, chatId);
    return this.uploadInfo.get(chatKey);
  }

  // Set user upload info with chat context
  setUploadInfo(userId, info, chatId = 'direct') {
    const chatKey = this.generateChatKey(userId, chatId);
    if (info === null) {
      this.uploadInfo.delete(chatKey);
      return;
    }
    // Add chat context to upload info
    const enrichedInfo = {
      ...info,
      chatId: chatId,
      chatKey: chatKey,
      userId: userId
    };
    this.uploadInfo.set(chatKey, enrichedInfo);
  }

  // Get all upload info for a user across all chats
  getAllUploadInfoForUser(userId) {
    const userUploads = [];
    for (const [chatKey, info] of this.uploadInfo.entries()) {
      if (chatKey.startsWith(`${userId}:`)) {
        userUploads.push({
          chatKey,
          ...info
        });
      }
    }
    return userUploads;
  }

  // Verify LINE webhook signature
  verifySignature(body, signature) {
    return line.validateSignature(JSON.stringify(body), this.lineConfig.channelSecret, signature);
  }

  // Reply to a message
  async replyMessage(replyToken, messages) {
    try {
      if (!Array.isArray(messages)) {
        messages = [messages];
      }
      
      await this.client.replyMessage(replyToken, messages);
      return true;
    } catch (error) {
      logger.error('Error replying to LINE message:', error);
      throw new AppError('Failed to reply to message', 500, { error: error.message });
    }
  }

  // Push a message to a user
  async pushMessage(userId, messages) {
    try {
      if (!Array.isArray(messages)) {
        messages = [messages];
      }
      
      await this.client.pushMessage(userId, messages);
      return true;
    } catch (error) {
      logger.error('Error pushing LINE message:', error);
      throw new AppError('Failed to push message', 500, { error: error.message });
    }
  }

  // Push a message to a group or room
  async pushMessageToChat(chatId, messages, chatType = 'group') {
    try {
      if (!Array.isArray(messages)) {
        messages = [messages];
      }
      
      if (chatType === 'group') {
        await this.client.pushMessage(chatId, messages);
      } else if (chatType === 'room') {
        await this.client.pushMessage(chatId, messages);
      } else {
        // Direct message
        await this.client.pushMessage(chatId, messages);
      }
      
      return true;
    } catch (error) {
      logger.error('Error pushing message to chat:', error);
      throw new AppError('Failed to push message to chat', 500, { error: error.message });
    }
  }

  // Get user profile from LINE
  async getUserProfile(userId) {
    try {
      const profile = await this.client.getProfile(userId);
      return profile;
    } catch (error) {
      // Log specific error details
      if (error.statusCode === 404) {
        logger.warn(`User profile not found for userId: ${userId} - This may be a test/development user`);
      } else {
        logger.error('Error getting LINE user profile:', error);
      }
      
      // Return a default profile object instead of throwing
      return {
        userId: userId,
        displayName: `User_${userId.substring(0, 8)}`,
        pictureUrl: null,
        statusMessage: null
      };
    }
  }

  // Create a text message
  createTextMessage(text) {
    return {
      type: this.messageTypes.text,
      text: text
    };
  }

  // Create an image message
  createImageMessage(originalUrl, previewUrl = null) {
    // Ensure URL uses BASE_URL environment variable for external access
    if (originalUrl.startsWith('/')) {
      const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
      originalUrl = baseUrl + originalUrl;
      previewUrl = previewUrl ? baseUrl + previewUrl : originalUrl;
    }
    
    return {
      type: this.messageTypes.image,
      originalContentUrl: originalUrl,
      previewImageUrl: previewUrl || originalUrl
    };
  }

  // Create a quick reply message
  createQuickReplyMessage(text, items) {
    return {
      type: this.messageTypes.text,
      text: text,
      quickReply: {
        items: items
      }
    };
  }

  // Set a user's state with chat context
  setUserState(userId, state, data = {}, chatId = 'direct') {
    const chatKey = this.generateChatKey(userId, chatId);
    const enrichedData = {
      ...data,
      chatId: chatId,
      chatKey: chatKey,
      userId: userId,
      timestamp: Date.now()
    };
    this.userStates.set(chatKey, { state, data: enrichedData });
    
    // Log state change for debugging
    logger.info(`User state changed: ${chatKey} -> ${state}`, enrichedData);
  }

  // Get a user's state with chat context
  getUserState(userId, chatId = 'direct') {
    const chatKey = this.generateChatKey(userId, chatId);
    const defaultState = { 
      state: lineConfig.userStates.idle, 
      data: { 
        chatId: chatId, 
        userId: userId, 
        chatKey: chatKey 
      } 
    };
    return this.userStates.get(chatKey) || defaultState;
  }

  // Clear a user's state with chat context
  clearUserState(userId, chatId = 'direct') {
    const chatKey = this.generateChatKey(userId, chatId);
    this.userStates.delete(chatKey);
    logger.info(`User state cleared: ${chatKey}`);
  }

  // Clear all states for a user across all chats
  clearAllUserStates(userId) {
    const keysToDelete = [];
    for (const [chatKey] of this.userStates.entries()) {
      if (chatKey.startsWith(`${userId}:`)) {
        keysToDelete.push(chatKey);
      }
    }
    
    keysToDelete.forEach(key => {
      this.userStates.delete(key);
      logger.info(`User state cleared: ${key}`);
    });
    
    return keysToDelete.length;
  }

  // Get all active states for debugging/monitoring
  getActiveStates() {
    const states = {};
    for (const [chatKey, stateData] of this.userStates.entries()) {
      states[chatKey] = {
        state: stateData.state,
        timestamp: stateData.data.timestamp,
        chatId: stateData.data.chatId,
        userId: stateData.data.userId
      };
    }
    return states;
  }

  // Clean up expired states (older than 30 minutes)
  cleanupExpiredStates() {
    const now = Date.now();
    const expiredThreshold = 30 * 60 * 1000; // 30 minutes
    const expiredKeys = [];
    
    for (const [chatKey, stateData] of this.userStates.entries()) {
      const timestamp = stateData.data.timestamp || 0;
      if (now - timestamp > expiredThreshold) {
        expiredKeys.push(chatKey);
      }
    }
    
    expiredKeys.forEach(key => {
      this.userStates.delete(key);
      logger.info(`Expired state cleaned up: ${key}`);
    });
    
    return expiredKeys.length;
  }
}

module.exports = new LineService();