// Path: RC_QC_Line/services/ImageService.js
// Service for image processing and management with order support
const path = require('path');
const fs = require('fs');
const imageCompressor = require('../utils/ImageCompressor');
const imageModel = require('../models/ImageModel');
const lotModel = require('../models/LotModel');
const logger = require('../utils/Logger');
const { AppError } = require('../utils/ErrorHandler');
const appConfig = require('../config/app');

class ImageService {
  constructor() {
    this.imageCompressor = imageCompressor;
    this.maxImagesPerMessage = appConfig.limits.maxImagesPerMessage;
  }

  // Process and save uploaded images (supports unlimited images with progress tracking)
  async processImages(files, lotNumber, imageDate, uploadedBy, sessionId = null) {
    try {
      if (!files || files.length === 0) {
        throw new AppError('No files provided', 400);
      }

      const totalFiles = files.length;
      logger.info(`Starting to process ${totalFiles} images for Lot: ${lotNumber}, Session: ${sessionId}`);

      // Get or create lot record
      const lot = await lotModel.getOrCreate(lotNumber);

      // Process each image with better error handling and progress tracking
      const processedImages = [];
      const errors = [];
      const batchSize = 5; // Process images in batches to prevent memory issues
      
      // Process images in batches for better performance with large uploads
      for (let batchStart = 0; batchStart < totalFiles; batchStart += batchSize) {
        const batchEnd = Math.min(batchStart + batchSize, totalFiles);
        const currentBatch = files.slice(batchStart, batchEnd);
        
        logger.info(`Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(totalFiles / batchSize)} (images ${batchStart + 1}-${batchEnd})`);
        
        // Process current batch
        for (let i = 0; i < currentBatch.length; i++) {
          const file = currentBatch[i];
          const globalIndex = batchStart + i;
          
          try {
            // Ensure we have a buffer
            if (!file.buffer || file.buffer.length === 0) {
              errors.push(`File ${globalIndex + 1}: Missing or empty buffer`);
              continue;
            }
            
            // Log the file being processed
            logger.info(`Processing file ${globalIndex + 1}/${totalFiles}: ${file.originalname}, size: ${file.buffer.length} bytes`);

            // Compress the image
            const compressedImage = await this.imageCompressor.compressImage(
              file.buffer,
              file.originalname,
              { quality: 80 }
            );
            
            // Create image data object
            const imageData = {
              lotId: lot.lot_id,
              imageDate: new Date(imageDate),
              fileName: compressedImage.filename,
              filePath: compressedImage.filePath,
              originalSize: compressedImage.originalSize,
              compressedSize: compressedImage.compressedSize,
              mimeType: file.mimetype,
              uploadedBy: uploadedBy,
              uploadSessionId: sessionId  // Add session ID
            };

            // Create image record in database
            const imageId = await imageModel.create(imageData);
            
            // Add to processed images
            processedImages.push({
              id: imageId,
              ...imageData,
              ...compressedImage
            });
            
            logger.info(`Successfully processed file ${globalIndex + 1}/${totalFiles}: ${compressedImage.filename}`);
          } catch (error) {
            const errorMsg = `Error processing file ${globalIndex + 1}: ${error.message}`;
            logger.error(errorMsg, error);
            errors.push(errorMsg);
          }
        }
        
        // Add small delay between batches for large uploads to prevent overwhelming the system
        if (totalFiles > 20 && batchEnd < totalFiles) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Log summary
      logger.info(`Processed ${processedImages.length} of ${totalFiles} images successfully for Lot: ${lotNumber}`);
      if (errors.length > 0) {
        logger.warn(`Encountered ${errors.length} errors during processing: ${errors.join('; ')}`);
      }
      
      return {
        lot,
        images: processedImages,
        errors: errors,
        totalFiles: totalFiles,
        successfulFiles: processedImages.length
      };
    } catch (error) {
      logger.error('Error processing images:', error);
      throw error;
    }
  }

  // Helper method to extract order from filename
  extractOrderFromFilename(filename) {
    // Pattern: timestamp_sessionId_order_uuid.jpg
    const match = filename.match(/_(\d+)_(\d{4})_/);
    if (match) {
      return {
        sessionId: parseInt(match[1]),
        order: parseInt(match[2])
      };
    }
    return null;
  }

  // Sort images by their upload order
  sortImagesByOrder(images) {
    return images.sort((a, b) => {
      const orderA = this.extractOrderFromFilename(a.file_name);
      const orderB = this.extractOrderFromFilename(b.file_name);
      
      // Both have order info - sort by session then order
      if (orderA && orderB) {
        if (orderA.sessionId === orderB.sessionId) {
          return orderA.order - orderB.order;
        }
        return orderA.sessionId - orderB.sessionId;
      }
      
      // Only A has order info - A comes first
      if (orderA && !orderB) return -1;
      
      // Only B has order info - B comes first
      if (!orderA && orderB) return 1;
      
      // Neither has order info - sort by uploaded_at
      return new Date(a.uploaded_at) - new Date(b.uploaded_at);
    });
  }

  // Get images by lot number and date (optimized for large result sets)
  async getImagesByLotAndDate(lotNumber, imageDate) {
    try {
      // Enhanced logging for debugging
      logger.info(`Searching for images - Lot: ${lotNumber}, Date: ${imageDate}`);
      
      // Get images from database
      const images = await imageModel.getByLotNumberAndDate(lotNumber, imageDate);
      
      // Enhanced logging
      logger.info(`Found ${images ? images.length : 0} images for lot ${lotNumber} on date ${imageDate}`);
      
      if (!images || images.length === 0) {
        // Debug: Check if lot exists at all
        const lot = await lotModel.getByLotNumber(lotNumber);
        if (!lot) {
          logger.warn(`Lot ${lotNumber} does not exist in database`);
        } else {
          logger.info(`Lot ${lotNumber} exists (ID: ${lot.lot_id}) but no images found for date ${imageDate}`);
          
          // Debug: Check what dates have images for this lot
          await this.debugLotImageDates(lotNumber, lot.lot_id);
        }
        
        return {
          lotNumber,
          imageDate,
          images: []
        };
      }
      
      // Sort images by order
      const sortedImages = this.sortImagesByOrder(images);
      
      // Convert file paths to URLs
      const imagesWithUrls = sortedImages.map((image, index) => {
        const filename = path.basename(image.file_path);
        return {
          ...image,
          url: `/uploads/${filename}`,
          displayOrder: index + 1 // Add display order for UI
        };
      });
      
      // Log order info
      logger.info(`Images sorted. First few filenames: ${imagesWithUrls.slice(0, 3).map(img => img.file_name).join(', ')}`);
      
      // Log info for large result sets
      if (imagesWithUrls.length > 50) {
        logger.info(`Retrieved ${imagesWithUrls.length} images for Lot: ${lotNumber}, Date: ${imageDate}`);
      }
      
      // Group images for LINE sending (not used in new Flex Message format, but kept for compatibility)
      const groupedImages = this.groupImagesForSending(imagesWithUrls);
      
      return {
        lotNumber,
        imageDate,
        images: imagesWithUrls,
        groupedImages
      };
    } catch (error) {
      logger.error('Error getting images by lot and date:', error);
      throw error;
    }
  }

  // Debug helper: Check what dates have images for a lot
  async debugLotImageDates(lotNumber, lotId) {
    try {
      const query = `
        SELECT DISTINCT CONVERT(DATE, image_date) as date, COUNT(*) as count
        FROM Images
        WHERE lot_id = @lotId AND status = 'active'
        GROUP BY CONVERT(DATE, image_date)
        ORDER BY date DESC
      `;
      
      const params = [
        { name: 'lotId', type: require('mssql').Int, value: lotId }
      ];
      
      const result = await require('./DatabaseService').executeQuery(query, params);
      
      if (result.recordset.length > 0) {
        logger.info(`Available dates for Lot ${lotNumber}:`);
        result.recordset.forEach(row => {
          const dateStr = new Date(row.date).toISOString().split('T')[0];
          logger.info(`  - ${dateStr}: ${row.count} images`);
        });
      } else {
        logger.info(`No images found for Lot ${lotNumber} on any date`);
      }
    } catch (error) {
      logger.error('Error debugging lot image dates:', error);
    }
  }

  // Group images for sending in LINE messages (max 5 per message) - kept for compatibility
  groupImagesForSending(images) {
    const groups = [];
    const totalImages = images.length;
    
    for (let i = 0; i < totalImages; i += this.maxImagesPerMessage) {
      groups.push(images.slice(i, i + this.maxImagesPerMessage));
    }
    
    return groups;
  }

  // Delete an image
  async deleteImage(imageId) {
    try {
      // Get image record
      const query = `
        SELECT * FROM Images
        WHERE image_id = @imageId
      `;
      
      const params = [
        { name: 'imageId', type: require('mssql').Int, value: imageId }
      ];
      
      const result = await require('./DatabaseService').executeQuery(query, params);
      
      if (!result.recordset || result.recordset.length === 0) {
        throw new AppError('Image not found', 404);
      }
      
      const image = result.recordset[0];
      
      // Delete file from disk
      await this.imageCompressor.deleteImage(image.file_path);
      
      // Update image status in database
      await imageModel.delete(imageId);
      
      return true;
    } catch (error) {
      logger.error('Error deleting image:', error);
      throw error;
    }
  }
}

module.exports = new ImageService();