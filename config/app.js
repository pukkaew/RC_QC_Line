// Application configuration
module.exports = {
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 3000,
    upload: {
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
      path: process.env.UPLOAD_PATH || 'public/uploads',
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/jpg']
    },
    limits: {
      maxImagesPerUpload: 20,
      maxImagesPerMessage: 5 // LINE API limitation
    }
  };