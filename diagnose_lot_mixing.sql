-- Diagnostic Script: ตรวจสอบปัญหารูปภาพปนกัน
-- วันที่: 2025-10-31

USE [RC_QC_Line]
GO

PRINT '========================================='
PRINT 'การตรวจสอบปัญหารูปภาพปนกัน'
PRINT '========================================='
PRINT ''

-- =============================================
-- 1. ตรวจสอบ Lot ที่มี lot_number คล้ายกัน (case-insensitive, space, etc.)
-- =============================================
PRINT '1. ตรวจสอบ Lot ที่อาจจะซ้ำกัน (case หรือ space):'
PRINT '-------------------------------------------'

SELECT
    lot_id,
    lot_number,
    LEN(lot_number) as length,
    CASE
        WHEN lot_number LIKE '% ' THEN 'มี space ท้าย'
        WHEN lot_number LIKE ' %' THEN 'มี space หน้า'
        ELSE 'OK'
    END as space_check,
    created_at
FROM Lots
ORDER BY UPPER(LTRIM(RTRIM(lot_number))), created_at;

PRINT ''
PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 2. หา Lot ที่มีชื่อเหมือนกันแต่ต่าง ID (case-insensitive)
-- =============================================
PRINT '2. Lot ที่มีชื่อเหมือนกันแต่ lot_id ต่างกัน:'
PRINT '-------------------------------------------'

WITH DuplicateLots AS (
    SELECT
        UPPER(LTRIM(RTRIM(lot_number))) as normalized_lot,
        COUNT(*) as count,
        STRING_AGG(CAST(lot_id AS VARCHAR), ', ') as lot_ids,
        STRING_AGG(lot_number, ' | ') as original_names
    FROM Lots
    GROUP BY UPPER(LTRIM(RTRIM(lot_number)))
    HAVING COUNT(*) > 1
)
SELECT * FROM DuplicateLots;

IF @@ROWCOUNT = 0
    PRINT 'ไม่พบ Lot ซ้ำ'
ELSE
    PRINT '⚠️ พบ Lot ซ้ำ! นี่อาจเป็นสาเหตุของปัญหา'

PRINT ''
PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 3. ตรวจสอบรูปภาพที่ lot_id ไม่ตรงกับ lot_number ที่คาดหวัง
-- =============================================
PRINT '3. ตรวจสอบรูปที่ Lot อาจจะผิด (ล่าสุด 20 รูป):'
PRINT '-------------------------------------------'

SELECT TOP 20
    i.image_id,
    i.lot_id,
    l.lot_number as actual_lot,
    i.file_name,
    i.image_date,
    i.uploaded_at,
    i.uploaded_by
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
ORDER BY i.uploaded_at DESC;

PRINT ''
PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 4. หารูปภาพที่มี lot_id เดียวกันแต่ควรเป็นคนละ Lot
-- ตรวจจาก file_name pattern
-- =============================================
PRINT '4. ตรวจสอบรูปที่อาจมีปัญหา (lot_id vs file_name):'
PRINT '-------------------------------------------'

SELECT
    i.image_id,
    i.lot_id,
    l.lot_number,
    i.file_name,
    i.image_date,
    i.uploaded_at
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE i.status = 'active'
ORDER BY i.uploaded_at DESC;

PRINT ''
PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 5. สถิติรูปภาพแต่ละ Lot
-- =============================================
PRINT '5. สถิติรูปภาพแต่ละ Lot:'
PRINT '-------------------------------------------'

SELECT
    l.lot_id,
    l.lot_number,
    COUNT(i.image_id) as image_count,
    MIN(i.uploaded_at) as first_upload,
    MAX(i.uploaded_at) as last_upload,
    COUNT(DISTINCT CONVERT(DATE, i.image_date)) as unique_dates
FROM Lots l
LEFT JOIN Images i ON l.lot_id = i.lot_id AND i.status = 'active'
GROUP BY l.lot_id, l.lot_number
ORDER BY last_upload DESC;

PRINT ''
PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 6. ตรวจสอบ session_id (ถ้ามี)
-- =============================================
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Images') AND name = 'upload_session_id')
BEGIN
    PRINT '6. ตรวจสอบ upload_session_id:'
    PRINT '-------------------------------------------'

    SELECT
        l.lot_number,
        i.upload_session_id,
        COUNT(*) as image_count,
        MIN(i.uploaded_at) as session_start,
        MAX(i.uploaded_at) as session_end
    FROM Images i
    JOIN Lots l ON i.lot_id = l.lot_id
    WHERE i.status = 'active'
        AND i.upload_session_id IS NOT NULL
    GROUP BY l.lot_number, i.upload_session_id
    ORDER BY session_start DESC;

    PRINT ''
END
ELSE
BEGIN
    PRINT '6. Column upload_session_id ยังไม่มี (ต้อง migrate)'
    PRINT ''
END

PRINT '-------------------------------------------'
PRINT ''

-- =============================================
-- 7. ตรวจสอบ Lot ที่มีรูปภาพในหลายวัน
-- =============================================
PRINT '7. Lot ที่มีรูปภาพหลายวัน (อาจมีรูปปนกัน):'
PRINT '-------------------------------------------'

WITH LotDates AS (
    SELECT
        l.lot_number,
        COUNT(DISTINCT CONVERT(DATE, i.image_date)) as date_count,
        STRING_AGG(CONVERT(VARCHAR, CONVERT(DATE, i.image_date), 120), ', ') as dates,
        COUNT(i.image_id) as total_images
    FROM Lots l
    JOIN Images i ON l.lot_id = i.lot_id
    WHERE i.status = 'active'
    GROUP BY l.lot_number
    HAVING COUNT(DISTINCT CONVERT(DATE, i.image_date)) > 1
)
SELECT * FROM LotDates
ORDER BY date_count DESC;

IF @@ROWCOUNT = 0
    PRINT 'ไม่พบ Lot ที่มีรูปหลายวัน'

PRINT ''
PRINT '========================================='
PRINT 'จบการตรวจสอบ'
PRINT '========================================='
GO
