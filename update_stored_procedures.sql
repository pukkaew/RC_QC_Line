-- Update Stored Procedures to support upload_session_id
-- Date: 2025-10-31

USE [RC_QC_Line]
GO

PRINT 'Updating stored procedures...'
GO

-- =============================================
-- Drop old procedures
-- =============================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_GetImagesByLotAndDate]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_GetImagesByLotAndDate];
GO

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_UploadImage]') AND type in (N'P'))
    DROP PROCEDURE [dbo].[sp_UploadImage];
GO

-- =============================================
-- New Procedure: Get distinct sessions for a lot and date
-- =============================================

CREATE PROCEDURE [dbo].[sp_GetSessionsByLotAndDate]
    @LotNumber VARCHAR(50),
    @ImageDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT DISTINCT
        s.upload_session_id,
        s.session_start,
        s.image_count,
        s.first_filename
    FROM (
        SELECT
            i.upload_session_id,
            MIN(i.uploaded_at) AS session_start,
            COUNT(*) AS image_count,
            MIN(i.file_name) AS first_filename
        FROM [dbo].[Images] i
        JOIN [dbo].[Lots] l ON i.lot_id = l.lot_id
        WHERE l.lot_number = @LotNumber
          AND CONVERT(DATE, i.image_date) = @ImageDate
          AND i.status = 'active'
          AND i.upload_session_id IS NOT NULL
        GROUP BY i.upload_session_id
    ) s
    ORDER BY s.session_start DESC;  -- Latest session first
END
GO

-- =============================================
-- Updated Procedure: Get images by lot, date AND session
-- =============================================

CREATE PROCEDURE [dbo].[sp_GetImagesByLotAndDateAndSession]
    @LotNumber VARCHAR(50),
    @ImageDate DATE,
    @SessionId BIGINT = NULL  -- NULL = get latest session
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SelectedSessionId BIGINT;

    -- If no session specified, get the latest session
    IF @SessionId IS NULL
    BEGIN
        SELECT TOP 1 @SelectedSessionId = upload_session_id
        FROM [dbo].[Images] i
        JOIN [dbo].[Lots] l ON i.lot_id = l.lot_id
        WHERE l.lot_number = @LotNumber
          AND CONVERT(DATE, i.image_date) = @ImageDate
          AND i.status = 'active'
          AND i.upload_session_id IS NOT NULL
        ORDER BY i.uploaded_at DESC;
    END
    ELSE
    BEGIN
        SET @SelectedSessionId = @SessionId;
    END

    -- Get images for the selected session
    SELECT i.*, l.lot_number
    FROM [dbo].[Images] i
    JOIN [dbo].[Lots] l ON i.lot_id = l.lot_id
    WHERE l.lot_number = @LotNumber
      AND CONVERT(DATE, i.image_date) = @ImageDate
      AND i.upload_session_id = @SelectedSessionId
      AND i.status = 'active'
    ORDER BY
        -- Use the complex ordering from ImageModel.js
        CASE
            WHEN CHARINDEX('_', i.file_name) > 0
            AND CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) > 0
            AND CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) + 1) > 0
            THEN 0
            ELSE 1
        END,
        -- Extract order number (third segment)
        CASE
            WHEN CHARINDEX('_', i.file_name) > 0
            AND CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) > 0
            AND CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) + 1) > 0
            THEN SUBSTRING(
                i.file_name,
                CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) + 1,
                CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) + 1) - CHARINDEX('_', i.file_name, CHARINDEX('_', i.file_name) + 1) - 1
            )
            ELSE '9999'
        END,
        i.uploaded_at ASC;  -- Changed to ASC for correct order
END
GO

-- =============================================
-- Backward Compatible: Get images without session filter (gets latest session)
-- =============================================

CREATE PROCEDURE [dbo].[sp_GetImagesByLotAndDate]
    @LotNumber VARCHAR(50),
    @ImageDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Call the new procedure with NULL session to get latest
    EXEC [dbo].[sp_GetImagesByLotAndDateAndSession]
        @LotNumber = @LotNumber,
        @ImageDate = @ImageDate,
        @SessionId = NULL;
END
GO

-- =============================================
-- Updated Procedure: Upload image with session support
-- =============================================

CREATE PROCEDURE [dbo].[sp_UploadImage]
    @LotNumber VARCHAR(50),
    @ImageDate DATE,
    @FileName VARCHAR(255),
    @FilePath VARCHAR(512),
    @OriginalSize INT,
    @CompressedSize INT,
    @MimeType VARCHAR(50),
    @UploadedBy VARCHAR(50),
    @SessionId BIGINT = NULL,  -- New parameter
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

    -- Insert image with session_id
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
        upload_session_id,  -- New field
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
        @SessionId,  -- New value
        'active'
    );

    SET @ImageId = SCOPE_IDENTITY();
END
GO

PRINT 'Stored procedures updated successfully!'
PRINT ''
PRINT 'New procedures created:'
PRINT '  - sp_GetSessionsByLotAndDate (NEW): Get all sessions for a lot/date'
PRINT '  - sp_GetImagesByLotAndDateAndSession (NEW): Get images by session'
PRINT '  - sp_GetImagesByLotAndDate (UPDATED): Now gets latest session by default'
PRINT '  - sp_UploadImage (UPDATED): Now supports upload_session_id parameter'
GO
