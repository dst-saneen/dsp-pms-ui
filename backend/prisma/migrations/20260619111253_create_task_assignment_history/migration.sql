-- CreateTable
CREATE TABLE "task_assignment_history" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousEmployeeId" TEXT,
    "remarks" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignment_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_assignment_history_taskId_idx" ON "task_assignment_history"("taskId");

-- CreateIndex
CREATE INDEX "task_assignment_history_employeeId_idx" ON "task_assignment_history"("employeeId");

-- AddForeignKey
ALTER TABLE "task_assignment_history" ADD CONSTRAINT "task_assignment_history_previousEmployeeId_fkey" FOREIGN KEY ("previousEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment_history" ADD CONSTRAINT "task_assignment_history_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment_history" ADD CONSTRAINT "task_assignment_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignment_history" ADD CONSTRAINT "task_assignment_history_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
