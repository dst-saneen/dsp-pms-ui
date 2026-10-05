/*
  Warnings:

  - A unique constraint covering the columns `[projectId,taskCode]` on the table `project_tasks` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskId,employeeId,role]` on the table `task_participants` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "project_tasks_projectId_taskCode_key" ON "project_tasks"("projectId", "taskCode");

-- CreateIndex
CREATE UNIQUE INDEX "task_participants_taskId_employeeId_role_key" ON "task_participants"("taskId", "employeeId", "role");
