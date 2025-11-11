// Path: RC_QC_Line/models/ImageModel.js
// Model for managing product images with proper ordering
const sql = require('mssql');
const dbService = require('../services/DatabaseService');
const logger = require('../utils/Logger');

class ImageModel {
  // Create a new image record
  async create(imageData) {
    try {
      const query = `
        INSERT INTO Images (
          lot_id,
          image_date,
          file_name,
          file_path,
          original_size,
          compressed_size,
          mime_type,
          uploaded_by,
          uploaded_at,
          upload_session_id,
          status
        )
        VALUES (
          @lotId,
          @imageDate,
          @fileName,
          @filePath,
          @originalSize,
          @compressedSize,
          @mimeType,
          @uploadedBy,
          GETDATE(),
          @uploadSessionId,
          'active'
        )

        SELECT SCOPE_IDENTITY() AS image_id
      `;

      const params = [
        { name: 'lotId', type: sql.Int, value: imageData.lotId },
        { name: 'imageDate', type: sql.Date, value: imageData.imageDate },
        { name: 'fileName', type: sql.VarChar, value: imageData.fileName },
        { name: 'filePath', type: sql.VarChar, value: imageData.filePath },
        { name: 'originalSize', type: sql.Int, value: imageData.originalSize },
        { name: 'compressedSize', type: sql.Int, value: imageData.compressedSize },
        { name: 'mimeType', type: sql.VarChar, value: imageData.mimeType },
        { name: 'uploadedBy', type: sql.VarChar, value: imageData.uploadedBy },
        { name: 'uploadSessionId', type: sql.BigInt, value: imageData.uploadSessionId || null }
      ];
      
      const result = await dbService.executeQuery(query, params);

      // Log success with details
      logger.info(`[DB SUCCESS] Created image record: ${imageData.fileName} for lot ${imageData.lotId}, session: ${imageData.uploadSessionId || 'N/A'}`);
      
      return result.recordset[0].image_id;
    } catch (error) {
      logger.error(`[DB ERROR] Failed to create image record: ${imageData.fileName}`, {
        fileName: imageData.fileName,
        lotId: imageData.lotId,
        sessionId: imageData.uploadSessionId,
        errorMessage: error.message,
        errorCode: error.code,
        errorNumber: error.number
      });
      throw error;
    }
  }

  // Create multiple image records in a transaction
  async createMultiple(imagesData) {
    try {
      return await dbService.transaction(async (transaction) => {
        const imageIds = [];

        for (const imageData of imagesData) {
          const request = transaction.request();

          request.input('lotId', sql.Int, imageData.lotId);
          request.input('imageDate', sql.Date, imageData.imageDate);
          request.input('fileName', sql.VarChar, imageData.fileName);
          request.input('filePath', sql.VarChar, imageData.filePath);
          request.input('originalSize', sql.Int, imageData.originalSize);
          request.input('compressedSize', sql.Int, imageData.compressedSize);
          request.input('mimeType', sql.VarChar, imageData.mimeType);
          request.input('uploadedBy', sql.VarChar, imageData.uploadedBy);
          request.input('uploadSessionId', sql.BigInt, imageData.uploadSessionId || null);

          const query = `
            INSERT INTO Images (
              lot_id,
              image_date,
              file_name,
              file_path,
              original_size,
              compressed_size,
              mime_type,
              uploaded_by,
              uploaded_at,
              upload_session_id,
              status
            )
            VALUES (
              @lotId,
              @imageDate,
              @fileName,
              @filePath,
              @originalSize,
              @compressedSize,
              @mimeType,
              @uploadedBy,
              GETDATE(),
              @uploadSessionId,
              'active'
            )

            SELECT SCOPE_IDENTITY() AS image_id
          `;

          const result = await request.query(query);
          imageIds.push(result.recordset[0].image_id);
        }
        
        // Log success
        logger.info(`Created ${imageIds.length} image records in batch`);
        
        return imageIds;
      });
    } catch (error) {
      logger.error('Error creating multiple image records:', error);
      throw error;
    }
  }

