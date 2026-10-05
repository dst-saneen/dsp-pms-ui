/*
  Warnings:

  - A unique constraint covering the columns `[taskGroupId,taskName]` on the table `OnboardingTemplateTask` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[taskGroupId,sequenceNo]` on the table `OnboardingTemplateTask` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "OnboardingTemplateTask" DROP CONSTRAINT "OnboardingTemplateTask_onboardingTemplateId_fkey";

-- DropIndex
DROP INDEX "OnboardingTemplateTask_onboardingTemplateId_sequenceNo_key";

-- DropIndex
DROP INDEX "OnboardingTemplateTask_onboardingTemplateId_taskName_key";

-- AlterTable
ALTER TABLE "OnboardingTemplateTask" ALTER COLUMN "onboardingTemplateId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplateTask_taskGroupId_taskName_key" ON "OnboardingTemplateTask"("taskGroupId", "taskName");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplateTask_taskGroupId_sequenceNo_key" ON "OnboardingTemplateTask"("taskGroupId", "sequenceNo");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "OnboardingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
