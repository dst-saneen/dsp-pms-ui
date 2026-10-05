/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,startDate,endDate]` on the table `work_log_headers` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "work_log_headers_employeeId_idx";

-- AlterTable
ALTER TABLE "work_log_lines" ADD COLUMN     "taskWorkSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "work_log_headers_employeeId_startDate_endDate_key" ON "work_log_headers"("employeeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "work_log_lines_taskWorkSessionId_idx" ON "work_log_lines"("taskWorkSessionId");

-- AddForeignKey
ALTER TABLE "work_log_lines" ADD CONSTRAINT "work_log_lines_taskWorkSessionId_fkey" FOREIGN KEY ("taskWorkSessionId") REFERENCES "task_work_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
