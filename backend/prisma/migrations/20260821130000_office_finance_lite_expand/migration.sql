-- Office Finance Lite expand (additive): Finance enums/tables, profile payroll
-- category link, File purpose/retention values, composite FK indexes.
-- Contract enforcement (checks, triggers, NOT VALID hardening) follows in a later migration.

-- ============================================================================
-- 1. Enums
-- ============================================================================

CREATE TYPE "FinanceCategoryType" AS ENUM ('INCOME', 'EXPENSE');

CREATE TYPE "FinanceAccountType" AS ENUM ('CASH', 'BANK');

CREATE TYPE "FinanceTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

CREATE TYPE "FinanceTransactionStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REVERSED',
  'CANCELLED'
);

CREATE TYPE "FinancePeriodStatus" AS ENUM ('OPEN', 'LOCKED');

CREATE TYPE "FinanceSourceType" AS ENUM (
  'MANUAL',
  'PAYROLL_RUN',
  'REVERSAL',
  'LEGACY_IMPORT'
);

CREATE TYPE "FinanceActionEntityType" AS ENUM (
  'FINANCIAL_PROFILE',
  'BUSINESS_PARTY',
  'CATEGORY',
  'PAYMENT_ACCOUNT',
  'PERIOD',
  'TRANSACTION',
  'ATTACHMENT'
);

-- ============================================================================
-- 2. Supporting composite unique keys for tenant-qualified FKs
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "branches_companyId_id_key"
  ON "branches"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "departments_companyId_branchId_id_key"
  ON "departments"("companyId", "branchId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "departments_companyId_id_key"
  ON "departments"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "employees_companyId_id_key"
  ON "employees"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "projects_companyId_id_key"
  ON "projects"("companyId", "id");

-- ============================================================================
-- 3. Finance categories
-- ============================================================================

CREATE TABLE "finance_categories" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "categoryCode" TEXT NOT NULL,
  "categoryName" TEXT NOT NULL,
  "categoryType" "FinanceCategoryType" NOT NULL,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "archivedByUserId" TEXT,
  "archiveReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_categories_companyId_categoryCode_key"
  ON "finance_categories"("companyId", "categoryCode");

CREATE UNIQUE INDEX "finance_categories_companyId_id_key"
  ON "finance_categories"("companyId", "id");

CREATE INDEX "finance_categories_companyId_isActive_idx"
  ON "finance_categories"("companyId", "isActive");

CREATE INDEX "finance_categories_companyId_categoryType_idx"
  ON "finance_categories"("companyId", "categoryType");

-- ============================================================================
-- 4. Finance payment accounts
-- ============================================================================

CREATE TABLE "finance_payment_accounts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "accountCode" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "accountType" "FinanceAccountType" NOT NULL,
  "currencyCode" TEXT NOT NULL,
  "openingBalance" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "openingDate" DATE NOT NULL,
  "bankName" TEXT,
  "bankReferenceEncrypted" TEXT,
  "bankReferenceKeyVersion" TEXT,
  "bankLastFour" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "archivedAt" TIMESTAMP(3),
  "archivedByUserId" TEXT,
  "archiveReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_payment_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_payment_accounts_companyId_accountCode_key"
  ON "finance_payment_accounts"("companyId", "accountCode");

CREATE UNIQUE INDEX "finance_payment_accounts_companyId_id_key"
  ON "finance_payment_accounts"("companyId", "id");

CREATE INDEX "finance_payment_accounts_companyId_isActive_idx"
  ON "finance_payment_accounts"("companyId", "isActive");

CREATE INDEX "finance_payment_accounts_companyId_branchId_idx"
  ON "finance_payment_accounts"("companyId", "branchId");

CREATE INDEX "finance_payment_accounts_companyId_accountType_idx"
  ON "finance_payment_accounts"("companyId", "accountType");

-- ============================================================================
-- 5. Finance periods
-- ============================================================================

CREATE TABLE "finance_periods" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "periodYear" INTEGER NOT NULL,
  "periodMonth" INTEGER NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "status" "FinancePeriodStatus" NOT NULL DEFAULT 'OPEN',
  "version" INTEGER NOT NULL DEFAULT 0,
  "lockedByUserId" TEXT,
  "lockedAt" TIMESTAMP(3),
  "reopenedByUserId" TEXT,
  "reopenedAt" TIMESTAMP(3),
  "reopenReason" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_periods_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_periods_month_chk"
    CHECK ("periodMonth" >= 1 AND "periodMonth" <= 12)
);

CREATE UNIQUE INDEX "finance_periods_companyId_periodYear_periodMonth_key"
  ON "finance_periods"("companyId", "periodYear", "periodMonth");

CREATE INDEX "finance_periods_companyId_status_idx"
  ON "finance_periods"("companyId", "status");

CREATE INDEX "finance_periods_companyId_periodStart_idx"
  ON "finance_periods"("companyId", "periodStart");

-- ============================================================================
-- 6. Finance transactions
-- ============================================================================

