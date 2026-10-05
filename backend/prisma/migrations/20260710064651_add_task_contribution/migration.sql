-- CreateTable
CREATE TABLE "TaskContribution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskContribution_taskId_idx" ON "TaskContribution"("taskId");

-- CreateIndex
CREATE INDEX "TaskContribution_contributionId_idx" ON "TaskContribution"("contributionId");

-- CreateIndex
CREATE INDEX "TaskContribution_displayOrder_idx" ON "TaskContribution"("displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "TaskContribution_taskId_contributionId_key" ON "TaskContribution"("taskId", "contributionId");

-- AddForeignKey
ALTER TABLE "TaskContribution" ADD CONSTRAINT "TaskContribution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskContribution" ADD CONSTRAINT "TaskContribution_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "Contribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
