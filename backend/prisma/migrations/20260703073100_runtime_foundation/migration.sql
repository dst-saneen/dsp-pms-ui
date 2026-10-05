/*
  Warnings:

  - You are about to drop the `task_work_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "RuntimeClientType" AS ENUM ('WEB', 'MOBILE', 'DESKTOP', 'API');

-- DropForeignKey
ALTER TABLE "task_work_sessions" DROP CONSTRAINT "task_work_sessions_employeeId_fkey";

-- DropForeignKey
ALTER TABLE "task_work_sessions" DROP CONSTRAINT "task_work_sessions_workScheduleItemId_fkey";

-- DropForeignKey
ALTER TABLE "work_log_lines" DROP CONSTRAINT "work_log_lines_taskWorkSessionId_fkey";

-- DropTable
DROP TABLE "task_work_sessions";

-- CreateTable
CREATE TABLE "TaskWorkSession" (
    "id" TEXT NOT NULL,
    "workScheduleItemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "detectedHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "confirmedHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentRemarks" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "startedFrom" "RuntimeClientType",
    "deviceInfo" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskWorkSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskWorkSession_employeeId_status_idx" ON "TaskWorkSession"("employeeId", "status");

-- CreateIndex
CREATE INDEX "TaskWorkSession_employeeId_startedAt_idx" ON "TaskWorkSession"("employeeId", "startedAt");

-- CreateIndex
CREATE INDEX "TaskWorkSession_workScheduleItemId_idx" ON "TaskWorkSession"("workScheduleItemId");

-- CreateIndex
CREATE INDEX "TaskWorkSession_approvedById_idx" ON "TaskWorkSession"("approvedById");

-- AddForeignKey
ALTER TABLE "TaskWorkSession" ADD CONSTRAINT "TaskWorkSession_workScheduleItemId_fkey" FOREIGN KEY ("workScheduleItemId") REFERENCES "work_schedule_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWorkSession" ADD CONSTRAINT "TaskWorkSession_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskWorkSession" ADD CONSTRAINT "TaskWorkSession_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_lines" ADD CONSTRAINT "work_log_lines_taskWorkSessionId_fkey" FOREIGN KEY ("taskWorkSessionId") REFERENCES "TaskWorkSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
