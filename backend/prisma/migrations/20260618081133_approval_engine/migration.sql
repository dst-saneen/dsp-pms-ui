-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" TEXT NOT NULL,
    "workflowCode" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "companyId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflow_steps" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_workflow_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_transactions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_transaction_steps" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "stepNo" INTEGER NOT NULL,
    "approverId" TEXT,
    "action" TEXT,
    "remarks" TEXT,
    "actionDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_transaction_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflows_workflowCode_key" ON "approval_workflows"("workflowCode");

-- CreateIndex
CREATE UNIQUE INDEX "approval_workflow_steps_workflowId_stepNo_key" ON "approval_workflow_steps"("workflowId", "stepNo");

-- CreateIndex
CREATE INDEX "approval_transactions_entityType_entityId_idx" ON "approval_transactions"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "approval_transactions_status_idx" ON "approval_transactions"("status");

-- CreateIndex
CREATE INDEX "approval_transaction_steps_transactionId_idx" ON "approval_transaction_steps"("transactionId");

-- CreateIndex
CREATE INDEX "approval_transaction_steps_approverId_idx" ON "approval_transaction_steps"("approverId");

-- AddForeignKey
ALTER TABLE "approval_workflows" ADD CONSTRAINT "approval_workflows_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_workflow_steps" ADD CONSTRAINT "approval_workflow_steps_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_transactions" ADD CONSTRAINT "approval_transactions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_transaction_steps" ADD CONSTRAINT "approval_transaction_steps_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_transaction_steps" ADD CONSTRAINT "approval_transaction_steps_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "approval_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
