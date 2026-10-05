/*
  Warnings:

  - You are about to drop the column `templateTaskId` on the `OnboardingTemplateTask` table. All the data in the column will be lost.
  - The `status` column on the `work_schedule_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Made the column `taskGroupId` on table `OnboardingTemplateTask` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "WorkExecutionStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ContributionCategory" AS ENUM ('HR', 'IT', 'FINANCE', 'TRAINING', 'ASSET', 'SECURITY', 'SOFTWARE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('DOCUMENT', 'SOFTWARE', 'ACCOUNT', 'ACCESS', 'ASSET', 'TRAINING', 'POLICY', 'FORM', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ExecutionType" AS ENUM ('TASK', 'APPROVAL', 'SERVICE', 'API', 'NOTIFICATION', 'AUTO');

-- CreateEnum
CREATE TYPE "ExecutionAction" AS ENUM ('INSTALL', 'ASSIGN', 'VERIFY', 'CREATE', 'UPDATE', 'DELETE', 'NOTIFY', 'APPROVE', 'REVIEW', 'CUSTOM');

-- DropForeignKey
ALTER TABLE "OnboardingTemplateTask" DROP CONSTRAINT "OnboardingTemplateTask_taskGroupId_fkey";

-- AlterTable
ALTER TABLE "OnboardingTemplateTask" DROP COLUMN "templateTaskId",
ADD COLUMN     "assignedDepartmentId" TEXT,
ADD COLUMN     "assignedDesignationId" TEXT,
ADD COLUMN     "assignedEmployeeId" TEXT,
ADD COLUMN     "dependsOnTaskId" TEXT,
ALTER COLUMN "taskGroupId" SET NOT NULL;

-- AlterTable
ALTER TABLE "work_schedule_items" DROP COLUMN "status",
ADD COLUMN     "status" "WorkExecutionStatus" NOT NULL DEFAULT 'PLANNED';

-- CreateTable
CREATE TABLE "Contribution" (
    "id" TEXT NOT NULL,
    "onboardingDepartmentTemplateId" TEXT NOT NULL,
    "contributionCode" TEXT NOT NULL,
    "contributionName" TEXT NOT NULL,
    "description" TEXT,
    "category" "ContributionCategory" NOT NULL,
    "businessCapabilityId" TEXT,
    "businessCapabilityCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "requirementCode" TEXT,
    "requirementName" TEXT NOT NULL,
    "requirementValue" TEXT,
    "description" TEXT,
    "referenceType" "ReferenceType",
    "referenceId" TEXT,
    "dependsOnRequirementId" TEXT,
    "defaultValue" TEXT,
    "validationRule" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionProfile" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "profileCode" TEXT,
    "profileName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionRule" (
    "id" TEXT NOT NULL,
    "executionProfileId" TEXT NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "ownerType" "WorkOwnerType" NOT NULL,
    "executionType" "ExecutionType" NOT NULL,
    "action" "ExecutionAction" NOT NULL,
    "workType" "WorkType" NOT NULL,
    "approvalWorkflowId" TEXT,
    "dueDays" INTEGER,
    "reminderIntervalDays" INTEGER,
    "estimatedDurationMinutes" INTEGER,
    "conditionExpression" TEXT,
    "autoComplete" BOOLEAN NOT NULL DEFAULT false,
    "allowReopen" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExecutionRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contribution_businessCapabilityCode_idx" ON "Contribution"("businessCapabilityCode");

-- CreateIndex
CREATE INDEX "Contribution_category_idx" ON "Contribution"("category");

-- CreateIndex
CREATE INDEX "Contribution_isActive_idx" ON "Contribution"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Contribution_onboardingDepartmentTemplateId_contributionCod_key" ON "Contribution"("onboardingDepartmentTemplateId", "contributionCode");

-- CreateIndex
CREATE INDEX "Requirement_requirementType_idx" ON "Requirement"("requirementType");

-- CreateIndex
CREATE INDEX "Requirement_dependsOnRequirementId_idx" ON "Requirement"("dependsOnRequirementId");

-- CreateIndex
CREATE INDEX "ExecutionRule_action_idx" ON "ExecutionRule"("action");

-- CreateIndex
CREATE INDEX "ExecutionRule_executionType_idx" ON "ExecutionRule"("executionType");

-- CreateIndex
CREATE UNIQUE INDEX "ExecutionRule_executionProfileId_sequenceNo_key" ON "ExecutionRule"("executionProfileId", "sequenceNo");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_assignedDepartmentId_idx" ON "OnboardingTemplateTask"("assignedDepartmentId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_assignedDesignationId_idx" ON "OnboardingTemplateTask"("assignedDesignationId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_assignedEmployeeId_idx" ON "OnboardingTemplateTask"("assignedEmployeeId");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_dependsOnTaskId_idx" ON "OnboardingTemplateTask"("dependsOnTaskId");

-- CreateIndex
CREATE INDEX "work_schedule_items_status_idx" ON "work_schedule_items"("status");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_taskGroupId_fkey" FOREIGN KEY ("taskGroupId") REFERENCES "OnboardingTaskGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_assignedDepartmentId_fkey" FOREIGN KEY ("assignedDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_assignedDesignationId_fkey" FOREIGN KEY ("assignedDesignationId") REFERENCES "designations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_dependsOnTaskId_fkey" FOREIGN KEY ("dependsOnTaskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contribution" ADD CONSTRAINT "Contribution_onboardingDepartmentTemplateId_fkey" FOREIGN KEY ("onboardingDepartmentTemplateId") REFERENCES "OnboardingDepartmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionProfile" ADD CONSTRAINT "ExecutionProfile_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRule" ADD CONSTRAINT "ExecutionRule_executionProfileId_fkey" FOREIGN KEY ("executionProfileId") REFERENCES "ExecutionProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionRule" ADD CONSTRAINT "ExecutionRule_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
