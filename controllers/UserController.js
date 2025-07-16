// Path: RC_QC_Line/controllers/UserController.js
// Controller for user management
const lineService = require('../services/LineService');
const userModel = require('../models/UserModel');
const logger = require('../utils/Logger');
const { asyncHandler, AppError } = require('../utils/ErrorHandler');

class UserController {
  // Register a new user or update existing user
  async registerUser(userId) {
    try {
      // Get user profile from LINE
      const profile = await lineService.getUserProfile(userId);
      
      // Register or update user in database
      const user = await userModel.getOrCreate(userId, profile.displayName);
      
      logger.info(`User registered/updated: ${profile.displayName} (${userId})`);
      
      return user;
    } catch (error) {
      logger.error('Error registering user:', error);
      
      // Try to create basic user without profile info
      try {
        // Use userId as display name if profile is not available
        const user = await userModel.getOrCreate(userId, `User_${userId.substring(0, 8)}`);
        logger.info(`Basic user created: ${userId}`);
        return user;
      } catch (fallbackError) {
        logger.error('Error creating basic user:', fallbackError);
        throw fallbackError;
      }
    }
  }

  // Deactivate a user (when unfollowed)
  async deactivateUser(userId) {
    try {
      // Get user
      const user = await userModel.getByLineUserId(userId);
      
      if (!user) {
        logger.warn(`Attempted to deactivate non-existent user: ${userId}`);
        return false;
      }
      
      // Update user status
      await userModel.updateStatus(user.user_id, 'inactive');
      
      logger.info(`User deactivated: ${userId}`);
      
      return true;
    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  // Get user by LINE user ID
  async getUserByLineId(userId) {
    try {
      return await userModel.getByLineUserId(userId);
    } catch (error) {
      logger.error('Error getting user by LINE ID:', error);
      throw error;
    }
  }

  // Update user role
  async updateUserRole(userId, role) {
    try {
      // Get user
      const user = await userModel.getByLineUserId(userId);
      
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      // Update role
      await userModel.updateRole(user.user_id, role);
      
      logger.info(`User role updated: ${userId} -> ${role}`);
      
      return true;
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }
}

module.exports = new UserController();