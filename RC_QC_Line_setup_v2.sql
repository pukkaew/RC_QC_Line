USE [master]
GO
/****** Object:  Database [RC_QC_Line]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE DATABASE [RC_QC_Line]
 CONTAINMENT = NONE
 ON  PRIMARY
( NAME = N'RC_QC_Line', FILENAME = N'D:\Data\RC_QC_Line.mdf' , SIZE = 73728KB , MAXSIZE = UNLIMITED, FILEGROWTH = 65536KB )
 LOG ON
( NAME = N'RC_QC_Line_log', FILENAME = N'D:\Log\RC_QC_Line_log.ldf' , SIZE = 270336KB , MAXSIZE = 2048GB , FILEGROWTH = 65536KB )
 WITH CATALOG_COLLATION = DATABASE_DEFAULT
GO
ALTER DATABASE [RC_QC_Line] SET COMPATIBILITY_LEVEL = 150
GO
IF (1 = FULLTEXTSERVICEPROPERTY('IsFullTextInstalled'))
begin
EXEC [RC_QC_Line].[dbo].[sp_fulltext_database] @action = 'enable'
end
GO
ALTER DATABASE [RC_QC_Line] SET ANSI_NULL_DEFAULT OFF
GO
ALTER DATABASE [RC_QC_Line] SET ANSI_NULLS OFF
GO
ALTER DATABASE [RC_QC_Line] SET ANSI_PADDING OFF
GO
ALTER DATABASE [RC_QC_Line] SET ANSI_WARNINGS OFF
GO
ALTER DATABASE [RC_QC_Line] SET ARITHABORT OFF
GO
ALTER DATABASE [RC_QC_Line] SET AUTO_CLOSE OFF
GO
ALTER DATABASE [RC_QC_Line] SET AUTO_SHRINK OFF
GO
ALTER DATABASE [RC_QC_Line] SET AUTO_UPDATE_STATISTICS ON
GO
ALTER DATABASE [RC_QC_Line] SET CURSOR_CLOSE_ON_COMMIT OFF
GO
ALTER DATABASE [RC_QC_Line] SET CURSOR_DEFAULT  GLOBAL
GO
ALTER DATABASE [RC_QC_Line] SET CONCAT_NULL_YIELDS_NULL OFF
GO
ALTER DATABASE [RC_QC_Line] SET NUMERIC_ROUNDABORT OFF
GO
ALTER DATABASE [RC_QC_Line] SET QUOTED_IDENTIFIER OFF
GO
ALTER DATABASE [RC_QC_Line] SET RECURSIVE_TRIGGERS OFF
GO
ALTER DATABASE [RC_QC_Line] SET  DISABLE_BROKER
GO
ALTER DATABASE [RC_QC_Line] SET AUTO_UPDATE_STATISTICS_ASYNC OFF
GO
ALTER DATABASE [RC_QC_Line] SET DATE_CORRELATION_OPTIMIZATION OFF
GO
ALTER DATABASE [RC_QC_Line] SET TRUSTWORTHY OFF
GO
ALTER DATABASE [RC_QC_Line] SET ALLOW_SNAPSHOT_ISOLATION OFF
GO
ALTER DATABASE [RC_QC_Line] SET PARAMETERIZATION SIMPLE
GO
ALTER DATABASE [RC_QC_Line] SET READ_COMMITTED_SNAPSHOT OFF
GO
ALTER DATABASE [RC_QC_Line] SET HONOR_BROKER_PRIORITY OFF
GO
ALTER DATABASE [RC_QC_Line] SET RECOVERY FULL
GO
ALTER DATABASE [RC_QC_Line] SET  MULTI_USER
GO
ALTER DATABASE [RC_QC_Line] SET PAGE_VERIFY CHECKSUM
GO
ALTER DATABASE [RC_QC_Line] SET DB_CHAINING OFF
GO
ALTER DATABASE [RC_QC_Line] SET FILESTREAM( NON_TRANSACTED_ACCESS = OFF )
GO
ALTER DATABASE [RC_QC_Line] SET TARGET_RECOVERY_TIME = 60 SECONDS
GO
ALTER DATABASE [RC_QC_Line] SET DELAYED_DURABILITY = DISABLED
GO
ALTER DATABASE [RC_QC_Line] SET ACCELERATED_DATABASE_RECOVERY = OFF
GO
ALTER DATABASE [RC_QC_Line] SET QUERY_STORE = OFF
GO
USE [RC_QC_Line]
GO

/****** Object:  Table [dbo].[Images]    Script Date: 10/31/2025 - UPDATED with upload_session_id ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
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
	[upload_session_id] [bigint] NULL,
	[status] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED
(
	[image_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Lots]    Script Date: 10/31/2025 11:08:53 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Lots](
	[lot_id] [int] IDENTITY(1,1) NOT NULL,
	[lot_number] [varchar](50) NOT NULL,
	[created_at] [datetime] NOT NULL,
	[updated_at] [datetime] NOT NULL,
	[status] [varchar](20) NOT NULL,
PRIMARY KEY CLUSTERED
(
	[lot_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Table [dbo].[Users]    Script Date: 10/31/2025 11:08:53 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO
CREATE TABLE [dbo].[Users](
	[user_id] [int] IDENTITY(1,1) NOT NULL,
	[line_user_id] [varchar](50) NOT NULL,
	[username] [varchar](100) NULL,
	[role] [varchar](20) NOT NULL,
	[status] [varchar](20) NOT NULL,
	[created_at] [datetime] NOT NULL,
	[last_access] [datetime] NOT NULL,
PRIMARY KEY CLUSTERED
(
	[user_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

/****** Object:  Index [IDX_Images_image_date]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE NONCLUSTERED INDEX [IDX_Images_image_date] ON [dbo].[Images]
(
	[image_date] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IDX_Images_lot_date]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE NONCLUSTERED INDEX [IDX_Images_lot_date] ON [dbo].[Images]
(
	[lot_id] ASC,
	[image_date] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IDX_Images_lot_id]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE NONCLUSTERED INDEX [IDX_Images_lot_id] ON [dbo].[Images]
(
	[lot_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IDX_Images_upload_session_id] - NEW ******/
