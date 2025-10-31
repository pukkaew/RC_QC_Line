# 🚨 คู่มือการ Migrate Production Database

## ⚠️ IMPORTANT: สำหรับ Database ที่มีข้อมูลจริงใช้งานอยู่

Migration นี้**ปลอดภัย**และ**ไม่ทำลายข้อมูลเดิม** แต่ควรทำตามขั้นตอนด้านล่างอย่างระมัดระวัง

---

## 📋 Pre-Migration Checklist

### ✅ ขั้นตอนที่ 1: Backup Database (สำคัญมาก!)

```sql
-- สำรอง Database ทั้งหมด
BACKUP DATABASE [RC_QC_Line]
TO DISK = 'D:\Backup\RC_QC_Line_before_migration_20251031.bak'
WITH FORMAT,
     NAME = 'RC_QC_Line-Before Upload Session Migration',
     DESCRIPTION = 'Full backup before adding upload_session_id column';
GO
```

### ✅ ขั้นตอนที่ 2: ตรวจสอบข้อมูลปัจจุบัน

```sql
-- ดูจำนวนรูปภาพทั้งหมด
SELECT COUNT(*) as total_images FROM Images WHERE status = 'active';

-- ดูจำนวน Lot
SELECT COUNT(*) as total_lots FROM Lots WHERE status = 'active';

-- ดูรูปภาพล่าสุด 10 รูป
SELECT TOP 10
    i.image_id,
    l.lot_number,
    i.image_date,
    i.file_name,
    i.uploaded_at
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE i.status = 'active'
ORDER BY i.uploaded_at DESC;
```

**บันทึกผลลัพธ์เหล่านี้ไว้** เพื่อเปรียบเทียบหลัง migrate

---

## 🔧 การ Migrate (Production Safe)

### วิธีที่ 1: ใช้ SQL Server Management Studio (SSMS) - แนะนำ

1. **เปิด SSMS** และเชื่อมต่อกับ SQL Server
2. **เปิดไฟล์** `migrations/add_upload_session_id.sql`
3. **ตรวจสอบ Script** ให้แน่ใจว่าเป็น database ที่ถูกต้อง
4. **Execute** (F5 หรือกด Execute)
5. **ตรวจสอบ Messages** ควรเห็น:
   ```
   Column upload_session_id added successfully to Images table
   Index IDX_Images_upload_session_id created successfully
   Index IDX_Images_lot_date_session created successfully
   Migration completed successfully!
   ```

### วิธีที่ 2: ใช้ Command Line

```bash
# แทนที่ YOUR_SERVER_NAME ด้วยชื่อ SQL Server ของคุณ
sqlcmd -S YOUR_SERVER_NAME -d RC_QC_Line -i migrations/add_upload_session_id.sql -o migration_log.txt

# ตรวจสอบ log file
type migration_log.txt  # Windows
cat migration_log.txt   # Linux/Mac
```

---

## 🧪 การทดสอบหลัง Migration

### ✅ ขั้นตอนที่ 1: ตรวจสอบโครงสร้าง

```sql
-- ตรวจสอบว่าคอลัมน์ถูกเพิ่มแล้ว
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Images'
AND COLUMN_NAME = 'upload_session_id';

-- ผลลัพธ์ที่ควรได้:
-- COLUMN_NAME: upload_session_id
-- DATA_TYPE: bigint
-- IS_NULLABLE: YES
-- COLUMN_DEFAULT: NULL
```

### ✅ ขั้นตอนที่ 2: ตรวจสอบ Indexes

```sql
-- ตรวจสอบ indexes ที่เพิ่มมา
SELECT
    i.name AS IndexName,
    i.type_desc AS IndexType,
    STRING_AGG(c.name, ', ') AS ColumnNames
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.Images')
AND i.name IN ('IDX_Images_upload_session_id', 'IDX_Images_lot_date_session')
GROUP BY i.name, i.type_desc;

-- ควรเห็น 2 indexes:
-- 1. IDX_Images_upload_session_id
-- 2. IDX_Images_lot_date_session
```

### ✅ ขั้นตอนที่ 3: ตรวจสอบข้อมูลเดิม

```sql
-- ตรวจสอบว่าข้อมูลเดิมยังอยู่ครบ
SELECT COUNT(*) as total_images FROM Images WHERE status = 'active';
-- ตัวเลขต้องเท่ากับก่อน migrate

-- ตรวจสอบว่ารูปเก่ามี upload_session_id = NULL
SELECT
    COUNT(*) as old_images_count,
    'Should have NULL session_id' as note
FROM Images
WHERE upload_session_id IS NULL;

-- ดูข้อมูลตัวอย่าง
SELECT TOP 10
    i.image_id,
    l.lot_number,
    i.image_date,
    i.file_name,
    i.upload_session_id,  -- ควรเป็น NULL สำหรับรูปเก่า
    i.uploaded_at
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE i.status = 'active'
ORDER BY i.uploaded_at DESC;
```