CREATE TABLE "finance_transactions" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "transactionNumber" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "transactionDate" DATE NOT NULL,
  "transactionType" "FinanceTransactionType" NOT NULL,
  "status" "FinanceTransactionStatus" NOT NULL DEFAULT 'DRAFT',
  "amount" DECIMAL(18, 2) NOT NULL,
  "taxAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "currencyCode" TEXT NOT NULL,
  "categoryId" TEXT,
  "departmentId" TEXT,
  "projectId" TEXT,
  "sourceAccountId" TEXT,
  "destinationAccountId" TEXT,
  "businessPartyId" TEXT,
  "employeeId" TEXT,
  "description" TEXT NOT NULL,
  "reference" TEXT,
  "sourceType" "FinanceSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "submittedByUserId" TEXT,
  "submittedAt" TIMESTAMP(3),
  "approvedByUserId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "returnedByUserId" TEXT,
  "returnedAt" TIMESTAMP(3),
  "returnReason" TEXT,
  "cancelledByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "reversedByUserId" TEXT,
  "reversedAt" TIMESTAMP(3),
  "reverseReason" TEXT,
  "reversalOfTransactionId" TEXT,
  "reversedByTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "finance_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_transactions_companyId_transactionNumber_key"
  ON "finance_transactions"("companyId", "transactionNumber");

CREATE UNIQUE INDEX "finance_transactions_companyId_id_key"
  ON "finance_transactions"("companyId", "id");

