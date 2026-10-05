-- CreateTable
CREATE TABLE "task_participants" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "plannedHours" DECIMAL(65,30) DEFAULT 0,
    "actualHours" DECIMAL(65,30) DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_participants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_participants_taskId_idx" ON "task_participants"("taskId");

-- CreateIndex
CREATE INDEX "task_participants_employeeId_idx" ON "task_participants"("employeeId");

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_participants" ADD CONSTRAINT "task_participants_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