CREATE NONCLUSTERED INDEX [IDX_Images_upload_session_id] ON [dbo].[Images]
(
	[upload_session_id] ASC
)
WHERE ([upload_session_id] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IDX_Images_lot_date_session] - NEW ******/
CREATE NONCLUSTERED INDEX [IDX_Images_lot_date_session] ON [dbo].[Images]
(
	[lot_id] ASC,
	[image_date] ASC,
	[upload_session_id] ASC
)
INCLUDE ([file_name], [status])
WHERE ([upload_session_id] IS NOT NULL)
WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IDX_Lots_lot_number]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IDX_Lots_lot_number] ON [dbo].[Lots]
(
	[lot_number] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

SET ANSI_PADDING ON
GO
/****** Object:  Index [IDX_Users_line_user_id]    Script Date: 10/31/2025 11:08:53 AM ******/
CREATE UNIQUE NONCLUSTERED INDEX [IDX_Users_line_user_id] ON [dbo].[Users]
(
	[line_user_id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

ALTER TABLE [dbo].[Images] ADD  DEFAULT (getdate()) FOR [uploaded_at]
GO
ALTER TABLE [dbo].[Images] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[Lots] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[Lots] ADD  DEFAULT (getdate()) FOR [updated_at]
GO
ALTER TABLE [dbo].[Lots] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('user') FOR [role]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT ('active') FOR [status]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getdate()) FOR [created_at]
GO
ALTER TABLE [dbo].[Users] ADD  DEFAULT (getdate()) FOR [last_access]
GO

ALTER TABLE [dbo].[Images]  WITH NOCHECK ADD  CONSTRAINT [FK_Images_Lots] FOREIGN KEY([lot_id])
REFERENCES [dbo].[Lots] ([lot_id])
GO
ALTER TABLE [dbo].[Images] CHECK CONSTRAINT [FK_Images_Lots]
GO

/****** Object:  StoredProcedure [dbo].[sp_GetImagesByLotAndDate]    Script Date: 10/31/2025 11:08:53 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_GetImagesByLotAndDate]
    @LotNumber VARCHAR(50),
    @ImageDate DATE
AS
BEGIN
    SET NOCOUNT ON;

    SELECT i.*, l.lot_number
    FROM [dbo].[Images] i
    JOIN [dbo].[Lots] l ON i.lot_id = l.lot_id
    WHERE l.lot_number = @LotNumber
        AND CONVERT(DATE, i.image_date) = @ImageDate
        AND i.status = 'active'
    ORDER BY i.uploaded_at DESC;
END
GO

/****** Object:  StoredProcedure [dbo].[sp_UploadImage]    Script Date: 10/31/2025 11:08:53 AM ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

CREATE PROCEDURE [dbo].[sp_UploadImage]
    @LotNumber VARCHAR(50),
    @ImageDate DATE,
    @FileName VARCHAR(255),
    @FilePath VARCHAR(512),
    @OriginalSize INT,
    @CompressedSize INT,
    @MimeType VARCHAR(50),
    @UploadedBy VARCHAR(50),
    @UploadSessionId BIGINT = NULL,
    @ImageId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LotId INT;

    -- Get or create lot
    SELECT @LotId = lot_id FROM [dbo].[Lots] WHERE lot_number = @LotNumber;

    IF @LotId IS NULL
    BEGIN
        INSERT INTO [dbo].[Lots] (lot_number, created_at, updated_at, status)
        VALUES (@LotNumber, GETDATE(), GETDATE(), 'active');

        SET @LotId = SCOPE_IDENTITY();
    END

    -- Insert image
    INSERT INTO [dbo].[Images] (
        lot_id,
        image_date,
        file_name,
        file_path,
        original_size,
        compressed_size,
        mime_type,
        uploaded_by,
        uploaded_at,
        upload_session_id,
        status
    )
    VALUES (
        @LotId,
        @ImageDate,
        @FileName,
        @FilePath,
        @OriginalSize,
        @CompressedSize,
        @MimeType,
        @UploadedBy,
        GETDATE(),
        @UploadSessionId,
        'active'
    );

    SET @ImageId = SCOPE_IDENTITY();
END
GO

USE [master]
GO
ALTER DATABASE [RC_QC_Line] SET  READ_WRITE
GO
