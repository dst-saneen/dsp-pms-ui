-- P1 §5: Company-qualified recruitment command receipts for application transitions.
CREATE TABLE IF NOT EXISTS "recruitment_command_receipts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "jobApplicationId" TEXT,
  "safeResultSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recruitment_command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "recruitment_command_receipts_companyId_operationId_key"
  ON "recruitment_command_receipts"("companyId", "operationId");

CREATE INDEX IF NOT EXISTS "recruitment_command_receipts_companyId_commandType_idx"
  ON "recruitment_command_receipts"("companyId", "commandType");

CREATE INDEX IF NOT EXISTS "recruitment_command_receipts_jobApplicationId_idx"
  ON "recruitment_command_receipts"("jobApplicationId");
