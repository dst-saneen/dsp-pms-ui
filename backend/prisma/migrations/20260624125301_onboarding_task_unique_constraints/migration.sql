/*
  Warnings:

  - A unique constraint covering the columns `[onboardingTemplateId,taskName]` on the table `OnboardingTemplateTask` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[onboardingTemplateId,sequenceNo]` on the table `OnboardingTemplateTask` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplateTask_onboardingTemplateId_taskName_key" ON "OnboardingTemplateTask"("onboardingTemplateId", "taskName");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplateTask_onboardingTemplateId_sequenceNo_key" ON "OnboardingTemplateTask"("onboardingTemplateId", "sequenceNo");