CREATE UNIQUE INDEX "finance_transactions_companyId_sourceType_sourceId_key"
  ON "finance_transactions"("companyId", "sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL;

CREATE INDEX "finance_transactions_companyId_status_idx"
  ON "finance_transactions"("companyId", "status");

CREATE INDEX "finance_transactions_companyId_transactionDate_status_idx"
  ON "finance_transactions"("companyId", "transactionDate", "status");

CREATE INDEX "finance_transactions_companyId_sourceAccountId_idx"
  ON "finance_transactions"("companyId", "sourceAccountId");

CREATE INDEX "finance_transactions_companyId_destinationAccountId_idx"
  ON "finance_transactions"("companyId", "destinationAccountId");

CREATE INDEX "finance_transactions_companyId_categoryId_idx"
  ON "finance_transactions"("companyId", "categoryId");

CREATE INDEX "finance_transactions_companyId_businessPartyId_idx"
  ON "finance_transactions"("companyId", "businessPartyId");

CREATE INDEX "finance_transactions_companyId_employeeId_idx"
  ON "finance_transactions"("companyId", "employeeId");

CREATE INDEX "finance_transactions_companyId_departmentId_idx"
  ON "finance_transactions"("companyId", "departmentId");

CREATE INDEX "finance_transactions_companyId_projectId_idx"
  ON "finance_transactions"("companyId", "projectId");

CREATE INDEX "finance_transactions_companyId_branchId_idx"
  ON "finance_transactions"("companyId", "branchId");

CREATE INDEX "finance_transactions_companyId_sourceType_sourceId_idx"
  ON "finance_transactions"("companyId", "sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL;

CREATE INDEX "finance_transactions_approval_queue_idx"
  ON "finance_transactions"("companyId", "status", "submittedAt")
  WHERE "status" = 'SUBMITTED';

-- ============================================================================
-- 7. Finance transaction attachments
-- ============================================================================

CREATE TABLE "finance_transaction_attachments" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "financeTransactionId" TEXT NOT NULL,
  "fileObjectId" TEXT NOT NULL,
  "title" TEXT,
  "linkedByUserId" TEXT NOT NULL,
  "linkedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_transaction_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_transaction_attachments_financeTransactionId_fileObjectId_key"
  ON "finance_transaction_attachments"("financeTransactionId", "fileObjectId");

CREATE INDEX "finance_transaction_attachments_companyId_idx"
  ON "finance_transaction_attachments"("companyId");

CREATE INDEX "finance_transaction_attachments_financeTransactionId_idx"
  ON "finance_transaction_attachments"("financeTransactionId");

-- ============================================================================
-- 8. Finance action events (append-only)
-- ============================================================================

CREATE TABLE "finance_action_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" "FinanceActionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "actorUserId" TEXT NOT NULL,
  "reason" TEXT,
  "operationId" TEXT NOT NULL,
  "versionBefore" INTEGER NOT NULL,
  "versionAfter" INTEGER NOT NULL,
  "reversalTransactionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_action_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finance_action_events_companyId_entityType_entityId_idx"
  ON "finance_action_events"("companyId", "entityType", "entityId");

CREATE INDEX "finance_action_events_companyId_entityType_createdAt_idx"
  ON "finance_action_events"("companyId", "entityType", "createdAt");

CREATE INDEX "finance_action_events_companyId_operationId_idx"
  ON "finance_action_events"("companyId", "operationId");

-- ============================================================================
-- 9. Finance command receipts
-- ============================================================================

CREATE TABLE "finance_command_receipts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestHashKeyVersion" TEXT NOT NULL,
  "requestHashFormatVersion" INTEGER NOT NULL,
  "resultEntityId" TEXT,
  "safeResultSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_command_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "finance_command_receipts_companyId_operationId_key"
  ON "finance_command_receipts"("companyId", "operationId");

CREATE INDEX "finance_command_receipts_companyId_commandType_idx"
  ON "finance_command_receipts"("companyId", "commandType");

-- ============================================================================
-- 10. Extend company financial profile and File enums
-- ============================================================================

ALTER TABLE "company_financial_profiles"
  ADD COLUMN IF NOT EXISTS "payrollExpenseCategoryId" TEXT;

ALTER TYPE "dsp_pms"."FileUploadPurpose" ADD VALUE IF NOT EXISTS 'FINANCE_RECEIPT';

ALTER TYPE "dsp_pms"."FileRetentionClass" ADD VALUE IF NOT EXISTS 'FINANCE_RECORD';

-- ============================================================================
-- 11. Foreign keys
-- ============================================================================

-- finance_categories
ALTER TABLE "finance_categories"
  ADD CONSTRAINT "finance_categories_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_categories"
  ADD CONSTRAINT "finance_categories_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_categories"
  ADD CONSTRAINT "finance_categories_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_categories"
  ADD CONSTRAINT "finance_categories_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_payment_accounts
ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT "finance_payment_accounts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT "finance_payment_accounts_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT "finance_payment_accounts_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT "finance_payment_accounts_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_payment_accounts"
  ADD CONSTRAINT "finance_payment_accounts_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_periods
ALTER TABLE "finance_periods"
  ADD CONSTRAINT "finance_periods_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_periods"
  ADD CONSTRAINT "finance_periods_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_periods"
  ADD CONSTRAINT "finance_periods_lockedByUserId_fkey"
  FOREIGN KEY ("lockedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_periods"
  ADD CONSTRAINT "finance_periods_reopenedByUserId_fkey"
  FOREIGN KEY ("reopenedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_transactions
ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId") REFERENCES "branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_category_fkey"
  FOREIGN KEY ("companyId", "categoryId") REFERENCES "finance_categories"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_department_fkey"
  FOREIGN KEY ("companyId", "departmentId") REFERENCES "departments"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_project_fkey"
  FOREIGN KEY ("companyId", "projectId") REFERENCES "projects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_source_account_fkey"
  FOREIGN KEY ("companyId", "sourceAccountId") REFERENCES "finance_payment_accounts"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_destination_account_fkey"
  FOREIGN KEY ("companyId", "destinationAccountId") REFERENCES "finance_payment_accounts"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_business_party_fkey"
  FOREIGN KEY ("companyId", "businessPartyId") REFERENCES "business_parties"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId") REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_reversal_of_fkey"
  FOREIGN KEY ("companyId", "reversalOfTransactionId") REFERENCES "finance_transactions"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_reversed_by_fkey"
  FOREIGN KEY ("companyId", "reversedByTransactionId") REFERENCES "finance_transactions"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_returnedByUserId_fkey"
  FOREIGN KEY ("returnedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transactions"
  ADD CONSTRAINT "finance_transactions_reversedByUserId_fkey"
  FOREIGN KEY ("reversedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_transaction_attachments
ALTER TABLE "finance_transaction_attachments"
  ADD CONSTRAINT "finance_transaction_attachments_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transaction_attachments"
  ADD CONSTRAINT "finance_transaction_attachments_company_transaction_fkey"
  FOREIGN KEY ("companyId", "financeTransactionId") REFERENCES "finance_transactions"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transaction_attachments"
  ADD CONSTRAINT "finance_transaction_attachments_company_file_object_fkey"
  FOREIGN KEY ("companyId", "fileObjectId") REFERENCES "dsp_pms"."file_objects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_transaction_attachments"
  ADD CONSTRAINT "finance_transaction_attachments_linkedByUserId_fkey"
  FOREIGN KEY ("linkedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_action_events
ALTER TABLE "finance_action_events"
  ADD CONSTRAINT "finance_action_events_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_action_events"
  ADD CONSTRAINT "finance_action_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_action_events"
  ADD CONSTRAINT "finance_action_events_reversal_transaction_fkey"
  FOREIGN KEY ("reversalTransactionId") REFERENCES "finance_transactions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- finance_command_receipts
ALTER TABLE "finance_command_receipts"
  ADD CONSTRAINT "finance_command_receipts_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "finance_command_receipts"
  ADD CONSTRAINT "finance_command_receipts_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- company financial profile payroll expense category (company-qualified)
ALTER TABLE "company_financial_profiles"
  ADD CONSTRAINT "company_financial_profiles_payroll_expense_category_fkey"
  FOREIGN KEY ("companyId", "payrollExpenseCategoryId") REFERENCES "finance_categories"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- projects.businessPartyId -> business_parties (when column exists from shared foundation)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'projects'
      AND column_name = 'businessPartyId'
  ) THEN
    ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_company_business_party_fkey";
    ALTER TABLE "projects"
      ADD CONSTRAINT "projects_company_business_party_fkey"
      FOREIGN KEY ("companyId", "businessPartyId") REFERENCES "business_parties"("companyId", "id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
