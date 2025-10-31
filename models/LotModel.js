// Lot model for managing product lot information
const sql = require('mssql');
const dbService = require('../services/DatabaseService');
const logger = require('../utils/Logger');

class LotModel {
  // Get a lot by lot number
  async getByLotNumber(lotNumber) {
    try {
      // CRITICAL: Always trim lot_number to prevent duplicates
      const trimmedLotNumber = (lotNumber || '').trim();

      if (!trimmedLotNumber) {
        throw new Error('Lot number cannot be empty');
      }

      const query = `
        SELECT * FROM Lots
        WHERE LTRIM(RTRIM(lot_number)) = @lotNumber
      `;

      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: trimmedLotNumber }
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
      // CRITICAL: Always trim lot_number to prevent duplicates
      const trimmedLotNumber = (lotNumber || '').trim();

      if (!trimmedLotNumber) {
        throw new Error('Lot number cannot be empty');
      }

      // Log for debugging
      logger.info(`Creating new lot: "${trimmedLotNumber}"`);

      const query = `
        INSERT INTO Lots (lot_number, created_at, updated_at, status)
        VALUES (@lotNumber, GETDATE(), GETDATE(), 'active')

        SELECT SCOPE_IDENTITY() AS lot_id
      `;

      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: trimmedLotNumber }
      ];

      const result = await dbService.executeQuery(query, params);
      const lotId = result.recordset[0].lot_id;

      logger.info(`Created lot "${trimmedLotNumber}" with ID: ${lotId}`);

      return lotId;
    } catch (error) {
      logger.error(`Error creating lot "${lotNumber}":`, error);
      throw error;
    }
  }

  // Get or create a lot by lot number
  async getOrCreate(lotNumber) {
    try {
      // CRITICAL: Always trim lot_number
      const trimmedLotNumber = (lotNumber || '').trim();

      if (!trimmedLotNumber) {
        throw new Error('Lot number cannot be empty');
      }

      // Log for debugging
      logger.info(`Getting or creating lot: "${trimmedLotNumber}"`);

      let lot = await this.getByLotNumber(trimmedLotNumber);

      if (!lot) {
        logger.info(`Lot "${trimmedLotNumber}" not found, creating new lot`);
        const lotId = await this.create(trimmedLotNumber);
        lot = {
          lot_id: lotId,
          lot_number: trimmedLotNumber
        };
      } else {
        logger.info(`Found existing lot "${trimmedLotNumber}" with ID: ${lot.lot_id}`);
      }

      return lot;
    } catch (error) {
      logger.error(`Error in getOrCreate lot "${lotNumber}":`, error);
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