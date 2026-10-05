-- Office Finance + Payroll release expand: additive envelope, lease, intent,
-- and supporting unique keys. Contract triggers/FKs follow in 20260821181000.

-- ============================================================================
-- 1. Bank-reference authenticated-encryption envelope
-- ============================================================================

ALTER TABLE "finance_payment_accounts"
  ADD COLUMN IF NOT EXISTS "bankReferenceEncNonce" TEXT,
  ADD COLUMN IF NOT EXISTS "bankReferenceEncTag" TEXT,
  ADD COLUMN IF NOT EXISTS "bankReferenceEncKeyVersion" TEXT,
  ADD COLUMN IF NOT EXISTS "bankReferenceEncFormatVersion" INTEGER;

-- ============================================================================
-- 2. Payslip generation lease
-- ============================================================================

ALTER TABLE "PayrollPayslip"
  ADD COLUMN IF NOT EXISTS "generationLeaseId" TEXT,
  ADD COLUMN IF NOT EXISTS "generationLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "generationAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "PayrollPayslip_status_generationLeaseExpiresAt_idx"
  ON "PayrollPayslip"("status", "generationLeaseExpiresAt");

-- ============================================================================
-- 3. Generated-file intent for upload compensation
-- ============================================================================

CREATE TABLE IF NOT EXISTS "GeneratedFileIntent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GeneratedFileIntent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeneratedFileIntent_status_updatedAt_idx"
  ON "GeneratedFileIntent"("status", "updatedAt");

CREATE INDEX IF NOT EXISTS "GeneratedFileIntent_companyId_correlationId_idx"
  ON "GeneratedFileIntent"("companyId", "correlationId");

CREATE INDEX IF NOT EXISTS "GeneratedFileIntent_objectKey_idx"
  ON "GeneratedFileIntent"("objectKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'GeneratedFileIntent_companyId_fkey'
  ) THEN
    ALTER TABLE "GeneratedFileIntent"
      ADD CONSTRAINT "GeneratedFileIntent_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- ============================================================================
-- 4. Supporting unique keys for company-qualified FKs
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "OvertimeRequest_companyId_id_key"
  ON "overtime_requests"("companyId", "id");

CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_payrollYear_payrollMonth_idx"
  ON "PayrollRun"("companyId", "payrollYear", "payrollMonth");

CREATE UNIQUE INDEX IF NOT EXISTS "finance_transactions_reversalOfTransactionId_key"
  ON "finance_transactions"("reversalOfTransactionId")
  WHERE "reversalOfTransactionId" IS NOT NULL;
