/*
  Warnings:

  - A unique constraint covering the columns `[taskId,versionNo]` on the table `task_submissions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "project_tasks" ADD COLUMN     "completionPercentage" DECIMAL(65,30) DEFAULT 0,
ADD COLUMN     "estimatedReviewHours" DECIMAL(65,30) DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "task_submissions_taskId_versionNo_key" ON "task_submissions"("taskId", "versionNo");
