-- Fix Script: แก้ไขปัญหา Lot ซ้ำและรูปภาพปนกัน
-- วันที่: 2025-10-31
-- คำเตือน: สำรอง database ก่อนรัน script นี้!

USE [RC_QC_Line]
GO

PRINT '========================================='
PRINT 'เริ่มแก้ไขปัญหา Lot ซ้ำ'
PRINT '========================================='
PRINT ''

-- =============================================
-- STEP 1: Backup ข้อมูลก่อน
-- =============================================
PRINT 'STEP 1: สำรองข้อมูล...'
PRINT '-------------------------------------------'

-- สร้างตาราง backup ถ้ายังไม่มี
IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'Lots_Backup_Fix')
BEGIN
    SELECT * INTO Lots_Backup_Fix FROM Lots;
    PRINT 'สำรอง Lots → Lots_Backup_Fix: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows'
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE name = 'Images_Backup_Fix')
BEGIN
    SELECT * INTO Images_Backup_Fix FROM Images;
    PRINT 'สำรอง Images → Images_Backup_Fix: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' rows'
END

PRINT 'สำรองข้อมูลเสร็จสิ้น'
PRINT ''

-- =============================================
-- STEP 2: หา Lot ที่ซ้ำกัน (trim และ uppercase)
-- =============================================
PRINT 'STEP 2: ตรวจสอบ Lot ที่ซ้ำกัน...'
PRINT '-------------------------------------------'

-- หา Lot ที่มีชื่อเหมือนกันเมื่อ trim และ uppercase
WITH DuplicateLots AS (
    SELECT
        UPPER(LTRIM(RTRIM(lot_number))) as normalized_lot,
        MIN(lot_id) as keep_lot_id,  -- เก็บ ID ที่เก่าที่สุด
        COUNT(*) as duplicate_count,
        STRING_AGG(CAST(lot_id AS VARCHAR), ', ') as all_lot_ids,
        STRING_AGG(lot_number, ' | ') as all_lot_names
    FROM Lots
    GROUP BY UPPER(LTRIM(RTRIM(lot_number)))
    HAVING COUNT(*) > 1
)
SELECT * FROM DuplicateLots;

DECLARE @DuplicateCount INT = @@ROWCOUNT;

IF @DuplicateCount = 0
BEGIN
    PRINT 'ไม่พบ Lot ซ้ำ'
END
ELSE
BEGIN
    PRINT '⚠️ พบ Lot ซ้ำจำนวน: ' + CAST(@DuplicateCount AS VARCHAR) + ' กลุ่ม'

    -- =============================================
    -- STEP 3: Merge Lot ซ้ำ
    -- =============================================
    PRINT ''
    PRINT 'STEP 3: แก้ไข Lot ซ้ำ...'
    PRINT '-------------------------------------------'

    -- สร้าง temporary table เพื่อเก็บข้อมูล Lot ที่ต้องแก้ไข
    CREATE TABLE #LotMapping (
        old_lot_id INT,
        new_lot_id INT,
        old_lot_name VARCHAR(50),
        normalized_name VARCHAR(50)
    );

    -- Insert mapping ของ Lot ที่ซ้ำ
    INSERT INTO #LotMapping (old_lot_id, new_lot_id, old_lot_name, normalized_name)
    SELECT
        l.lot_id as old_lot_id,
        d.keep_lot_id as new_lot_id,
        l.lot_number as old_lot_name,
        d.normalized_lot as normalized_name
    FROM Lots l
    JOIN (
        SELECT
            UPPER(LTRIM(RTRIM(lot_number))) as normalized_lot,
            MIN(lot_id) as keep_lot_id
        FROM Lots
        GROUP BY UPPER(LTRIM(RTRIM(lot_number)))
        HAVING COUNT(*) > 1
    ) d ON UPPER(LTRIM(RTRIM(l.lot_number))) = d.normalized_lot
    WHERE l.lot_id <> d.keep_lot_id;  -- เฉพาะ Lot ที่จะถูกลบ

    PRINT 'พบ Lot ที่ต้องแก้ไข: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' รายการ'

    -- แสดงรายการที่จะแก้ไข
    SELECT * FROM #LotMapping;

    -- =============================================
    -- STEP 4: อัพเดทรูปภาพให้ชี้ไปที่ Lot ที่ถูกต้อง
    -- =============================================
    PRINT ''
    PRINT 'STEP 4: อัพเดทรูปภาพ...'
    PRINT '-------------------------------------------'

    -- Update Images ให้ใช้ lot_id ที่ถูกต้อง
    UPDATE i
    SET i.lot_id = m.new_lot_id
    FROM Images i
    JOIN #LotMapping m ON i.lot_id = m.old_lot_id
    WHERE i.status = 'active';

    PRINT 'อัพเดทรูปภาพ: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' รูป'

    -- =============================================
    -- STEP 5: ลบ Lot ซ้ำที่ไม่ใช้แล้ว
    -- =============================================
    PRINT ''
    PRINT 'STEP 5: ลบ Lot ซ้ำ...'
    PRINT '-------------------------------------------'

    -- Delete Lot ที่ซ้ำและไม่มีรูปแล้ว
    DELETE l
    FROM Lots l
    JOIN #LotMapping m ON l.lot_id = m.old_lot_id
    WHERE NOT EXISTS (
        SELECT 1 FROM Images i
        WHERE i.lot_id = l.lot_id
        AND i.status = 'active'
    );

    PRINT 'ลบ Lot ซ้ำ: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' รายการ'

    -- Clean up
    DROP TABLE #LotMapping;
