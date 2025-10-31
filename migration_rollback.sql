-- Rollback Script: Remove upload_session_id column
-- Use this ONLY if migration caused problems
-- WARNING: This will remove the upload_session_id column and all session data
-- Date: 2025-10-31

USE [RC_QC_Line]
GO

PRINT 'WARNING: This will rollback the migration!'
PRINT 'Press Ctrl+C to cancel within 5 seconds...'
WAITFOR DELAY '00:00:05'
GO

-- Step 1: Drop index if exists
IF EXISTS (
    SELECT * FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'IDX_Images_lot_date_session'
)
BEGIN
    PRINT 'Dropping index IDX_Images_lot_date_session...'
    DROP INDEX [IDX_Images_lot_date_session] ON [dbo].[Images];
    PRINT 'Index dropped!'
END
GO

-- Step 2: Remove column
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'upload_session_id'
)
BEGIN
    PRINT 'Removing upload_session_id column...'
    ALTER TABLE [dbo].[Images]
    DROP COLUMN [upload_session_id];
    PRINT 'Column removed!'
END
GO

PRINT 'Rollback completed successfully!'
GO
