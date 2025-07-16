// Path: RC_QC_Line/utils/ImageCompressor.js
// Utils for image compression with order preservation
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('./Logger');
const appConfig = require('../config/app');

class ImageCompressor {
  constructor() {
    this.uploadPath = appConfig.upload.path;
    this.ensureUploadDirectory();
    
    // Configure Sharp for better performance
    sharp.cache(false);
    sharp.concurrency(1);
  }

  // Ensure the upload directory exists
  ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      logger.info(`Created upload directory: ${this.uploadPath}`);
    }
  }

  // Generate a unique filename preserving order info
  generateFilename(originalFilename) {
    const extension = path.extname(originalFilename) || '.jpg';
    
    // Check if filename already has order info (img_sessionId_order.jpg)
    const orderMatch = originalFilename.match(/img_(\d+)_(\d{4})/);
    if (orderMatch) {
      // Keep the session and order info in the new filename
      const sessionId = orderMatch[1];
      const order = orderMatch[2];
      const timestamp = Date.now();
      const uuid = uuidv4().slice(0, 8);
      return `${timestamp}_${sessionId}_${order}_${uuid}${extension}`;
    }
    
    // Default filename generation for non-ordered images
    const timestamp = Date.now();
    const uuid = uuidv4().slice(0, 8);
    return `${timestamp}-${uuid}${extension}`;
  }

  // Compress an image and save it to disk
  async compressImage(imageBuffer, originalFilename, options = {}) {
    try {
      // Check if buffer is valid
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Invalid or empty image buffer');
      }
      
      const filename = this.generateFilename(originalFilename);
      const outputPath = path.join(this.uploadPath, filename);
      
      // Get original image info
      let imageInfo;
      try {
        imageInfo = await sharp(imageBuffer).metadata();
      } catch (metadataError) {
        logger.error('Error getting image metadata:', metadataError);
        throw new Error(`Invalid image format: ${metadataError.message}`);
      }
      
      const originalSize = imageBuffer.length;
      
      // Determine compression options
      const compressionOptions = {
        quality: options.quality || 80,
        width: options.width || null,
        height: options.height || null,
        fit: options.fit || 'inside',
        // Add a maximum dimension to prevent extremely large images
        maxDimension: 2048
      };
      
      // Create sharp instance with better error handling
      let sharpInstance = sharp(imageBuffer, {
        failOnError: false,
        limitInputPixels: 50000000 // Increase pixel limit for larger images
      });
      
      // Add image rotation based on EXIF data
      sharpInstance = sharpInstance.rotate();
      
      // Resize if width or height is provided or if image is too large
      const needsResize = compressionOptions.width || 
                          compressionOptions.height || 
                          (imageInfo.width > compressionOptions.maxDimension) ||
                          (imageInfo.height > compressionOptions.maxDimension);
      
      if (needsResize) {
        let resizeWidth = compressionOptions.width;
        let resizeHeight = compressionOptions.height;
        
        // If image is too large, resize it proportionally
        if ((imageInfo.width > compressionOptions.maxDimension) ||
            (imageInfo.height > compressionOptions.maxDimension)) {
          if (imageInfo.width > imageInfo.height) {
            resizeWidth = Math.min(compressionOptions.maxDimension, imageInfo.width);
            resizeHeight = Math.round((resizeWidth / imageInfo.width) * imageInfo.height);
          } else {
            resizeHeight = Math.min(compressionOptions.maxDimension, imageInfo.height);
            resizeWidth = Math.round((resizeHeight / imageInfo.height) * imageInfo.width);
          }
        }
        
        sharpInstance = sharpInstance.resize(
          resizeWidth,
          resizeHeight,
          { fit: compressionOptions.fit }
        );
      }
      
      // Apply compression based on image format
      let outputBuffer;
      const format = path.extname(originalFilename).toLowerCase();
      
      try {
        if (format === '.png') {
          outputBuffer = await sharpInstance
            .png({ quality: compressionOptions.quality })
            .toBuffer();
        } else {
          // Default to JPEG for other formats (better compression)
          outputBuffer = await sharpInstance
            .jpeg({ quality: compressionOptions.quality, mozjpeg: true })
            .toBuffer();
        }
      } catch (compressionError) {
        logger.error('Error during image compression:', compressionError);
        throw new Error(`Failed to compress image: ${compressionError.message}`);
      }
      
      // Save the compressed image
      try {
        await fs.promises.writeFile(outputPath, outputBuffer);
      } catch (writeError) {
        logger.error('Error writing image to disk:', writeError);
        throw new Error(`Failed to save image: ${writeError.message}`);
      }
      
      // Get compressed size
      const compressedSize = outputBuffer.length;
      
      // Get final image info
      const finalImageInfo = await sharp(outputBuffer).metadata();
      
      // Prepare result
      const result = {
        originalFilename: originalFilename,
        filename: filename,
        filePath: outputPath,
        originalSize: originalSize,
        compressedSize: compressedSize,
        compressionRatio: (originalSize / compressedSize).toFixed(2),
        width: finalImageInfo.width,
        height: finalImageInfo.height,
        format: finalImageInfo.format,
        url: `/uploads/${filename}`
      };
      
      logger.info(`Image compressed: ${originalFilename} -> ${filename}`, {
        originalSize,
        compressedSize,
        compressionRatio: result.compressionRatio,
        orderInfo: filename.includes('_') ? 'preserved' : 'none'
      });
      
      return result;
    } catch (error) {
      logger.error('Error compressing image:', error);
      throw error;
    }
  }

  // Delete an image file
  async deleteImage(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        logger.info(`Image deleted: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting image ${filePath}:`, error);
      throw error;
    }
  }
}

module.exports = new ImageCompressor();