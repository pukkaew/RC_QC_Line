-- Verify image counting logic after delete operations
-- This helps debug the issue where deleted images are counted

DECLARE @lotId INT = 1; -- Change this to test with your lot_id
DECLARE @imageDate DATE = '2025-11-03'; -- Change this to test with your date

PRINT '========================================='
PRINT 'Image Count Verification Test'
PRINT '========================================='
PRINT ''

-- Step 1: Show all images (active and deleted) breakdown
PRINT '=== Step 1: All Images (Active vs Deleted) ==='
SELECT
  CONVERT(DATE, image_date) as date,
  status,
  upload_session_id,
  COUNT(*) as count
FROM Images
WHERE lot_id = @lotId
GROUP BY CONVERT(DATE, image_date), status, upload_session_id
ORDER BY date DESC, status, upload_session_id;

PRINT ''
PRINT '=== Step 2: DatePicker Query Result (FIXED - should count only active) ==='
WITH LatestSessionPerDate AS (
  SELECT
    CONVERT(DATE, image_date) as image_date,
    MAX(upload_session_id) as latest_session_id
  FROM Images
  WHERE lot_id = @lotId
    AND status = 'active'  -- ✓ Only active images
    AND upload_session_id IS NOT NULL
  GROUP BY CONVERT(DATE, image_date)
)
SELECT
  CONVERT(DATE, i.image_date) as date,
  ls.latest_session_id,
  COUNT(*) as count_in_datepicker,
  COUNT(CASE WHEN i.status = 'active' THEN 1 END) as verify_active,
  COUNT(CASE WHEN i.status = 'deleted' THEN 1 END) as verify_deleted
FROM Images i
LEFT JOIN LatestSessionPerDate ls ON CONVERT(DATE, i.image_date) = ls.image_date
WHERE i.lot_id = @lotId
  AND i.status = 'active'  -- ✓ Only active images
  AND (
    -- Case 1: No sessions exist for this date (all are NULL) - count all active images
    (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
    OR
    -- Case 2: Sessions exist - count ONLY active images from the latest session
    (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
  )
GROUP BY CONVERT(DATE, i.image_date), ls.latest_session_id
ORDER BY date DESC;

PRINT ''
PRINT '=== Step 3: ImageModel Query Result (what user sees) ==='
-- Simulate getByLotAndDate query
WITH LatestSession AS (
  SELECT MAX(upload_session_id) as latest_session_id
  FROM Images i
  WHERE i.lot_id = @lotId
    AND CONVERT(DATE, i.image_date) = @imageDate
    AND i.status = 'active'
    AND i.upload_session_id IS NOT NULL
)
SELECT
  COUNT(*) as images_displayed,
  ls.latest_session_id
FROM Images i
LEFT JOIN LatestSession ls ON 1=1
WHERE i.lot_id = @lotId
  AND CONVERT(DATE, i.image_date) = @imageDate
  AND i.status = 'active'
  AND (
    (ls.latest_session_id IS NULL)
    OR
    (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
  )
GROUP BY ls.latest_session_id;

PRINT ''
PRINT '=== Step 4: Verify consistency ==='
PRINT 'The count in Step 2 should match Step 3 for the same date'
PRINT 'If they dont match, there is a bug in the query'
