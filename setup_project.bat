@echo off
echo RC_QC_Line Project Setup Script
echo ==============================
echo.

REM Create main directory structure
echo Creating directory structure...
mkdir config
mkdir controllers
mkdir models
mkdir services
mkdir utils
mkdir views
mkdir public
mkdir public\uploads
mkdir logs

echo.
echo Directory structure created successfully!
echo.

REM Create config files
echo Creating config files...
echo // Application configuration > config\app.js
echo // Database configuration > config\database.js
echo // LINE API configuration > config\line.js

REM Create controllers
echo Creating controllers...
echo // Controller for handling LINE webhook events > controllers\WebhookController.js
echo // Controller for handling image uploads > controllers\UploadController.js
echo // Controller for image retrieval and viewing > controllers\ImageController.js
echo // Controller for user management > controllers\UserController.js

REM Create models
echo Creating models...
echo // Lot model for managing product lot information > models\LotModel.js
echo // Image model for managing product images > models\ImageModel.js
echo // User model for managing user information > models\UserModel.js

REM Create services
echo Creating services...
echo // Service for LINE API interactions > services\LineService.js
echo // Service for date picker functionality in LINE > services\DatePickerService.js
echo // Service for image processing and management > services\ImageService.js
echo // Database connection service > services\DatabaseService.js

REM Create utils
echo Creating utilities...
echo // Logger utility for application logging > utils\Logger.js
echo // Error handling utility > utils\ErrorHandler.js
echo // Image compression utility using Sharp > utils\ImageCompressor.js
echo // Date formatting utility > utils\DateFormatter.js

REM Create views
echo Creating views...
echo // Builder for LINE messages > views\LineMessageBuilder.js
echo // Builder for date picker flex messages > views\DatePickerBuilder.js

REM Create main app files
echo Creating main application files...
echo // Main application file > app.js
echo.

REM Create package.json
echo Creating package.json...
echo {> package.json
echo   "name": "rc_qc_line",>> package.json
echo   "version": "1.0.0",>> package.json
echo   "description": "LINE-based image management system for product QC by lot and date",>> package.json
echo   "main": "app.js",>> package.json
echo   "scripts": {>> package.json
echo     "start": "node app.js",>> package.json
echo     "dev": "nodemon app.js",>> package.json
echo     "test": "echo \"Error: no test specified\" && exit 1">> package.json
echo   },>> package.json
echo   "dependencies": {>> package.json
echo     "body-parser": "^1.20.2",>> package.json
echo     "dotenv": "^16.3.1",>> package.json
echo     "express": "^4.18.2",>> package.json
echo     "mssql": "^10.0.1",>> package.json
echo     "sharp": "^0.33.0",>> package.json
echo     "@line/bot-sdk": "^8.0.0",>> package.json
echo     "multer": "^1.4.5-lts.1",>> package.json
echo     "uuid": "^9.0.1",>> package.json
echo     "winston": "^3.11.0",>> package.json
echo     "moment": "^2.29.4">> package.json
echo   },>> package.json
echo   "devDependencies": {>> package.json
echo     "nodemon": "^3.0.1">> package.json
echo   }>> package.json
echo }>> package.json

REM Create .env.example
echo Creating .env.example...
echo # Application> .env.example
echo PORT=3000>> .env.example
echo NODE_ENV=development>> .env.example
echo BASE_URL=http://localhost:3000>> .env.example
echo.>> .env.example
echo # LINE API>> .env.example
echo LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token>> .env.example
echo LINE_CHANNEL_SECRET=your_line_channel_secret>> .env.example
echo LINE_RICH_MENU_ID=your_line_rich_menu_id>> .env.example
echo.>> .env.example
echo # Database>> .env.example
echo DB_SERVER=localhost>> .env.example
echo DB_NAME=RC_QC_Line>> .env.example
echo DB_USER=sa>> .env.example
echo DB_PASSWORD=your_password>> .env.example
echo DB_PORT=1433>> .env.example
echo.>> .env.example
echo # Logging>> .env.example
echo LOG_LEVEL=info>> .env.example
echo.>> .env.example
echo # File upload>> .env.example
echo MAX_FILE_SIZE=10485760  # 10MB in bytes>> .env.example
echo UPLOAD_PATH=public/uploads>> .env.example

REM Create README.md
echo Creating README.md...
echo # RC_QC_Line> README.md
echo.>> README.md
echo ระบบจัดการรูปภาพสินค้าตาม Lot และวันที่ผ่าน LINE Official Account>> README.md

REM Create SQL script file
echo Creating database_setup.sql...
echo -- Database setup script for RC_QC_Line project> database_setup.sql
echo.>> database_setup.sql
echo -- Create database if it doesn't exist>> database_setup.sql
echo IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'RC_QC_Line')>> database_setup.sql
echo BEGIN>> database_setup.sql
echo     CREATE DATABASE RC_QC_Line;>> database_setup.sql
echo END>> database_setup.sql
echo GO>> database_setup.sql

echo.
echo Basic project structure has been set up successfully!
echo You can now copy your actual code files into the corresponding directories.
echo.
echo Next steps:
echo 1. Copy the actual JavaScript files into their respective folders
echo 2. Run 'npm install' to install dependencies
echo 3. Configure your .env file based on .env.example
echo 4. Run the database_setup.sql script on your SQL Server
echo 5. Start the application with 'npm run dev'
echo.
echo Press any key to exit...
pause > nul