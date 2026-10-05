-- CreateTable
CREATE TABLE "task_work_sessions" (
    "id" TEXT NOT NULL,
    "workScheduleItemId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "detectedHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "confirmedHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjustmentRemarks" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_work_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_work_sessions_employeeId_idx" ON "task_work_sessions"("employeeId");

-- CreateIndex
CREATE INDEX "task_work_sessions_workScheduleItemId_idx" ON "task_work_sessions"("workScheduleItemId");

-- CreateIndex
CREATE INDEX "task_work_sessions_status_idx" ON "task_work_sessions"("status");

-- AddForeignKey
ALTER TABLE "task_work_sessions" ADD CONSTRAINT "task_work_sessions_workScheduleItemId_fkey" FOREIGN KEY ("workScheduleItemId") REFERENCES "work_schedule_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_work_sessions" ADD CONSTRAINT "task_work_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
