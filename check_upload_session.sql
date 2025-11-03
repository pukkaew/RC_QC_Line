-- ตรวจสอบ upload_session_id ใน database
USE [RC_QC_Line]
GO

-- 1. ตรวจสอบว่ามีรูปภาพกี่รูปที่มี upload_session_id
SELECT
    'Total Images' AS Type,
    COUNT(*) AS Count
FROM Images
WHERE status = 'active'

UNION ALL

SELECT
    'With Session ID' AS Type,
    COUNT(*) AS Count
FROM Images
WHERE status = 'active' AND upload_session_id IS NOT NULL

UNION ALL

SELECT
    'Without Session ID (NULL)' AS Type,
    COUNT(*) AS Count
FROM Images
WHERE status = 'active' AND upload_session_id IS NULL

ORDER BY Type DESC;

-- 2. ตรวจสอบรูปภาพล่าสุด 10 รูป
SELECT TOP 10
    image_id,
    lot_id,
    file_name,
    upload_session_id,
    uploaded_at,
    CASE
        WHEN upload_session_id IS NULL THEN 'NULL (ปัญหา!)'
        ELSE 'OK'
    END AS Status
FROM Images
WHERE status = 'active'
ORDER BY uploaded_at DESC;

-- 3. ตรวจสอบแต่ละ Lot ว่ามีรูปที่ NULL กับไม่ NULL ปนกันไหม
SELECT
    l.lot_number,
    CONVERT(DATE, i.image_date) AS image_date,
    SUM(CASE WHEN i.upload_session_id IS NULL THEN 1 ELSE 0 END) AS null_count,
    SUM(CASE WHEN i.upload_session_id IS NOT NULL THEN 1 ELSE 0 END) AS with_session_count,
    COUNT(*) AS total_count
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE i.status = 'active'
GROUP BY l.lot_number, CONVERT(DATE, i.image_date)
HAVING SUM(CASE WHEN i.upload_session_id IS NULL THEN 1 ELSE 0 END) > 0
ORDER BY total_count DESC;

PRINT 'ถ้าเห็นรูปที่มี upload_session_id = NULL แสดงว่านี่คือสาเหตุของปัญหา!';
