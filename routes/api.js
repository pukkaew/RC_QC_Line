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

    // Debug: Log first 5 images with lot_id to verify correct filtering
    if (result.images.length > 0) {
      const debugImages = result.images.slice(0, 5).map(img => ({
        image_id: img.image_id,
        lot_id: img.lot_id,
        lot_number: img.lot_number,
        file_name: img.file_name
      }));
      logger.info(`API Debug - First 5 images:`, JSON.stringify(debugImages));
    }
    
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

// Debug: Check images for a lot directly from database
router.get('/debug/images/:lot/:date', async (req, res) => {
  try {
    const { lot, date } = req.params;
    const sql = require('mssql');
    const dbService = require('../services/DatabaseService');

    // Get lot info
    const lotQuery = `SELECT * FROM Lots WHERE lot_number = @lotNumber`;
    const lotParams = [{ name: 'lotNumber', type: sql.VarChar, value: lot }];
    const lotResult = await dbService.executeQuery(lotQuery, lotParams);

    if (!lotResult.recordset || lotResult.recordset.length === 0) {
      return res.json({ success: false, message: 'Lot not found', lot });
    }

    const lotInfo = lotResult.recordset[0];

    // Get all images for this lot_id and date
    const imageQuery = `
      SELECT i.image_id, i.lot_id, i.file_name, i.image_date, i.upload_session_id, i.status,
             l.lot_number, l.lot_id as lot_table_id
      FROM Images i
      JOIN Lots l ON i.lot_id = l.lot_id
      WHERE i.lot_id = @lotId
        AND CONVERT(DATE, i.image_date) = CONVERT(DATE, @imageDate)
        AND i.status = 'active'
      ORDER BY i.image_id
    `;
    const imageParams = [
      { name: 'lotId', type: sql.Int, value: lotInfo.lot_id },
      { name: 'imageDate', type: sql.Date, value: date }
    ];
    const imageResult = await dbService.executeQuery(imageQuery, imageParams);

    logger.info(`DEBUG: Lot ${lot} (ID: ${lotInfo.lot_id}) has ${imageResult.recordset.length} images`);

    res.json({
      success: true,
      lot: {
        lot_number: lot,
        lot_id: lotInfo.lot_id
      },
      date,
      totalImages: imageResult.recordset.length,
      images: imageResult.recordset.map(img => ({
        image_id: img.image_id,
        lot_id: img.lot_id,
        lot_number: img.lot_number,
        file_name: img.file_name,
        session_id: img.upload_session_id
      }))
    });

  } catch (error) {
    logger.error('Debug endpoint error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;