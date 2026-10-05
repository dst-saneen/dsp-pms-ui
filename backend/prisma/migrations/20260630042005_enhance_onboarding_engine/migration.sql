/*
  Warnings:

  - The `status` column on the `EmployeeOnboarding` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `EmployeeOnboardingTask` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `workType` to the `EmployeeOnboardingTask` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'REJECTED', 'SKIPPED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('CHECKLIST', 'DOCUMENT', 'ASSET', 'RESOURCE', 'TRAINING', 'FORM', 'MEETING', 'MEDICAL', 'EMAIL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WorkOwnerType" AS ENUM ('EMPLOYEE', 'HR', 'IT', 'MANAGER', 'FINANCE', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "LifecycleType" AS ENUM ('ONBOARDING', 'OFFBOARDING', 'RECURRING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('DOCUMENT_TYPE', 'ASSET_TYPE', 'RESOURCE', 'LEAVE_TYPE', 'TRAINING', 'NONE');

-- AlterTable
ALTER TABLE "EmployeeOnboarding" ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
DROP COLUMN "status",
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "EmployeeOnboardingTask" ADD COLUMN     "approvalTransactionId" TEXT,
ADD COLUMN     "assignedToUserId" TEXT,
ADD COLUMN     "completedByUserId" TEXT,
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "ownerType" "WorkOwnerType",
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" "ReferenceType",
ADD COLUMN     "startedDate" TIMESTAMP(3),
ADD COLUMN     "workType" "WorkType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TaskStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "OnboardingTemplate" ADD COLUMN     "lifecycle" "LifecycleType" NOT NULL DEFAULT 'ONBOARDING';

-- AlterTable
ALTER TABLE "OnboardingTemplateTask" ADD COLUMN     "allowReopen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "approvalWorkflowId" TEXT,
ADD COLUMN     "autoComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dueDays" INTEGER,
ADD COLUMN     "estimatedDurationMinutes" INTEGER,
ADD COLUMN     "ownerType" "WorkOwnerType" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "referenceId" TEXT,
ADD COLUMN     "referenceType" "ReferenceType",
ADD COLUMN     "reminderIntervalDays" INTEGER,
ADD COLUMN     "templateTaskId" TEXT,
ADD COLUMN     "workType" "WorkType" NOT NULL DEFAULT 'CHECKLIST';

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_status_idx" ON "EmployeeOnboarding"("status");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_approvalWorkflowId_fkey" FOREIGN KEY ("approvalWorkflowId") REFERENCES "approval_workflows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTask" ADD CONSTRAINT "EmployeeOnboardingTask_approvalTransactionId_fkey" FOREIGN KEY ("approvalTransactionId") REFERENCES "approval_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
