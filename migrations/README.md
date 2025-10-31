# Database Migration Guide

## Overview
This directory contains SQL migration scripts for the RC_QC_Line database.

## Migration: Add upload_session_id Column

### Purpose
Add `upload_session_id` column to the `Images` table to support filtering images by upload session. This prevents mixing images from different uploads when viewing albums.

### What Changed
- **New Column:** `upload_session_id` (BIGINT, NULL)
- **New Index:** `IDX_Images_upload_session_id`
- **New Composite Index:** `IDX_Images_lot_date_session`

### How to Apply Migration

#### For Existing Database
Run the migration script on your existing database:

```sql
-- Execute this script on your SQL Server
sqlcmd -S your_server -d RC_QC_Line -i add_upload_session_id.sql
```

Or open `add_upload_session_id.sql` in SQL Server Management Studio (SSMS) and execute it.

#### For New Database Setup
Use the updated setup file:

```sql
-- Use the new setup file which includes upload_session_id
sqlcmd -S your_server -i RC_QC_Line_setup_v2.sql
```

### Migration Details

#### Before Migration
```sql
CREATE TABLE [dbo].[Images](
    [image_id] [int] IDENTITY(1,1) NOT NULL,
    [lot_id] [int] NOT NULL,
    [image_date] [date] NOT NULL,
    [file_name] [varchar](255) NOT NULL,
    [file_path] [varchar](512) NOT NULL,
    [original_size] [int] NOT NULL,
    [compressed_size] [int] NOT NULL,
    [mime_type] [varchar](50) NOT NULL,
    [uploaded_by] [varchar](50) NOT NULL,
    [uploaded_at] [datetime] NOT NULL,
    [status] [varchar](20) NOT NULL
)
```

#### After Migration
```sql
CREATE TABLE [dbo].[Images](
    [image_id] [int] IDENTITY(1,1) NOT NULL,
    [lot_id] [int] NOT NULL,
    [image_date] [date] NOT NULL,
    [file_name] [varchar](255) NOT NULL,
    [file_path] [varchar](512) NOT NULL,
    [original_size] [int] NOT NULL,
    [compressed_size] [int] NOT NULL,
    [mime_type] [varchar](50) NOT NULL,
    [uploaded_by] [varchar](50) NOT NULL,
    [uploaded_at] [datetime] NOT NULL,
    [upload_session_id] [bigint] NULL,      -- NEW COLUMN
    [status] [varchar](20) NOT NULL
)
```

### Important Notes

1. **Backwards Compatibility:**
   - The column is nullable (`NULL`)
   - Existing images will have `NULL` upload_session_id
   - New uploads will automatically populate this field
   - Queries handle both NULL (old data) and non-NULL (new data) values

2. **Performance:**
   - Two new indexes are created for optimal query performance
   - Filtered indexes only include non-NULL session IDs to save space

3. **Data Safety:**
   - Migration is **non-destructive**
   - No existing data will be lost or modified
   - Can be applied to production database safely

### Verification

After applying the migration, verify the changes:

```sql
-- Check if column exists
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Images'
AND COLUMN_NAME = 'upload_session_id';

-- Check indexes
SELECT
    i.name AS IndexName,
    COL_NAME(ic.object_id, ic.column_id) AS ColumnName
FROM sys.indexes i
INNER JOIN sys.index_columns ic
    ON i.object_id = ic.object_id AND i.index_id = ic.index_id
WHERE i.object_id = OBJECT_ID('dbo.Images')
AND i.name LIKE '%session%';

-- Test query (should return latest session only)
SELECT
    l.lot_number,
    CONVERT(DATE, i.image_date) as image_date,
    MAX(i.upload_session_id) as latest_session,
    COUNT(*) as image_count
FROM Images i
JOIN Lots l ON i.lot_id = l.lot_id
WHERE i.status = 'active'
GROUP BY l.lot_number, CONVERT(DATE, i.image_date);
```

### Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove indexes
DROP INDEX IF EXISTS [IDX_Images_upload_session_id] ON [dbo].[Images];
DROP INDEX IF EXISTS [IDX_Images_lot_date_session] ON [dbo].[Images];

-- Remove column (WARNING: This will delete the session ID data)
ALTER TABLE [dbo].[Images]
DROP COLUMN [upload_session_id];
```

⚠️ **Warning:** Rollback will lose all upload_session_id data. Only rollback if absolutely necessary.

## Support

If you encounter any issues during migration, please:
1. Check the SQL Server error log
2. Verify you have sufficient permissions (ALTER TABLE, CREATE INDEX)
3. Ensure the database is in SIMPLE or FULL recovery mode
4. Contact the development team

## Migration History

| Date | Version | Description |
|------|---------|-------------|
| 2025-10-31 | 1.0 | Added upload_session_id column and indexes |
