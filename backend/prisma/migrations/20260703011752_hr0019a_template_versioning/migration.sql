-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TemplateVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "OnboardingTemplateTask" ALTER COLUMN "ownerType" DROP NOT NULL,
ALTER COLUMN "ownerType" DROP DEFAULT;

-- CreateTable
CREATE TABLE "OnboardingTemplateVersion" (
    "id" TEXT NOT NULL,
    "onboardingTemplateId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "versionName" TEXT,
    "status" "TemplateVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTemplateVersion_status_idx" ON "OnboardingTemplateVersion"("status");

-- CreateIndex
CREATE INDEX "OnboardingTemplateVersion_isCurrent_idx" ON "OnboardingTemplateVersion"("isCurrent");

-- CreateIndex
CREATE INDEX "OnboardingTemplateVersion_effectiveFrom_idx" ON "OnboardingTemplateVersion"("effectiveFrom");

-- CreateIndex
CREATE INDEX "OnboardingTemplateVersion_onboardingTemplateId_idx" ON "OnboardingTemplateVersion"("onboardingTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingTemplateVersion_onboardingTemplateId_versionNo_key" ON "OnboardingTemplateVersion"("onboardingTemplateId", "versionNo");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateVersion" ADD CONSTRAINT "OnboardingTemplateVersion_onboardingTemplateId_fkey" FOREIGN KEY ("onboardingTemplateId") REFERENCES "OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
