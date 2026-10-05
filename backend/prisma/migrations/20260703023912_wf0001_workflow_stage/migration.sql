-- CreateTable
CREATE TABLE "WorkflowStage" (
    "id" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowStage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkflowStage_workflowVersionId_idx" ON "WorkflowStage"("workflowVersionId");

-- CreateIndex
CREATE INDEX "WorkflowStage_isActive_idx" ON "WorkflowStage"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStage_workflowVersionId_stageCode_key" ON "WorkflowStage"("workflowVersionId", "stageCode");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowStage_workflowVersionId_displayOrder_key" ON "WorkflowStage"("workflowVersionId", "displayOrder");

-- AddForeignKey
ALTER TABLE "WorkflowStage" ADD CONSTRAINT "WorkflowStage_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