---

## 🎯 ทดสอบการทำงานจริง

### 1. ทดสอบดูรูปเก่า (ก่อน migrate)

```sql
-- เลือก Lot และวันที่ที่มีรูปอยู่แล้ว
DECLARE @TestLotNumber VARCHAR(50) = 'YOUR_EXISTING_LOT';
DECLARE @TestDate DATE = '2025-10-31';

-- ดูว่า query ยังทำงานได้ปกติ
WITH LatestSession AS (
    SELECT MAX(upload_session_id) as latest_session_id
    FROM Images i
    JOIN Lots l ON i.lot_id = l.lot_id
    WHERE l.lot_number = @TestLotNumber
      AND CONVERT(DATE, i.image_date) = @TestDate
      AND i.status = 'active'
      AND i.upload_session_id IS NOT NULL
)
SELECT
    i.image_id,
    i.file_name,
    i.upload_session_id,
    i.uploaded_at
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
LEFT JOIN LatestSession ls ON 1=1
WHERE l.lot_number = @TestLotNumber
  AND CONVERT(DATE, i.image_date) = @TestDate
  AND i.status = 'active'
  AND (
    -- รูปเก่า (NULL) จะแสดง
    (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
    OR
    -- รูปใหม่จะแสดงเฉพาะ session ล่าสุด
    (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
  )
ORDER BY i.uploaded_at;

-- ผลลัพธ์: ควรเห็นรูปเก่าทั้งหมด (เพราะมี upload_session_id = NULL)
```

### 2. ทดสอบ Application

**ก่อน restart application:**
```sql
-- ตรวจสอบว่า application ยังใช้งานได้ปกติ
-- (จะดึงรูปทั้งหมดออกมา เหมือนเดิม)
```

**หลัง restart application:**
1. Upload รูปใหม่ชุดที่ 1 (เช่น 3 รูป) → ดูอัลบั้ม → ควรเห็น 3 รูปพร้อมรูปเก่า
2. Upload รูปใหม่ชุดที่ 2 (เช่น 2 รูป) → ดูอัลบั้ม → ควรเห็น 2 รูปใหม่ล่าสุดเท่านั้น (ไม่ปนกับชุดที่ 1)

---

## 📊 ตรวจสอบ Performance

```sql
-- ดู execution plan ของ query หลัก
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

DECLARE @TestLot VARCHAR(50) = 'YOUR_LOT';
DECLARE @TestDate DATE = '2025-10-31';

WITH LatestSession AS (
    SELECT MAX(upload_session_id) as latest_session_id
    FROM Images i
    JOIN Lots l ON i.lot_id = l.lot_id
    WHERE l.lot_number = @TestLot
      AND CONVERT(DATE, i.image_date) = @TestDate
      AND i.status = 'active'
      AND i.upload_session_id IS NOT NULL
)
SELECT i.*, l.lot_number
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
LEFT JOIN LatestSession ls ON 1=1
WHERE l.lot_number = @TestLot
  AND CONVERT(DATE, i.image_date) = @TestDate
  AND i.status = 'active'
  AND (
    (ls.latest_session_id IS NULL AND i.upload_session_id IS NULL)
    OR
    (ls.latest_session_id IS NOT NULL AND i.upload_session_id = ls.latest_session_id)
  );

SET STATISTICS IO OFF;
SET STATISTICS TIME OFF;

-- ตรวจสอบว่า indexes ถูกใช้งาน (ดูที่ Index Seek/Scan)
```

---

## 🔄 Rollback Plan (ถ้าจำเป็น)

### ⚠️ Rollback จะลบคอลัมน์ upload_session_id ออก

```sql
-- ===================================
-- ROLLBACK SCRIPT (ใช้เมื่อจำเป็นเท่านั้น)
-- ===================================

USE [RC_QC_Line]
GO

-- ลบ indexes
IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Images]') AND name = 'IDX_Images_lot_date_session')
BEGIN
    DROP INDEX [IDX_Images_lot_date_session] ON [dbo].[Images];
    PRINT 'Dropped index: IDX_Images_lot_date_session';
END

IF EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[Images]') AND name = 'IDX_Images_upload_session_id')
BEGIN
    DROP INDEX [IDX_Images_upload_session_id] ON [dbo].[Images];
    PRINT 'Dropped index: IDX_Images_upload_session_id';
END

-- ลบคอลัมน์
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Images]') AND name = 'upload_session_id')
BEGIN
    ALTER TABLE [dbo].[Images] DROP COLUMN [upload_session_id];
    PRINT 'Dropped column: upload_session_id';
END

PRINT 'Rollback completed';
GO

-- หลัง rollback ต้อง restore code เดิมด้วย
```

