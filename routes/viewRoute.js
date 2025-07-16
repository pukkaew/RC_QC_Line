// Route handler for web view page
const express = require('express');
const router = express.Router();
const path = require('path');
const logger = require('../utils/Logger');

// Handle /view route
router.get('/', (req, res) => {
  try {
    const { lot, date } = req.query;
    
    logger.info(`View page requested - Lot: ${lot}, Date: ${date}`);
    
    // Check if parameters are provided
    if (!lot || !date) {
      // Send error page
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="th">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Error - QC Photo Viewer</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background: #f5f5f5;
              margin: 0;
              padding: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .error-container {
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
              max-width: 400px;
            }
            .error-icon {
              font-size: 48px;
              margin-bottom: 20px;
            }
            h1 {
              color: #333;
              margin-bottom: 10px;
            }
            p {
              color: #666;
              line-height: 1.6;
            }
            .back-btn {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 24px;
              background: #00B900;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="error-container">
            <div class="error-icon">❌</div>
            <h1>ข้อมูลไม่ครบถ้วน</h1>
            <p>กรุณาระบุ Lot และวันที่ที่ต้องการดูรูปภาพ</p>
            <p>ตัวอย่าง: /view?lot=ABC123&date=2025-06-17</p>
          </div>
        </body>
        </html>
      `);
    }
    
    // Check if view-web.html exists
    const viewFilePath = path.join(__dirname, '../public/liff/view-web.html');
    
    // Send the view page
    res.sendFile(viewFilePath, (err) => {
      if (err) {
        logger.error('Error sending view-web.html:', err);
        
        // Fallback to inline HTML
        res.send(`
          <!DOCTYPE html>
          <html lang="th">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>QC Photo Viewer - ${lot}</title>
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
                background: #f5f5f5;
                margin: 0;
                padding: 0;
              }
              
              .header {
                background: #00B900;
                color: white;
                padding: 20px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                position: sticky;
                top: 0;
                z-index: 100;
              }
              
              .header h1 {
                font-size: 24px;
                margin-bottom: 10px;
              }
              
              .header-info {
                font-size: 16px;
                opacity: 0.9;
              }
              
              .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
              }
              
              .loading {
                text-align: center;
                padding: 50px;
                color: #666;
              }
              
              .loading-spinner {
                display: inline-block;
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #00B900;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 10px;
              }
              
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              
              .controls {
                background: white;
                padding: 20px;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                margin-bottom: 20px;
                text-align: center;
              }
              
              .download-btn {
                display: inline-block;
                padding: 15px 30px;
                background: #00B900;
                color: white;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                font-size: 16px;
                transition: all 0.3s;
              }
              
              .download-btn:hover {
                background: #00A000;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
              }
              
              .download-btn:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
              }
              
              .image-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 20px;
                margin-top: 20px;
              }
              
              .image-item {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                cursor: pointer;
                transition: all 0.3s;
                position: relative;
              }
              
              .image-item:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              }
              
              .image-item img {
                width: 100%;
                height: 250px;
                object-fit: cover;
                display: block;
              }
              
              .image-info {
                padding: 15px;
                background: white;
                font-size: 14px;
                color: #666;
              }
              
              .image-number {
                position: absolute;
                top: 10px;
                left: 10px;
                background: rgba(0,0,0,0.8);
                color: white;
                padding: 5px 12px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: bold;
              }
              
              .error {
                text-align: center;
                padding: 50px;
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              
              .error-icon {
                font-size: 48px;
                margin-bottom: 20px;
              }
              
              .error h2 {
                color: #333;
                margin-bottom: 10px;
              }
              
              .error p {
                color: #666;
              }
              
              /* Modal for full image view */
              .modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                z-index: 1000;
                padding: 20px;
                overflow-y: auto;
              }
              
              .modal-content {
                position: relative;
                max-width: 90%;
                max-height: 90%;
                margin: auto;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100%;
              }
              
              .modal-image {
                max-width: 100%;
                max-height: 90vh;
                object-fit: contain;
              }
              
              .modal-close {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: rgba(255,255,255,0.2);
                border: 2px solid white;
                border-radius: 50%;
                color: white;
                font-size: 30px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s;
              }
              
              .modal-close:hover {
                background: rgba(255,255,255,0.3);
                transform: scale(1.1);
              }
              
              @media (max-width: 768px) {
                .image-grid {
                  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                  gap: 10px;
                }
                
                .image-item img {
                  height: 150px;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>📸 QC Photo Viewer</h1>
              <div class="header-info" id="headerInfo">
                Loading...
              </div>
            </div>
            
            <div class="container">
              <div class="loading" id="loading">
                <div class="loading-spinner"></div>
                <div>กำลังโหลดรูปภาพ...</div>
              </div>
              
              <div id="content" style="display: none;">
                <div class="controls">
                  <h2>รูปภาพ QC</h2>
                  <p id="imageCount" style="margin: 10px 0; color: #666;"></p>
                  <button class="download-btn" onclick="downloadAll()">
                    💾 ดาวน์โหลดทั้งหมด (ZIP)
                  </button>
                </div>
                <div class="image-grid" id="imageGrid"></div>
              </div>
              
              <div class="error" id="error" style="display: none;">
                <div class="error-icon">❌</div>
                <h2>เกิดข้อผิดพลาด</h2>
                <p id="errorMessage"></p>
              </div>
            </div>
            
            <!-- Modal -->
            <div class="modal" id="imageModal">
              <div class="modal-content">
                <img class="modal-image" id="modalImage" alt="">
                <button class="modal-close" onclick="closeModal()">✕</button>
              </div>
            </div>
            
            <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js"></script>
            
            <script>
              let images = [];
              const lotNumber = '${lot}';
              const imageDate = '${date}';
              let currentImageIndex = 0;
              
              // Load images
              async function loadImages() {
                try {
                  const response = await fetch(\`/api/images/\${encodeURIComponent(lotNumber)}/\${encodeURIComponent(imageDate)}\`);
                  
                  if (!response.ok) {
                    throw new Error('Failed to load images');
                  }
                  
                  const data = await response.json();
                  images = data.images || [];
                  
                  if (images.length === 0) {
                    showError('ไม่พบรูปภาพสำหรับ Lot และวันที่ที่ระบุ');
                    return;
                  }
                  
                  // Update header
                  document.getElementById('headerInfo').innerHTML = \`
                    📦 Lot: <strong>\${lotNumber}</strong> | 
                    📅 วันที่: <strong>\${new Date(imageDate).toLocaleDateString('th-TH')}</strong>
                  \`;
                  
                  // Update image count
                  document.getElementById('imageCount').textContent = \`พบรูปภาพทั้งหมด \${images.length} รูป\`;
                  
                  // Render images
                  renderImages();
                  
                  // Show content
                  document.getElementById('loading').style.display = 'none';
                  document.getElementById('content').style.display = 'block';
                  
                } catch (error) {
                  console.error('Error loading images:', error);
                  showError('เกิดข้อผิดพลาดในการโหลดรูปภาพ');
                }
              }
              
              // Render images
              function renderImages() {
                const grid = document.getElementById('imageGrid');
                grid.innerHTML = '';
                
                images.forEach((image, index) => {
                  const item = document.createElement('div');
                  item.className = 'image-item';
                  item.onclick = () => openModal(index);
                  
                  const img = document.createElement('img');
                  img.src = image.url;
                  img.alt = \`Image \${index + 1}\`;
                  img.loading = 'lazy';
                  
                  const number = document.createElement('div');
                  number.className = 'image-number';
                  number.textContent = index + 1;
                  
                  const info = document.createElement('div');
                  info.className = 'image-info';
                  info.textContent = \`รูปที่ \${index + 1} / \${images.length}\`;
                  
                  item.appendChild(img);
                  item.appendChild(number);
                  item.appendChild(info);
                  grid.appendChild(item);
                });
              }
              
              // Open modal
              function openModal(index) {
                currentImageIndex = index;
                const modal = document.getElementById('imageModal');
                const modalImage = document.getElementById('modalImage');
                
                modalImage.src = images[index].url;
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden';
              }
              
              // Close modal
              function closeModal() {
                const modal = document.getElementById('imageModal');
                modal.style.display = 'none';
                document.body.style.overflow = '';
              }
              
              // Download all images as ZIP
              async function downloadAll() {
                try {
                  const btn = event.target;
                  btn.disabled = true;
                  btn.textContent = '⏳ กำลังเตรียมไฟล์...';
                  
                  const zip = new JSZip();
                  const folder = zip.folder(\`QC_\${lotNumber}_\${imageDate}\`);
                  
                  // Download each image
                  for (let i = 0; i < images.length; i++) {
                    btn.textContent = \`⏳ กำลังดาวน์โหลด \${i + 1}/\${images.length}...\`;
                    
                    const response = await fetch(images[i].url);
                    const blob = await response.blob();
                    const filename = \`QC_\${lotNumber}_\${i + 1}.jpg\`;
                    folder.file(filename, blob);
                  }
                  
                  btn.textContent = '📦 กำลังสร้างไฟล์ ZIP...';
                  
                  // Generate ZIP
                  const content = await zip.generateAsync({ type: "blob" });
                  saveAs(content, \`QC_\${lotNumber}_\${imageDate}.zip\`);
                  
                  btn.disabled = false;
                  btn.innerHTML = '💾 ดาวน์โหลดทั้งหมด (ZIP)';
                  
                } catch (error) {
                  console.error('Error creating ZIP:', error);
                  alert('เกิดข้อผิดพลาดในการสร้างไฟล์ ZIP');
                  event.target.disabled = false;
                  event.target.innerHTML = '💾 ดาวน์โหลดทั้งหมด (ZIP)';
                }
              }
              
              // Show error
              function showError(message) {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('error').style.display = 'block';
                document.getElementById('errorMessage').textContent = message;
              }
              
              // Keyboard navigation
              document.addEventListener('keydown', (e) => {
                const modal = document.getElementById('imageModal');
                if (modal.style.display === 'block') {
                  if (e.key === 'Escape') {
                    closeModal();
                  } else if (e.key === 'ArrowLeft' && currentImageIndex > 0) {
                    openModal(currentImageIndex - 1);
                  } else if (e.key === 'ArrowRight' && currentImageIndex < images.length - 1) {
                    openModal(currentImageIndex + 1);
                  }
                }
              });
              
              // Click outside modal to close
              document.getElementById('imageModal').addEventListener('click', (e) => {
                if (e.target.id === 'imageModal') {
                  closeModal();
                }
              });
              
              // Load on start
              loadImages();
            </script>
          </body>
          </html>
        `);
      }
    });
    
  } catch (error) {
    logger.error('Error in view route:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="th">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - QC Photo Viewer</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
          }
          .error-container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            font-size: 48px;
            margin-bottom: 20px;
          }
          h1 {
            color: #333;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <div class="error-icon">❌</div>
          <h1>เกิดข้อผิดพลาด</h1>
          <p>ไม่สามารถแสดงหน้าเว็บได้</p>
          <p>${error.message}</p>
        </div>
      </body>
      </html>
    `);
  }
});

module.exports = router;