# คู่มือการแก้ไขปัญหารูปภาพปนกัน (Migration Guide)

## 📋 สรุปปัญหา

**ปัญหาเดิม:**
- เมื่อ upload รูปภาพด้วย Lot เดียวกันในวันเดียวกันหลายครั้ง รูปจะปนกัน
- ตัวอย่าง: Upload Lot "ABC123" เช้า 5 รูป, บ่าย 10 รูป → เวลาดูจะเห็นรวมกัน 15 รูป

**สาเหตุ:**
- Database ไม่มีฟิลด์แยก session การ upload
- Query ดึงรูปทั้งหมดที่มี Lot และวันที่เดียวกัน ไม่สนใจว่าอัปโหลดต่างเวลากัน

**วิธีแก้:**
- เพิ่มฟิลด์ `upload_session_id` ในตาราง Images
- แต่ละครั้งที่ upload จะมี session_id เฉพาะตัว
- ข้อมูลเก่าจะถูก migrate โดยแยก session ตามช่วงเวลา (ห่างกัน > 1 ชั่วโมง = คนละ session)

---

## 🚀 ขั้นตอนการ Migrate (ทำตามลำดับ)

### ขั้นตอนที่ 1: สำรองข้อมูล (BACKUP) ⚠️

```sql
-- Run ใน SQL Server Management Studio
USE [RC_QC_Line]
GO

-- Backup Images table
SELECT * INTO Images_Backup_20251031
FROM Images;

-- Verify backup
SELECT COUNT(*) as original_count FROM Images;
SELECT COUNT(*) as backup_count FROM Images_Backup_20251031;
```

**✅ ตรวจสอบ:** ตัวเลขทั้ง 2 ต้องเท่ากัน

---

### ขั้นตอนที่ 2: เพิ่ม Column และ Migrate ข้อมูล

```bash
# เปิด SQL Server Management Studio
# ไปที่ RC_QC_Line database
# เปิดไฟล์: migration_add_session_id.sql
# กด Execute (F5)
```

**Script จะทำอะไร:**
1. เพิ่ม column `upload_session_id BIGINT NULL`
2. Migrate ข้อมูลเก่าโดยแยก session ตามช่วงเวลา:
   - รูปที่ upload ห่างกัน < 1 ชม. = session เดียวกัน
   - รูปที่ upload ห่างกัน > 1 ชม. = คนละ session
3. สร้าง index สำหรับ query ที่เร็วขึ้น

**ตัวอย่าง Output ที่ถูกต้อง:**
```
Migration completed!
Records with session_id: 150
Records without session_id: 0
```

---

### ขั้นตอนที่ 3: Update Stored Procedures

```bash
# เปิด SQL Server Management Studio
# เปิดไฟล์: update_stored_procedures.sql
# กด Execute (F5)
```

**Script จะทำอะไร:**
1. ลบ stored procedures เก่า
2. สร้าง procedures ใหม่:
   - `sp_GetSessionsByLotAndDate` - ดูว่ามีกี่ session
   - `sp_GetImagesByLotAndDateAndSession` - ดึงรูปตาม session
   - `sp_GetImagesByLotAndDate` (updated) - เข้ากันได้กับโค้ดเก่า
   - `sp_UploadImage` (updated) - รองรับ session_id

**ตัวอย่าง Output ที่ถูกต้อง:**
```
Stored procedures updated successfully!

New procedures created:
  - sp_GetSessionsByLotAndDate (NEW)
  - sp_GetImagesByLotAndDateAndSession (NEW)
  ...
```

---

### ขั้นตอนที่ 4: Deploy โค้ดใหม่

```bash
# บน server ที่รันแอปพลิเคชัน

# 1. Pull code ใหม่
cd /path/to/RC_QC_Line
git pull origin claude/check-code-status-011CUec6DnkJr74HUjq8mZ51

# 2. Restart application
npm restart
# หรือ
pm2 restart rc_qc_line
```

---

### ขั้นตอนที่ 5: ทดสอบระบบ

#### 5.1 ทดสอบ Upload ใหม่

1. เปิด LINE แชทกับบอท
2. พิมพ์ `#up TEST001`
3. ส่งรูป 3 รูป
4. รอจนอัปโหลดเสร็จ
5. พิมพ์ `#up TEST001` อีกครั้ง (Lot เดียวกัน!)
6. ส่งรูป 2 รูปอีก
7. รอจนอัปโหลดเสร็จ

**ผลลัพธ์ที่คาดหวัง:**
- ครั้งที่ 1: บันทึก 3 รูป
- ครั้งที่ 2: บันทึก 2 รูป (คนละ session)

#### 5.2 ทดสอบดูรูป

```
พิมพ์: #view TEST001
เลือกวันที่วันนี้
```