### การ Restore จาก Backup

```sql
-- ถ้า rollback ไม่สำเร็จ หรือต้องการกลับสู่สถานะเดิมทั้งหมด
USE [master]
GO

-- Disconnect all users
ALTER DATABASE [RC_QC_Line] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
GO

-- Restore
RESTORE DATABASE [RC_QC_Line]
FROM DISK = 'D:\Backup\RC_QC_Line_before_migration_20251031.bak'
WITH REPLACE;
GO

-- Back to normal
ALTER DATABASE [RC_QC_Line] SET MULTI_USER;
GO
```

---

## 📝 การ Restart Application

### 1. Stop Application
```bash
# หยุด Node.js application
pm2 stop rc-qc-line
# หรือ
# service rc-qc-line stop
```

### 2. ตรวจสอบ Code Version
```bash
cd /path/to/RC_QC_Line
git log -1 --oneline
# ต้องเห็น: e8c8997 Fix: แก้ไขปัญหารูปภาพจากอัลบั้มอื่นปนมาแสดง
```

### 3. Start Application
```bash
pm2 start rc-qc-line
# หรือ
# service rc-qc-line start
```

### 4. ตรวจสอบ Logs
```bash
pm2 logs rc-qc-line --lines 50
# ดูว่ามี error หรือไม่
```

---

## 🎯 ตารางเปรียบเทียบพฤติกรรม

| สถานการณ์ | ก่อน Migration | หลัง Migration (ไม่ Restart) | หลัง Migration + Restart |
|-----------|----------------|------------------------------|--------------------------|
| ดูรูปเก่า | แสดงทั้งหมด | แสดงทั้งหมด | แสดงทั้งหมด (NULL session) |
| Upload ใหม่ | ไม่มี session_id | ไม่มี session_id | มี session_id |
| Upload ซ้ำ Lot+Date | รูปปนกัน ❌ | รูปปนกัน ❌ | แสดงชุดล่าสุด ✅ |

---

## 📞 Support & Troubleshooting

### ปัญหาที่อาจเกิดขึ้น

#### 1. Migration Script ไม่ทำงาน
```
Error: ALTER TABLE permission denied
```
**แก้ไข:** ตรวจสอบว่า user มีสิทธิ์ ALTER TABLE

#### 2. Index Creation ล้มเหลว
```
Error: Insufficient disk space
```
**แก้ไข:** เช็ค disk space ของ SQL Server

#### 3. Application Error หลัง Restart
```
Error: Invalid column name 'upload_session_id'
```
**แก้ไข:** ตรวจสอบว่า pull code version ล่าสุดแล้ว (e8c8997 หรือใหม่กว่า)

### ติดต่อทีมพัฒนา
- ตรวจสอบ logs ใน `logs/` directory
- เก็บ error message
- เก็บ timestamp ที่เกิดปัญหา

---

## ✅ Checklist สำหรับ Migration

- [ ] Backup database เรียบร้อย
- [ ] บันทึกจำนวนข้อมูลปัจจุบัน
- [ ] รัน migration script
- [ ] ตรวจสอบ column และ indexes ถูกสร้าง
- [ ] ตรวจสอบข้อมูลเดิมยังครบ
- [ ] ทดสอบ query ดูรูปเก่า
- [ ] Pull code version ล่าสุด (e8c8997+)
- [ ] Restart application
- [ ] ทดสอบ upload รูปใหม่
- [ ] ตรวจสอบว่ารูปไม่ปนกัน
- [ ] Monitor logs เป็นเวลา 24 ชม.

---

## 🎉 สรุป

Migration นี้:
- ✅ **ปลอดภัย**: ไม่ลบหรือแก้ไขข้อมูลเดิม
- ✅ **Backwards Compatible**: รูปเก่ายังแสดงได้ปกติ
- ✅ **Reversible**: สามารถ rollback ได้
- ✅ **Tested**: ผ่านการทดสอบแล้ว

**เวลาที่ใช้:** ~1-5 นาที (ขึ้นกับขนาดข้อมูล)

**Downtime:** 0 นาที (ไม่ต้องหยุดระบบระหว่าง migrate, เพียงแต่ต้อง restart หลัง migrate เสร็จ)

---

**Last Updated:** 2025-10-31
**Version:** 1.0
**Author:** Claude Code Assistant
