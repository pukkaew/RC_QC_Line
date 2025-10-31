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
        { name: 'uploadedBy', type: sql.VarChar, value: imageData.uploadedBy }
      ];
      
      const result = await dbService.executeQuery(query, params);
      
      // Log success
      logger.info(`Created image record: ${imageData.fileName} for lot ${imageData.lotId}`);
      
      return result.recordset[0].image_id;
    } catch (error) {
      logger.error('Error creating image record:', error);
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
  // FIXED: Only get images from the latest upload session to avoid mixing images from previous uploads
  async getByLotAndDate(lotId, imageDate) {
    try {
      const query = `
        -- First, find the latest upload session for this lot and date
        WITH LatestSession AS (
          SELECT MAX(upload_session_id) as latest_session_id
          FROM Images i
          WHERE i.lot_id = @lotId
            AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
            AND i.status = 'active'
            AND i.upload_session_id IS NOT NULL
        )
        -- Then select only images from the latest session
        SELECT i.*, l.lot_number
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        LEFT JOIN LatestSession ls ON 1=1
        WHERE i.lot_id = @lotId
          AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
          AND i.status = 'active'
          AND (
            -- If there are sessions, only get images from the latest session
            (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
            OR
            -- If no sessions exist (old data), get all images without session_id
            (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
          )
        ORDER BY
          -- First, check if filename has our order pattern (timestamp_sessionId_order_uuid.ext)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN 0
            ELSE 1
          END,
          -- Extract sessionId (second segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            THEN SUBSTRING(
              file_name,
              CHARINDEX('_', file_name) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - CHARINDEX('_', file_name) - 1
            )
            ELSE '999999999999999'
          END,
          -- Extract order number (third segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN SUBSTRING(
              file_name,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) - CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - 1
            )
            ELSE '9999'
          END,
          -- Fall back to uploaded_at for old images
          i.uploaded_at
      `;

      const params = [
        { name: 'lotId', type: sql.Int, value: lotId },
        { name: 'imageDate', type: sql.Date, value: imageDate }
      ];

      const result = await dbService.executeQuery(query, params);

      // Log query result with session info
      logger.info(`Found ${result.recordset.length} images for lot ID ${lotId} on date ${imageDate} (latest session only)`);

      return result.recordset;
    } catch (error) {
      logger.error('Error getting images by lot and date:', error);
      throw error;
    }
  }

  // Get images by lot number and date - ORDER BY file_name which contains order
  // FIXED: Only get images from the latest upload session to avoid mixing images from previous uploads
  async getByLotNumberAndDate(lotNumber, imageDate) {
    try {
      const query = `
        -- First, find the latest upload session for this lot and date
        WITH LatestSession AS (
          SELECT MAX(upload_session_id) as latest_session_id
          FROM Images i
          JOIN Lots l ON i.lot_id = l.lot_id
          WHERE l.lot_number = @lotNumber
            AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
            AND i.status = 'active'
            AND i.upload_session_id IS NOT NULL
        )
        -- Then select only images from the latest session
        SELECT i.*, l.lot_number
        FROM Images i
        JOIN Lots l ON i.lot_id = l.lot_id
        LEFT JOIN LatestSession ls ON 1=1
        WHERE l.lot_number = @lotNumber
          AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
          AND i.status = 'active'
          AND (
            -- If there are sessions, only get images from the latest session
            (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
            OR
            -- If no sessions exist (old data), get all images without session_id
            (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
          )
        ORDER BY
          -- First, check if filename has our order pattern (timestamp_sessionId_order_uuid.ext)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN 0
            ELSE 1
          END,
          -- Extract sessionId (second segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            THEN SUBSTRING(
              file_name,
              CHARINDEX('_', file_name) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - CHARINDEX('_', file_name) - 1
            )
            ELSE '999999999999999'
          END,
          -- Extract order number (third segment)
          CASE
            WHEN CHARINDEX('_', file_name) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) > 0
            AND CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) > 0
            THEN SUBSTRING(
              file_name,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1,
              CHARINDEX('_', file_name, CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) + 1) - CHARINDEX('_', file_name, CHARINDEX('_', file_name) + 1) - 1
            )
            ELSE '9999'
          END,
          -- Fall back to uploaded_at for old images
          i.uploaded_at
      `;

      const params = [
        { name: 'lotNumber', type: sql.VarChar, value: lotNumber },
        { name: 'imageDate', type: sql.Date, value: imageDate }
      ];

      const result = await dbService.executeQuery(query, params);

      // Log query result with session info
      logger.info(`Found ${result.recordset.length} images for lot ${lotNumber} on date ${imageDate} (latest session only)`);

      // Debug: Log first few filenames to check ordering and session
      if (result.recordset.length > 0) {
        const firstImage = result.recordset[0];
        logger.info(`Session ID: ${firstImage.upload_session_id || 'N/A (old data)'}`);
        logger.info(`First 3 filenames in order:`);
        result.recordset.slice(0, 3).forEach((img, idx) => {
          logger.info(`  ${idx + 1}. ${img.file_name} (session: ${img.upload_session_id || 'N/A'})`);
        });
      }

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