END

PRINT ''

-- =============================================
-- STEP 6: อัพเดท lot_number ให้เป็น trimmed version
-- =============================================
PRINT 'STEP 6: ทำความสะอาด lot_number (trim spaces)...'
PRINT '-------------------------------------------'

UPDATE Lots
SET lot_number = LTRIM(RTRIM(lot_number))
WHERE lot_number <> LTRIM(RTRIM(lot_number));

PRINT 'อัพเดท lot_number: ' + CAST(@@ROWCOUNT AS VARCHAR) + ' รายการ'
PRINT ''

-- =============================================
-- STEP 7: ตรวจสอบผลลัพธ์
-- =============================================
PRINT 'STEP 7: ตรวจสอบผลลัพธ์...'
PRINT '-------------------------------------------'

-- ตรวจสอบว่ายังมี Lot ซ้ำไหม
WITH DuplicateCheck AS (
    SELECT
        UPPER(LTRIM(RTRIM(lot_number))) as normalized_lot,
        COUNT(*) as count
    FROM Lots
    GROUP BY UPPER(LTRIM(RTRIM(lot_number)))
    HAVING COUNT(*) > 1
)
SELECT * FROM DuplicateCheck;

IF @@ROWCOUNT = 0
BEGIN
    PRINT '✅ ไม่มี Lot ซ้ำแล้ว!'
END
ELSE
BEGIN
    PRINT '⚠️ ยังมี Lot ซ้ำอยู่ ต้องตรวจสอบเพิ่มเติม'
END

PRINT ''

-- แสดงสถิติหลังแก้ไข
PRINT 'สถิติหลังแก้ไข:'
PRINT '  - จำนวน Lot ทั้งหมด: ' + CAST((SELECT COUNT(*) FROM Lots) AS VARCHAR)
PRINT '  - จำนวนรูปภาพทั้งหมด: ' + CAST((SELECT COUNT(*) FROM Images WHERE status = 'active') AS VARCHAR)
PRINT ''

PRINT '========================================='
PRINT 'เสร็จสิ้นการแก้ไข'
PRINT '========================================='
PRINT ''
PRINT 'หมายเหตุ:'
PRINT '  - ข้อมูลสำรองอยู่ใน Lots_Backup_Fix และ Images_Backup_Fix'
PRINT '  - หาก rollback: DROP TABLE Lots, Images; SELECT * INTO Lots FROM Lots_Backup_Fix; ...'
PRINT ''
GO
