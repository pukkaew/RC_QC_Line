// Routes for image sharing
const express = require('express');
const router = express.Router();
const imageShareService = require('../services/ImageShareService');
const lineService = require('../services/LineService');
const imageService = require('../services/ImageService');
const logger = require('../utils/Logger');

// Create share session
router.post('/create-share', async (req, res) => {
  try {
    const { userId, lotNumber, imageDate, imageIds } = req.body;
    
    logger.info(`Creating share session for user: ${userId}, lot: ${lotNumber}`);
    
    // Get images
    const result = await imageService.getImagesByLotAndDate(lotNumber, imageDate);
    
    if (!result.images || result.images.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No images found'
      });
    }
    
    // Filter selected images if provided
    let imagesToShare = result.images;
    if (imageIds && imageIds.length > 0) {
      imagesToShare = result.images.filter(img => imageIds.includes(img.image_id));
    }
    
    // Create share session
    const shareSession = await imageShareService.createShareSession(
      userId,
      imagesToShare,
      lotNumber,
      imageDate
    );
    
    // Create shareable message
    const shareMessage = imageShareService.createShareableMessage(shareSession.sessionId);
    
    res.json({
      success: true,
      sessionId: shareSession.sessionId,
      shareUrl: shareSession.shareUrl,
      shareMessage: shareMessage,
      imageCount: imagesToShare.length
    });
    
  } catch (error) {
    logger.error('Error creating share session:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Share page - when someone clicks the share link
router.get('/share/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = imageShareService.getShareSession(sessionId);
    
    if (!session) {
      return res.status(404).send(`
        <html>
          <head>
            <title>Share Expired</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial; text-align: center; padding: 50px; }
              h1 { color: #666; }
            </style>
          </head>
          <body>
            <h1>❌ ลิงก์หมดอายุ</h1>
            <p>ลิงก์แชร์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่</p>
          </body>
        </html>
      `);
    }
    
    // Create HTML page with LIFF to receive images
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>รับรูปภาพ QC</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 400px;
      margin: auto;
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #00B900;
      text-align: center;
      font-size: 24px;
    }
    .info {
      background: #f0f0f0;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .info p {
      margin: 5px 0;
    }
    .preview {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      margin: 20px 0;
    }
    .preview img {
      width: 100%;
      height: 100px;
      object-fit: cover;
      border-radius: 4px;
    }
    button {
      width: 100%;
      padding: 15px;
      background: #00B900;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
    }
    button:disabled {
      background: #ccc;
    }
    .status {
      text-align: center;
      margin: 20px 0;
      color: #666;
    }
    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #00B900;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-right: 10px;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📸 รับรูปภาพ QC</h1>
    
    <div class="info">
      <p><strong>📦 Lot:</strong> ${session.lotNumber}</p>
      <p><strong>📅 วันที่:</strong> ${new Date(session.imageDate).toLocaleDateString('th-TH')}</p>
      <p><strong>🖼️ จำนวน:</strong> ${session.images.length} รูป</p>
    </div>
    
    <div class="preview">
      ${session.images.slice(0, 6).map(img => 
        `<img src="${img.url}" alt="Preview">`
      ).join('')}
    </div>
    
    <button id="receiveBtn" onclick="receiveImages()">
      📥 รับรูปภาพ
    </button>
    
    <div class="status" id="status"></div>
  </div>
  
  <script charset="utf-8" src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <script>
    let isProcessing = false;
    
    async function initializeLiff() {
      try {
        await liff.init({ liffId: '2007575196-NWaXrZVE' });
        
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        
        // Auto receive if opened in LINE
        if (liff.isInClient()) {
          setTimeout(() => {
            receiveImages();
          }, 1000);
        }
        
      } catch (error) {
        console.error('LIFF init error:', error);
        showStatus('❌ เกิดข้อผิดพลาด');
      }
    }
    
    async function receiveImages() {
      if (isProcessing) return;
      isProcessing = true;
      
      const btn = document.getElementById('receiveBtn');
      btn.disabled = true;
      btn.innerHTML = '<span class="loading"></span> กำลังส่งรูปภาพ...';
      
      try {
        const profile = await liff.getProfile();
        
        // Send request to deliver images
        const response = await fetch('/api/share/deliver', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: '${sessionId}',
            userId: profile.userId
          })
        });
        
        const result = await response.json();
        
        if (result.success) {
          showStatus('✅ ส่งรูปภาพเรียบร้อยแล้ว!');
          btn.innerHTML = '✅ ส่งแล้ว';
          
          // Close LIFF after 2 seconds
          if (liff.isInClient()) {
            setTimeout(() => {
              liff.closeWindow();
            }, 2000);
          }
        } else {
          throw new Error(result.message);
        }
        
      } catch (error) {
        console.error('Error:', error);
        showStatus('❌ ' + error.message);
        btn.disabled = false;
        btn.innerHTML = '📥 รับรูปภาพ';
        isProcessing = false;
      }
    }
    
    function showStatus(message) {
      document.getElementById('status').innerHTML = message;
    }
    
    // Initialize on load
    window.addEventListener('load', initializeLiff);
  </script>
</body>
</html>
    `;
    
    res.send(html);
    
  } catch (error) {
    logger.error('Error in share page:', error);
    res.status(500).send('Error loading share page');
  }
});

// Deliver images to user
router.post('/share/deliver', async (req, res) => {
  try {
    const { sessionId, userId } = req.body;
    
    const session = imageShareService.getShareSession(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session expired'
      });
    }
    
    // Send images to the user who clicked the link
    const result = await imageShareService.sendImagesToChat(sessionId, userId, 'user');
    
    res.json({
      success: true,
      message: `ส่งรูปภาพ ${result.count} รูป แล้ว`,
      count: result.count
    });
    
  } catch (error) {
    logger.error('Error delivering images:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;