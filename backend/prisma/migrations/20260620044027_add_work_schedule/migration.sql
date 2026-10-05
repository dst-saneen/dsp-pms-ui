-- DropIndex
DROP INDEX "project_tasks_taskCode_key";

-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "taskTypeId" TEXT;

-- AlterTable
ALTER TABLE "project_team_members" ADD COLUMN     "allocationSource" TEXT,
ADD COLUMN     "allocationStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "remarks" TEXT;

-- CreateTable
CREATE TABLE "project_team_member_history" (
    "id" TEXT NOT NULL,
    "projectTeamMemberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "oldRole" TEXT,
    "newRole" TEXT,
    "oldAllocationPercentage" DECIMAL(65,30),
    "newAllocationPercentage" DECIMAL(65,30),
    "oldStartDate" TIMESTAMP(3),
    "newStartDate" TIMESTAMP(3),
    "oldEndDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "action" TEXT NOT NULL,
    "remarks" TEXT,
    "changedById" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_team_member_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_types" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "taskTypeCode" TEXT NOT NULL,
    "taskTypeName" TEXT NOT NULL,
    "description" TEXT,
    "defaultPlannedHours" DECIMAL(65,30),
    "estimatedComplexity" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkCategory" (
    "id" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "companyId" TEXT,
    "isBillable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedules" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_schedule_items" (
    "id" TEXT NOT NULL,
    "workScheduleId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT,
    "workCategoryId" TEXT,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedHours" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "sourceType" TEXT,
    "parentItemId" TEXT,
    "assignedById" TEXT,
    "sequenceNo" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "plannedStartTime" TIMESTAMP(3),
    "plannedEndTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_schedule_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_team_member_history_projectTeamMemberId_idx" ON "project_team_member_history"("projectTeamMemberId");

-- CreateIndex
CREATE INDEX "project_team_member_history_projectId_idx" ON "project_team_member_history"("projectId");

-- CreateIndex
CREATE INDEX "project_team_member_history_employeeId_idx" ON "project_team_member_history"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "task_types_companyId_taskTypeCode_key" ON "task_types"("companyId", "taskTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkCategory_companyId_categoryCode_key" ON "WorkCategory"("companyId", "categoryCode");

-- CreateIndex
CREATE INDEX "work_schedules_employeeId_idx" ON "work_schedules"("employeeId");

-- CreateIndex
CREATE INDEX "work_schedule_items_workScheduleId_idx" ON "work_schedule_items"("workScheduleId");

-- CreateIndex
CREATE INDEX "work_schedule_items_taskId_workDate_idx" ON "work_schedule_items"("taskId", "workDate");

-- CreateIndex
CREATE INDEX "work_schedule_items_parentItemId_idx" ON "work_schedule_items"("parentItemId");

-- CreateIndex
CREATE INDEX "work_schedule_items_employeeId_idx" ON "work_schedule_items"("employeeId");

-- CreateIndex
CREATE INDEX "work_schedule_items_assignedById_idx" ON "work_schedule_items"("assignedById");

-- CreateIndex
CREATE INDEX "work_schedule_items_status_idx" ON "work_schedule_items"("status");

-- AddForeignKey
ALTER TABLE "project_team_members" ADD CONSTRAINT "project_team_members_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_team_member_history" ADD CONSTRAINT "project_team_member_history_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_taskTypeId_fkey" FOREIGN KEY ("taskTypeId") REFERENCES "task_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tasks" ADD CONSTRAINT "project_tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_types" ADD CONSTRAINT "task_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkCategory" ADD CONSTRAINT "WorkCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedules" ADD CONSTRAINT "work_schedules_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_workScheduleId_fkey" FOREIGN KEY ("workScheduleId") REFERENCES "work_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "project_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_workCategoryId_fkey" FOREIGN KEY ("workCategoryId") REFERENCES "WorkCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_parentItemId_fkey" FOREIGN KEY ("parentItemId") REFERENCES "work_schedule_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_schedule_items" ADD CONSTRAINT "work_schedule_items_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
