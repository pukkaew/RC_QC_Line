// User model for managing user information
const sql = require('mssql');
const dbService = require('../services/DatabaseService');
const logger = require('../utils/Logger');

class UserModel {
  // Get user by LINE user ID
  async getByLineUserId(lineUserId) {
    try {
      const query = `
        SELECT * FROM Users
        WHERE line_user_id = @lineUserId
      `;
      
      const params = [
        { name: 'lineUserId', type: sql.VarChar, value: lineUserId }
      ];
      
      const result = await dbService.executeQuery(query, params);
      return result.recordset[0];
    } catch (error) {
      logger.error('Error getting user by LINE user ID:', error);
      throw error;
    }
  }

  // Create a new user
  async create(userData) {
    try {
      const query = `
        INSERT INTO Users (
          line_user_id,
          username,
          role,
          status,
          created_at,
          last_access
        )
        VALUES (
          @lineUserId,
          @username,
          @role,
          'active',
          GETDATE(),
          GETDATE()
        )
        
        SELECT SCOPE_IDENTITY() AS user_id
      `;
      
      const params = [
        { name: 'lineUserId', type: sql.VarChar, value: userData.lineUserId },
        { name: 'username', type: sql.VarChar, value: userData.username || userData.lineUserId },
        { name: 'role', type: sql.VarChar, value: userData.role || 'user' }
      ];
      
      const result = await dbService.executeQuery(query, params);
      return result.recordset[0].user_id;
    } catch (error) {
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  // Get or create a user by LINE user ID
  async getOrCreate(lineUserId, username = null) {
    try {
      let user = await this.getByLineUserId(lineUserId);
      
      if (!user) {
        const userData = {
          lineUserId,
          username: username || lineUserId,
          role: 'user'
        };
        
        const userId = await this.create(userData);
        user = {
          user_id: userId,
          line_user_id: lineUserId,
          username: userData.username,
          role: userData.role,
          status: 'active'
        };
      }
      
      // Update last access time
      await this.updateLastAccess(user.user_id);
      
      return user;
    } catch (error) {
      logger.error('Error in getOrCreate user:', error);
      throw error;
    }
  }

  // Update user's last access time
  async updateLastAccess(userId) {
    try {
      const query = `
        UPDATE Users
        SET last_access = GETDATE()
        WHERE user_id = @userId
      `;
      
      const params = [
        { name: 'userId', type: sql.Int, value: userId }
      ];
      
      await dbService.executeQuery(query, params);
      return true;
    } catch (error) {
      logger.error('Error updating user last access:', error);
      throw error;
    }
  }

  // Update user role
  async updateRole(userId, role) {
    try {
      const query = `
        UPDATE Users
        SET role = @role
        WHERE user_id = @userId
      `;
      
      const params = [
        { name: 'userId', type: sql.Int, value: userId },
        { name: 'role', type: sql.VarChar, value: role }
      ];
      
      await dbService.executeQuery(query, params);
      return true;
    } catch (error) {
      logger.error('Error updating user role:', error);
      throw error;
    }
  }

  // Update user status
  async updateStatus(userId, status) {
    try {
      const query = `
        UPDATE Users
        SET status = @status
        WHERE user_id = @userId
      `;
      
      const params = [
        { name: 'userId', type: sql.Int, value: userId },
        { name: 'status', type: sql.VarChar, value: status }
      ];
      
      await dbService.executeQuery(query, params);
      return true;
    } catch (error) {
      logger.error('Error updating user status:', error);
      throw error;
    }
  }
}

module.exports = new UserModel();