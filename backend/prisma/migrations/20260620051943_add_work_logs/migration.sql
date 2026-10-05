-- CreateTable
CREATE TABLE "work_log_headers" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_headers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_lines" (
    "id" TEXT NOT NULL,
    "workLogHeaderId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT,
    "workCategoryId" TEXT,
    "hours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_log_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_log_headers_employeeId_idx" ON "work_log_headers"("employeeId");

-- CreateIndex
CREATE INDEX "work_log_headers_status_idx" ON "work_log_headers"("status");

-- CreateIndex
CREATE INDEX "work_log_lines_workLogHeaderId_idx" ON "work_log_lines"("workLogHeaderId");

-- CreateIndex
CREATE INDEX "work_log_lines_taskId_idx" ON "work_log_lines"("taskId");

-- CreateIndex
CREATE INDEX "work_log_lines_workCategoryId_idx" ON "work_log_lines"("workCategoryId");

-- CreateIndex
CREATE INDEX "work_log_lines_workDate_idx" ON "work_log_lines"("workDate");

-- AddForeignKey
ALTER TABLE "work_log_headers" ADD CONSTRAINT "work_log_headers_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_lines" ADD CONSTRAINT "work_log_lines_workLogHeaderId_fkey" FOREIGN KEY ("workLogHeaderId") REFERENCES "work_log_headers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_lines" ADD CONSTRAINT "work_log_lines_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_lines" ADD CONSTRAINT "work_log_lines_workCategoryId_fkey" FOREIGN KEY ("workCategoryId") REFERENCES "WorkCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