  // Get images by lot ID and date - ORDER BY file_name which contains order
  // Show ALL active images for the date, ordered by session and order number
  async getByLotAndDate(lotId, imageDate) {
    try {
      const query = `
        SELECT i.*, l.lot_number
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE i.lot_id = @lotId
          AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
          AND i.status = 'active'
        ORDER BY
          -- First, sort by session ID (NULL first, then ascending)
          CASE WHEN i.upload_session_id IS NULL THEN 0 ELSE 1 END,
          i.upload_session_id ASC,
          -- Then check if filename has our order pattern (timestamp_sessionId_order_uuid.ext)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN 0
            ELSE 1
          END,
          -- Extract order number (third segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN CAST(SUBSTRING(
              file_name,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) - CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - 1
            ) AS INT)
            ELSE 9999
          END,
          -- Fall back to uploaded_at for old images
          i.uploaded_at
      `;
      
      const params = [
        { name: 'lotId', type: sql.Int, value: lotId },
        { name: 'imageDate', type: sql.Date, value: imageDate }
      ];
      
      const result = await dbService.executeQuery(query, params);

      // Log query result
      logger.info(`Found ${result.recordset.length} images for lot ID ${lotId} on date ${imageDate}`);

      return result.recordset;
    } catch (error) {
      logger.error('Error getting images by lot and date:', error);
      throw error;
    }
  }

  // Get images by lot number and date - ORDER BY file_name which contains order
  // Show ALL active images for the date, ordered by session and order number
  async getByLotNumberAndDate(lotNumber, imageDate) {
    try {
      const query = `
        SELECT i.*, l.lot_number
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE l.lot_number = @lotNumber
          AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
          AND i.status = 'active'
        ORDER BY
          -- First, sort by session ID (NULL first, then ascending)
          CASE WHEN i.upload_session_id IS NULL THEN 0 ELSE 1 END,
          i.upload_session_id ASC,
          -- Then check if filename has our order pattern (timestamp_sessionId_order_uuid.ext)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN 0
            ELSE 1
          END,
          -- Extract order number (third segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN CAST(SUBSTRING(
              file_name,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) - CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - 1
            ) AS INT)
            ELSE 9999
          END,
          -- Fall back to uploaded_at for old images
          i.uploaded_at
      `;
      
      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: lotNumber },
        { name: 'imageDate', type: sql.Date, value: imageDate }
      ];
      
      const result = await dbService.executeQuery(query, params);

      // Log query result
      logger.info(`Found ${result.recordset.length} images for lot ${lotNumber} on date ${imageDate}`);

      return result.recordset;
    } catch (error) {
      logger.error('Error getting images by lot number and date:', error);
      throw error;
    }
  }

  // Get an image by ID
  async getById(imageId) {
    try {
      const query = `
        SELECT i.*, l.lot_number
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        WHERE i.image_id = @imageId
          AND i.status = 'active'
      `;
      
      const params = [
        { name: 'imageId', type: sql.Int, value: imageId }
      ];
      
      const result = await dbService.executeQuery(query, params);
      return result.recordset;
    } catch (error) {
      logger.error('Error getting image by ID:', error);
      throw error;
    }
  }

  // Update image status
  async updateStatus(imageId, status) {
    try {
      const query = `
        UPDATE Images
        SET status = @status
        WHERE image_id = @imageId
      `;
      
      const params = [
        { name: 'imageId', type: sql.Int, value: imageId },
        { name: 'status', type: sql.VarChar, value: status }
      ];
      
      await dbService.executeQuery(query, params);
      
      // Log update
      logger.info(`Updated image ${imageId} status to ${status}`);
      
      return true;
    } catch (error) {
      logger.error('Error updating image status:', error);
      throw error;
    }
  }

  // Delete an image (soft delete by setting status to 'deleted')
  async delete(imageId) {
    return this.updateStatus(imageId, 'deleted');
  }
}

module.exports = new ImageModel();