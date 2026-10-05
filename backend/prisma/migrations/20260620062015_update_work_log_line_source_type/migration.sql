-- AlterTable
ALTER TABLE "work_log_lines" ADD COLUMN     "sourceType" TEXT;

-- CreateIndex
CREATE INDEX "work_log_lines_sourceType_idx" ON "work_log_lines"("sourceType");
