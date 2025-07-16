// API routes for LIFF integration
const express = require('express');
const router = express.Router();
const imageService = require('../services/ImageService');
const logger = require('../utils/Logger');

// Get images by lot and date for LIFF
router.get('/images/:lot/:date', async (req, res) => {
  try {
    const { lot, date } = req.params;
    
    logger.info(`API Request - Lot: ${lot}, Date: ${date}`);
    
    // Validate parameters
    if (!lot || !date) {
      return res.status(400).json({
        success: false,
        message: 'Missing lot number or date'
      });
    }
    
    // Get images
    const result = await imageService.getImagesByLotAndDate(lot, date);
    
    logger.info(`API Response - Found ${result.images.length} images`);
    
    // Transform URLs to full URLs
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const imagesWithFullUrls = result.images.map(image => ({
      ...image,
      url: image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`,
      thumbnailUrl: image.thumbnailUrl ? 
        (image.thumbnailUrl.startsWith('http') ? image.thumbnailUrl : `${baseUrl}${image.thumbnailUrl}`) : 
        (image.url.startsWith('http') ? image.url : `${baseUrl}${image.url}`)
    }));
    
    res.json({
      success: true,
      lotNumber: result.lotNumber,
      imageDate: result.imageDate,
      images: imagesWithFullUrls,
      count: imagesWithFullUrls.length
    });
    
  } catch (error) {
    logger.error('Error fetching images for LIFF:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching images',
      error: error.message
    });
  }
});

// Delete multiple images
router.post('/images/delete', async (req, res) => {
  try {
    const { userId, imageIds, lotNumber, imageDate } = req.body;
    
    logger.info(`Delete request - User: ${userId}, Images: ${imageIds.length}, Lot: ${lotNumber}`);
    
    // Validate parameters
    if (!userId || !imageIds || imageIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    // Delete each image
    const deleteService = require('../services/DeleteService');
    let deletedCount = 0;
    const errors = [];
    
    for (const imageId of imageIds) {
      try {
        await deleteService.deleteImage(imageId);
        deletedCount++;
        logger.info(`Deleted image ID: ${imageId}`);
      } catch (error) {
        logger.error(`Error deleting image ${imageId}:`, error);
        errors.push({ imageId, error: error.message });
      }
    }
    
    logger.info(`Delete completed - Deleted: ${deletedCount}/${imageIds.length}`);
    
    res.json({
      success: true,
      deletedCount,
      totalRequested: imageIds.length,
      errors
    });
    
  } catch (error) {
    logger.error('Error in batch delete:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting images',
      error: error.message
    });
  }
});

// Get lot information
router.get('/lots/:lot', async (req, res) => {
  try {
    const { lot } = req.params;
    const lotModel = require('../models/LotModel');
    
    const lotInfo = await lotModel.getByLotNumber(lot);
    
    if (!lotInfo) {
      return res.status(404).json({
        success: false,
        message: 'Lot not found'
      });
    }
    
    // Get available dates for this lot
    const datePickerService = require('../services/DatePickerService');
    const availableDates = await datePickerService.getAvailableDatesForLot(lot);
    
    res.json({
      success: true,
      lot: lotInfo,
      availableDates: availableDates
    });
    
  } catch (error) {
    logger.error('Error fetching lot info:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching lot information'
    });
  }
});

module.exports = router;