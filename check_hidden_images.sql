-- Check if there are images that were hidden by old logic but still active
-- These images will reappear after the fix

DECLARE @lotId INT = 1; -- Change to your lot_id
DECLARE @imageDate DATE = '2025-11-03'; -- Change to your date

PRINT '========================================='
PRINT 'Hidden Images Detection'
PRINT '========================================='
PRINT ''

-- Step 1: Find the latest session for this date
PRINT '=== Step 1: Latest Session Info ==='
SELECT
  MAX(upload_session_id) as latest_session_id,
  COUNT(DISTINCT upload_session_id) as total_sessions,
  COUNT(*) as total_active_images
FROM Images
WHERE lot_id = @lotId
  AND CONVERT(DATE, image_date) = @imageDate
  AND status = 'active';

PRINT ''
PRINT '=== Step 2: Images per Session ==='
SELECT
  ISNULL(CAST(upload_session_id AS VARCHAR), 'NULL (old data)') as session_id,
  COUNT(*) as image_count,
  MIN(uploaded_at) as first_upload,
  MAX(uploaded_at) as last_upload
FROM Images
WHERE lot_id = @lotId
  AND CONVERT(DATE, image_date) = @imageDate
  AND status = 'active'
GROUP BY upload_session_id
ORDER BY upload_session_id;

PRINT ''
PRINT '=== Step 3: Images that were HIDDEN by old logic ==='
-- These are images that were NOT from the latest session
WITH LatestSession AS (
  SELECT MAX(upload_session_id) as latest_session_id
  FROM Images
  WHERE lot_id = @lotId
    AND CONVERT(DATE, image_date) = @imageDate
    AND status = 'active'
    AND upload_session_id IS NOT NULL
)
SELECT
  i.image_id,
  i.file_name,
  i.upload_session_id,
  i.uploaded_at,
  CASE
    WHEN i.upload_session_id < ls.latest_session_id THEN 'HIDDEN (older session)'
    WHEN i.upload_session_id IS NULL AND ls.latest_session_id IS NOT NULL THEN 'HIDDEN (no session)'
    ELSE 'VISIBLE'
  END as status_in_old_logic
FROM Images i
CROSS JOIN LatestSession ls
WHERE i.lot_id = @lotId
  AND CONVERT(DATE, i.image_date) = @imageDate
  AND i.status = 'active'
  AND (
    i.upload_session_id < ls.latest_session_id
    OR (i.upload_session_id IS NULL AND ls.latest_session_id IS NOT NULL)
  )
ORDER BY i.upload_session_id, i.uploaded_at;

PRINT ''
PRINT '=== Summary ==='
PRINT 'All images with status_in_old_logic = "HIDDEN" will REAPPEAR after the fix!'
PRINT 'No data migration needed - just restart the server.'
