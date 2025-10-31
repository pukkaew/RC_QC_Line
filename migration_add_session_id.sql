-- Migration Script: Add upload_session_id to Images table
-- This script is SAFE for existing data
-- Date: 2025-10-31

USE [RC_QC_Line]
GO

PRINT 'Starting migration: Add upload_session_id column'
GO

-- Step 1: Backup current data count
DECLARE @RecordCount INT;
SELECT @RecordCount = COUNT(*) FROM [dbo].[Images];
PRINT 'Current Images count: ' + CAST(@RecordCount AS VARCHAR(10));
GO

-- Step 2: Add new column (nullable to allow existing data)
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'upload_session_id'
)
BEGIN
    PRINT 'Adding upload_session_id column...'

    ALTER TABLE [dbo].[Images]
    ADD [upload_session_id] BIGINT NULL;

    PRINT 'Column added successfully!'
END
ELSE
BEGIN
    PRINT 'Column upload_session_id already exists, skipping...'
END
GO

-- Step 3: Migrate existing data
-- Strategy: Group images by lot_id, image_date, and time window
-- If images uploaded_at differ by more than 1 hour, treat as separate sessions

PRINT 'Migrating existing data...'
GO

-- Create a CTE to assign session IDs to existing data
-- Session ID = First uploaded_at timestamp in each session (as BIGINT milliseconds)
WITH ImageSessions AS (
    SELECT
        image_id,
        lot_id,
        image_date,
        uploaded_at,
        -- Calculate time difference from previous image in same lot/date
        LAG(uploaded_at) OVER (
            PARTITION BY lot_id, image_date
            ORDER BY uploaded_at
        ) AS prev_uploaded_at,
        -- Session boundary: if time gap > 1 hour or first image
        CASE
            WHEN LAG(uploaded_at) OVER (
                PARTITION BY lot_id, image_date
                ORDER BY uploaded_at
            ) IS NULL
            THEN 1
            WHEN DATEDIFF(MINUTE,
                LAG(uploaded_at) OVER (
                    PARTITION BY lot_id, image_date
                    ORDER BY uploaded_at
                ),
                uploaded_at
            ) > 60
            THEN 1
            ELSE 0
        END AS is_new_session
    FROM [dbo].[Images]
    WHERE upload_session_id IS NULL  -- Only process records without session_id
),
SessionBoundaries AS (
    SELECT
        image_id,
        lot_id,
        image_date,
        uploaded_at,
        -- Calculate session number within each lot/date
        SUM(is_new_session) OVER (
            PARTITION BY lot_id, image_date
            ORDER BY uploaded_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS session_number
    FROM ImageSessions
),
SessionIDs AS (
    SELECT
        image_id,
        lot_id,
        image_date,
        uploaded_at,
        session_number,
        -- Get the first uploaded_at timestamp for each session
        FIRST_VALUE(uploaded_at) OVER (
            PARTITION BY lot_id, image_date, session_number
            ORDER BY uploaded_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
        ) AS session_start_time
    FROM SessionBoundaries
)
-- Update Images with calculated session IDs
UPDATE i
SET upload_session_id = DATEDIFF_BIG(
    MILLISECOND,
    '1970-01-01 00:00:00',
    s.session_start_time
)
FROM [dbo].[Images] i
INNER JOIN SessionIDs s ON i.image_id = s.image_id
WHERE i.upload_session_id IS NULL;

GO

-- Step 4: Verify migration
DECLARE @MigratedCount INT;
DECLARE @NullCount INT;

SELECT @MigratedCount = COUNT(*)
FROM [dbo].[Images]
WHERE upload_session_id IS NOT NULL;

SELECT @NullCount = COUNT(*)
FROM [dbo].[Images]
WHERE upload_session_id IS NULL;

PRINT 'Migration completed!'
PRINT 'Records with session_id: ' + CAST(@MigratedCount AS VARCHAR(10));
PRINT 'Records without session_id: ' + CAST(@NullCount AS VARCHAR(10));

-- Show sample of migrated data
PRINT 'Sample of migrated data (first 5 records):'
SELECT TOP 5
    image_id,
    lot_id,
    image_date,
    uploaded_at,
    upload_session_id,
    file_name
FROM [dbo].[Images]
ORDER BY uploaded_at;

GO

-- Step 5: Create index for better query performance
IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
    AND name = 'IDX_Images_lot_date_session'
)
BEGIN
    PRINT 'Creating index on upload_session_id...'

    CREATE NONCLUSTERED INDEX [IDX_Images_lot_date_session]
    ON [dbo].[Images] ([lot_id], [image_date], [upload_session_id])
    INCLUDE ([file_name], [file_path], [uploaded_at]);

    PRINT 'Index created successfully!'
END
GO

PRINT 'Migration script completed successfully!'
PRINT 'Next steps:'
PRINT '  1. Verify the data looks correct'
PRINT '  2. Update application code to use upload_session_id'
PRINT '  3. Update stored procedures'
GO
