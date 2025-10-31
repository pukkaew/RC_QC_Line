-- Migration: Add upload_session_id column to Images table
-- Date: 2025-10-31
-- Purpose: Support filtering images by upload session to prevent mixing images from different uploads

USE [RC_QC_Line]
GO

-- Check if column already exists
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'upload_session_id'
)
BEGIN
    -- Add the upload_session_id column
    ALTER TABLE [dbo].[Images]
    ADD [upload_session_id] BIGINT NULL;

    PRINT 'Column upload_session_id added successfully to Images table';
END
ELSE
BEGIN
    PRINT 'Column upload_session_id already exists in Images table';
END
GO

-- Create index for better performance on session-based queries
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'IDX_Images_upload_session_id'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IDX_Images_upload_session_id]
    ON [dbo].[Images] ([upload_session_id])
    WHERE [upload_session_id] IS NOT NULL;

    PRINT 'Index IDX_Images_upload_session_id created successfully';
END
ELSE
BEGIN
    PRINT 'Index IDX_Images_upload_session_id already exists';
END
GO

-- Create composite index for lot_id, image_date, and upload_session_id
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'IDX_Images_lot_date_session'
)
BEGIN
    CREATE NONCLUSTERED INDEX [IDX_Images_lot_date_session]
    ON [dbo].[Images] ([lot_id], [image_date], [upload_session_id])
    INCLUDE ([file_name], [status])
    WHERE [upload_session_id] IS NOT NULL;

    PRINT 'Index IDX_Images_lot_date_session created successfully';
END
ELSE
BEGIN
    PRINT 'Index IDX_Images_lot_date_session already exists';
END
GO

PRINT 'Migration completed successfully!';
PRINT '';
PRINT 'Summary:';
PRINT '- Added column: upload_session_id (BIGINT NULL)';
PRINT '- Added index: IDX_Images_upload_session_id';
PRINT '- Added index: IDX_Images_lot_date_session';
PRINT '';
PRINT 'Note: Existing images will have NULL upload_session_id.';
PRINT 'New uploads will automatically include the session ID.';
GO