**ผลลัพธ์ที่คาดหวัง:**
- เห็นเฉพาะรูป session ล่าสุด (2 รูป)
- **ไม่เห็นรูป session แรก (3 รูป) ปนเข้ามา** ✅

#### 5.3 ตรวจสอบใน Database

```sql
-- ดูว่ามี session อะไรบ้างสำหรับ Lot TEST001
EXEC sp_GetSessionsByLotAndDate
  @LotNumber = 'TEST001',
  @ImageDate = '2025-10-31';

-- ผลลัพธ์ควรแสดง 2 sessions:
-- Session 1: 3 images (เช้า)
-- Session 2: 2 images (บ่าย)
```

---

## 🔄 การ Rollback (กรณีมีปัญหา)

⚠️ **ใช้เฉพาะเมื่อ migration ล้มเหลว**

```bash
# เปิด SQL Server Management Studio
# เปิดไฟล์: migration_rollback.sql
# กด Execute (F5)

# Restore จาก backup
USE [RC_QC_Line]
GO

DROP TABLE Images;
GO

SELECT * INTO Images
FROM Images_Backup_20251031;
GO

# Revert code
git checkout HEAD~1
npm restart
```

---

## 📊 ตรวจสอบผลลัพธ์

### ก่อน Migration

```sql
-- ดูรูปทั้งหมดของ Lot ABC123 วันที่ 31 ต.ค.
SELECT * FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE l.lot_number = 'ABC123'
  AND CONVERT(DATE, i.image_date) = '2025-10-31'
ORDER BY uploaded_at;

-- ผลลัพธ์: รูปทั้งหมด 15 รูป (5 + 10) ปนกัน
```

### หลัง Migration

```sql
-- ดู sessions ทั้งหมด
EXEC sp_GetSessionsByLotAndDate
  @LotNumber = 'ABC123',
  @ImageDate = '2025-10-31';

-- ผลลัพธ์: แสดง 2 sessions
-- Session 1: 09:00, 5 images
-- Session 2: 14:00, 10 images

-- ดูรูปของ session ล่าสุด
EXEC sp_GetImagesByLotAndDateAndSession
  @LotNumber = 'ABC123',
  @ImageDate = '2025-10-31',
  @SessionId = NULL;  -- NULL = latest session

-- ผลลัพธ์: เฉพาะ 10 รูปของ session ที่ 2 (14:00)
```

---

## ✅ Checklist

- [ ] สำรอง database แล้ว
- [ ] รัน `migration_add_session_id.sql` สำเร็จ
- [ ] รัน `update_stored_procedures.sql` สำเร็จ
- [ ] Verify: `SELECT COUNT(*) FROM Images WHERE upload_session_id IS NOT NULL` = ทุก record
- [ ] Deploy code ใหม่
- [ ] Restart application
- [ ] ทดสอบ upload 2 ครั้ง (Lot เดียวกัน)
- [ ] ทดสอบดูรูป → เห็นเฉพาะ session ล่าสุด
- [ ] ตรวจสอบ log ไม่มี error

---

## 🆘 Troubleshooting

### ปัญหา: Migration script error

```sql
-- ตรวจสอบว่า column มีอยู่แล้วหรือไม่
SELECT * FROM sys.columns
WHERE object_id = OBJECT_ID(N'[dbo].[Images]')
AND name = 'upload_session_id';

-- ถ้ามี: Skip migration, ไปทำ update stored procedures
-- ถ้าไม่มี: ลอง run migration อีกครั้ง
```

### ปัญหา: Application error หลัง deploy

```bash
# ดู log
tail -f logs/error.log

# ตรวจสอบว่า database connection ปกติ
# Restart application
pm2 restart rc_qc_line
```

### ปัญหา: ยังเห็นรูปปนกันอยู่

```sql
-- ตรวจสอบว่า stored procedure update แล้วหรือยัง
SELECT OBJECT_DEFINITION(OBJECT_ID('sp_GetImagesByLotAndDate'));

-- ควรเห็น: EXEC [dbo].[sp_GetImagesByLotAndDateAndSession]
-- ถ้าไม่เห็น: รัน update_stored_procedures.sql อีกครั้ง
```

---

## 📝 หมายเหตุ

1. **ข้อมูลเก่าปลอดภัย**: Migration ไม่ลบหรือแก้ไขข้อมูลเก่า แค่เพิ่ม column ใหม่
2. **Backward Compatible**: โค้ดเก่ายังใช้งานได้ เพราะ `upload_session_id` เป็น NULL ได้
3. **Performance**: เพิ่ม index แล้ว query จะเร็วขึ้น
4. **Future Uploads**: รูปที่อัปโหลดหลัง migration จะมี session_id อัตโนมัติ

---

## 📞 ติดต่อ

หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อทีมพัฒนา
