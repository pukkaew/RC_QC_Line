-- Database setup script for RC_QC_Line project

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'RC_QC_Line')
BEGIN
    CREATE DATABASE RC_QC_Line;
END
GO

USE RC_QC_Line;
GO

-- Create Lots table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Lots]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Lots] (
        [lot_id] INT IDENTITY(1,1) PRIMARY KEY,
        [lot_number] VARCHAR(50) NOT NULL,
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [status] VARCHAR(20) NOT NULL DEFAULT 'active'
    );
    
    CREATE UNIQUE INDEX [IDX_Lots_lot_number] ON [dbo].[Lots] ([lot_number]);
END
GO

-- Create Images table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Images]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Images] (
        [image_id] INT IDENTITY(1,1) PRIMARY KEY,
        [lot_id] INT NOT NULL,
        [image_date] DATE NOT NULL,
        [file_name] VARCHAR(255) NOT NULL,
        [file_path] VARCHAR(512) NOT NULL,
        [original_size] INT NOT NULL,
        [compressed_size] INT NOT NULL,
        [mime_type] VARCHAR(50) NOT NULL,
        [uploaded_by] VARCHAR(50) NOT NULL,
        [uploaded_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [status] VARCHAR(20) NOT NULL DEFAULT 'active',
        CONSTRAINT [FK_Images_Lots] FOREIGN KEY ([lot_id]) REFERENCES [dbo].[Lots] ([lot_id])
    );
    
    CREATE INDEX [IDX_Images_lot_id] ON [dbo].[Images] ([lot_id]);
    CREATE INDEX [IDX_Images_image_date] ON [dbo].[Images] ([image_date]);
    CREATE INDEX [IDX_Images_lot_date] ON [dbo].[Images] ([lot_id], [image_date]);
END
GO

-- Create Users table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [user_id] INT IDENTITY(1,1) PRIMARY KEY,
        [line_user_id] VARCHAR(50) NOT NULL,
        [username] VARCHAR(100) NULL,
        [role] VARCHAR(20) NOT NULL DEFAULT 'user',
        [status] VARCHAR(20) NOT NULL DEFAULT 'active',
        [created_at] DATETIME NOT NULL DEFAULT GETDATE(),
        [last_access] DATETIME NOT NULL DEFAULT GETDATE()
    );
    
    CREATE UNIQUE INDEX [IDX_Users_line_user_id] ON [dbo].[Users] ([line_user_id]);
END
GO

-- Insert admin user if not exists
IF NOT EXISTS (SELECT * FROM [dbo].[Users] WHERE [role] = 'admin')
BEGIN
    INSERT INTO [dbo].[Users] ([line_user_id], [username], [role], [status], [created_at], [last_access])
    VALUES ('admin', 'Administrator', 'admin', 'active', GETDATE(), GETDATE());
END
GO

-- Create stored procedure for getting images by lot and date
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetImagesByLotAndDate]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetImagesByLotAndDate];
GO

CREATE PROCEDURE [dbo].[sp_GetImagesByLotAndDate]
    @LotNumber VARCHAR(50),
    @ImageDate DATE
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT i.*, l.lot_number
    FROM [dbo].[Images] i
    JOIN [dbo].[Lots] l ON i.lot_id = l.lot_id
    WHERE l.lot_number = @LotNumber
      AND CONVERT(DATE, i.image_date) = @ImageDate
      AND i.status = 'active'
    ORDER BY i.uploaded_at DESC;
END
GO

-- Create stored procedure for uploading images
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UploadImage]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_UploadImage];
GO

CREATE PROCEDURE [dbo].[sp_UploadImage]
    @LotNumber VARCHAR(50),
    @ImageDate DATE,
    @FileName VARCHAR(255),
    @FilePath VARCHAR(512),
    @OriginalSize INT,
    @CompressedSize INT,
    @MimeType VARCHAR(50),
    @UploadedBy VARCHAR(50),
    @ImageId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @LotId INT;
    
    -- Get or create lot
    SELECT @LotId = lot_id FROM [dbo].[Lots] WHERE lot_number = @LotNumber;
    
    IF @LotId IS NULL
    BEGIN
        INSERT INTO [dbo].[Lots] (lot_number, created_at, updated_at, status)
        VALUES (@LotNumber, GETDATE(), GETDATE(), 'active');
        
        SET @LotId = SCOPE_IDENTITY();
    END
    
    -- Insert image
    INSERT INTO [dbo].[Images] (
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
        @LotId,
        @ImageDate,
        @FileName,
        @FilePath,
        @OriginalSize,
        @CompressedSize,
        @MimeType,
        @UploadedBy,
        GETDATE(),
        'active'
    );
    
    SET @ImageId = SCOPE_IDENTITY();
END
GO