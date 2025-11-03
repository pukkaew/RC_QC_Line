-- Test query to verify image counting logic (matches DatePickerService and ImageModel)
-- This query counts images per date, considering only the latest upload session

DECLARE @lotId INT = 1; -- Change this to test with your lot_id

-- Show the logic step by step
PRINT '=== Step 1: Find latest session per date ==='
SELECT
  CONVERT(DATE, image_date) as image_date,
  MAX(upload_session_id) as latest_session_id,
  COUNT(CASE WHEN upload_session_id IS NULL THEN 1 END) as null_session_count,
  COUNT(CASE WHEN upload_session_id IS NOT NULL THEN 1 END) as with_session_count
FROM Images
WHERE lot_id = @lotId
  AND status = 'active'
GROUP BY CONVERT(DATE, image_date)
ORDER BY image_date DESC;

PRINT ''
PRINT '=== Step 2: Count images using the logic (final result) ==='
WITH LatestSessionPerDate AS (
  SELECT
    CONVERT(DATE, image_date) as image_date,
    MAX(upload_session_id) as latest_session_id
  FROM Images
  WHERE lot_id = @lotId
    AND status = 'active'
    AND upload_session_id IS NOT NULL
  GROUP BY CONVERT(DATE, image_date)
)
SELECT
  CONVERT(DATE, i.image_date) as date,
  ls.latest_session_id,
  COUNT(*) as count_displayed,
  COUNT(CASE WHEN i.upload_session_id IS NULL THEN 1 END) as old_images_null,
  COUNT(CASE WHEN i.upload_session_id IS NOT NULL THEN 1 END) as new_images_with_session
FROM Images i
LEFT JOIN LatestSessionPerDate ls ON CONVERT(DATE, i.image_date) = ls.image_date
WHERE i.lot_id = @lotId
  AND i.status = 'active'
  AND (
    -- Case 1: No sessions exist for this date (all are NULL) - count all images
    (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
    OR
    -- Case 2: Sessions exist - count ONLY images from the latest session
    (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
  )
GROUP BY CONVERT(DATE, i.image_date), ls.latest_session_id
ORDER BY date DESC;

PRINT ''
PRINT '=== Step 3: Compare with old logic (counting ALL images) ==='
SELECT
  CONVERT(DATE, image_date) as date,
  COUNT(*) as count_all_images
FROM Images
WHERE lot_id = @lotId
  AND status = 'active'
GROUP BY CONVERT(DATE, image_date)
ORDER BY date DESC;
