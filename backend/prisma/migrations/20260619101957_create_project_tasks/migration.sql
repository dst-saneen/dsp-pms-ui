/*
  Warnings:

  - A unique constraint covering the columns `[taskCode]` on the table `project_tasks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "project_tasks_taskCode_key" ON "project_tasks"("taskCode");
