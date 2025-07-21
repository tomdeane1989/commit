-- AlterTable
ALTER TABLE "crm_integrations" ADD COLUMN     "column_mapping" JSONB,
ADD COLUMN     "data_start_row" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "header_row" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sheet_name" TEXT,
ADD COLUMN     "spreadsheet_id" TEXT;
