-- Script to test if upload_session_id is being saved correctly
USE [RC_QC_Line]
GO

-- 1. Check if column exists
PRINT '=== Checking if upload_session_id column exists ==='
SELECT
    TABLE_NAME,
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Images'
  AND COLUMN_NAME = 'upload_session_id'
GO

-- 2. Check recent uploads with session ID
PRINT ''
PRINT '=== Recent images with upload_session_id ==='
SELECT TOP 10
    image_id,
    lot_id,
    file_name,
    upload_session_id,
    uploaded_at,
    CASE
        WHEN upload_session_id IS NULL THEN 'NULL (Old Data)'
        ELSE CAST(upload_session_id AS VARCHAR(50))
    END as session_status
FROM Images
ORDER BY uploaded_at DESC
GO

-- 3. Check if new uploads have session IDs
PRINT ''
PRINT '=== Statistics of upload_session_id usage ==='
SELECT
    CASE
        WHEN upload_session_id IS NULL THEN 'Without Session ID (Old)'
        ELSE 'With Session ID (New)'
    END as session_type,
    COUNT(*) as image_count,
    MIN(uploaded_at) as earliest_upload,
    MAX(uploaded_at) as latest_upload
FROM Images
WHERE status = 'active'
GROUP BY
    CASE
        WHEN upload_session_id IS NULL THEN 'Without Session ID (Old)'
        ELSE 'With Session ID (New)'
    END
ORDER BY session_type
GO

-- 4. Check for duplicate session IDs (should have multiple images per session)
PRINT ''
PRINT '=== Sessions with multiple images ==='
SELECT
    upload_session_id,
    COUNT(*) as image_count,
    MIN(uploaded_at) as session_start,
    MAX(uploaded_at) as session_end,
    DATEDIFF(SECOND, MIN(uploaded_at), MAX(uploaded_at)) as duration_seconds
FROM Images
WHERE upload_session_id IS NOT NULL
GROUP BY upload_session_id
HAVING COUNT(*) > 1
ORDER BY session_start DESC
GO

PRINT ''
PRINT '=== Test Complete ==='
