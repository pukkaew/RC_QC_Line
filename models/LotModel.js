// Lot model for managing product lot information
const sql = require('mssql');
const dbService = require('../services/DatabaseService');
const logger = require('../utils/Logger');

class LotModel {
  // Get a lot by lot number
  async getByLotNumber(lotNumber) {
    try {
      const query = `
        SELECT * FROM Lots
        WHERE lot_number = @lotNumber
      `;
      
      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: lotNumber }
      ];
      
      const result = await dbService.executeQuery(query, params);
      return result.recordset[0];
    } catch (error) {
      logger.error('Error getting lot by number:', error);
      throw error;
    }
  }

  // Create a new lot
  async create(lotNumber) {
    try {
      const query = `
        INSERT INTO Lots (lot_number, created_at, updated_at, status)
        VALUES (@lotNumber, GETDATE(), GETDATE(), 'active')
        
        SELECT SCOPE_IDENTITY() AS lot_id
      `;
      
      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: lotNumber }
      ];
      
      const result = await dbService.executeQuery(query, params);
      return result.recordset[0].lot_id;
    } catch (error) {
      logger.error('Error creating lot:', error);
      throw error;
    }
  }

  // Get or create a lot by lot number
  async getOrCreate(lotNumber) {
    try {
      let lot = await this.getByLotNumber(lotNumber);
      
      if (!lot) {
        const lotId = await this.create(lotNumber);
        lot = {
          lot_id: lotId,
          lot_number: lotNumber
        };
      }
      
      return lot;
    } catch (error) {
      logger.error('Error in getOrCreate lot:', error);
      throw error;
    }
  }

  // Update a lot status
  async updateStatus(lotId, status) {
    try {
      const query = `
        UPDATE Lots
        SET status = @status, updated_at = GETDATE()
        WHERE lot_id = @lotId
      `;
      
      const params = [
        { name: 'lotId', type: sql.Int, value: lotId },
        { name: 'status', type: sql.VarChar, value: status }
      ];
      
      await dbService.executeQuery(query, params);
      return true;
    } catch (error) {
      logger.error('Error updating lot status:', error);
      throw error;
    }
  }

  // Get all lots
  async getAll() {
    try {
      const query = `
        SELECT * FROM Lots
        ORDER BY created_at DESC
      `;
      
      const result = await dbService.executeQuery(query);
      return result.recordset;
    } catch (error) {
      logger.error('Error getting all lots:', error);
      throw error;
    }
  }
}

module.exports = new LotModel();