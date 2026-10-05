-- Payroll Lite expand migration: enums, harden prototype tables, snapshot/input tables,
-- payslips, action evidence, command receipts, and Secure File Storage enum values.
-- Existing payroll tables use Prisma default PascalCase names (see 20260624144655_payroll_phase_1).

-- ─── Payroll enums ───────────────────────────────────────────────────────────

CREATE TYPE "SalaryComponentType" AS ENUM ('EARNING', 'DEDUCTION');

CREATE TYPE "PayrollRunStatus" AS ENUM (
  'DRAFT',
  'CALCULATED',
  'APPROVED',
  'PAID',
  'CANCELLED',
  'LEGACY_IMPORTED'
);

CREATE TYPE "PayrollAdjustmentDirection" AS ENUM ('EARNING', 'DEDUCTION');

CREATE TYPE "PayrollLineSource" AS ENUM (
  'SALARY_COMPONENT',
  'TAX',
  'RECURRING_DEDUCTION',
  'MANUAL_ADJUSTMENT',
  'OVERTIME',
  'UNPAID_LEAVE'
);

CREATE TYPE "PayrollPayslipStatus" AS ENUM (
  'PENDING',
  'GENERATING',
  'AVAILABLE',
  'FAILED'
);

CREATE TYPE "PayrollActionEntityType" AS ENUM (
  'SALARY_COMPONENT',
  'SALARY_REVISION',
  'TAX_PROFILE',
  'RECURRING_DEDUCTION',
  'PAYROLL_RUN',
  'PAYROLL_ADJUSTMENT',
  'PAYSLIP'
);

-- Secure File Storage enums (schema-qualified; see 20260819140000_secure_file_storage_and_signed_offer)
ALTER TYPE "dsp_pms"."FileUploadPurpose" ADD VALUE IF NOT EXISTS 'PAYROLL_PAYSLIP';
ALTER TYPE "dsp_pms"."FileRetentionClass" ADD VALUE IF NOT EXISTS 'PAYROLL_PAYSLIP';

-- ─── SalaryComponent hardening ─────────────────────────────────────────────────

ALTER TABLE "SalaryComponent"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "componentTypeEnum" "SalaryComponentType",
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT;

UPDATE "SalaryComponent"
SET "componentTypeEnum" = CASE
  WHEN upper(trim("componentType")) IN ('EARNING', 'EARNINGS') THEN 'EARNING'::"SalaryComponentType"
  WHEN upper(trim("componentType")) IN ('DEDUCTION', 'DEDUCTIONS') THEN 'DEDUCTION'::"SalaryComponentType"
  ELSE "componentTypeEnum"
END
WHERE "componentTypeEnum" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "SalaryComponent_companyId_id_key"
  ON "SalaryComponent"("companyId", "id");

-- Re-establish code uniqueness once legacy rows are normalized (may fail if duplicates remain).
CREATE UNIQUE INDEX IF NOT EXISTS "SalaryComponent_companyId_componentCode_key"
  ON "SalaryComponent"("companyId", "componentCode");

ALTER TABLE "SalaryComponent"
  ADD CONSTRAINT "SalaryComponent_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalaryComponent"
  ADD CONSTRAINT "SalaryComponent_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SalaryComponent"
  ADD CONSTRAINT "SalaryComponent_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── EmployeeSalary hardening ────────────────────────────────────────────────

ALTER TABLE "EmployeeSalary"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalary_companyId_id_key"
  ON "EmployeeSalary"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalary_companyId_id_employeeId_key"
  ON "EmployeeSalary"("companyId", "id", "employeeId");

CREATE INDEX IF NOT EXISTS "EmployeeSalary_companyId_employeeId_effectiveFrom_idx"
  ON "EmployeeSalary"("companyId", "employeeId", "effectiveFrom");

ALTER TABLE "EmployeeSalary"
  ADD CONSTRAINT "EmployeeSalary_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSalary"
  ADD CONSTRAINT "EmployeeSalary_endedByUserId_fkey"
  FOREIGN KEY ("endedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "EmployeeSalary"
  DROP CONSTRAINT IF EXISTS "EmployeeSalary_effective_range_excl";

ALTER TABLE "EmployeeSalary"
  ADD CONSTRAINT "EmployeeSalary_effective_range_excl"
  EXCLUDE USING gist (
    "companyId" WITH =,
    "employeeId" WITH =,
    daterange("effectiveFrom"::date, COALESCE("effectiveTo"::date, 'infinity'::date), '[]') WITH &&
  )
  WHERE ("isActive" = true);

-- ─── EmployeeSalaryLine hardening ────────────────────────────────────────────

ALTER TABLE "EmployeeSalaryLine"
  ADD CONSTRAINT "EmployeeSalaryLine_amount_nonneg_chk"
  CHECK ("amount" >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeSalaryLine_employeeSalaryId_salaryComponentId_key"
  ON "EmployeeSalaryLine"("employeeSalaryId", "salaryComponentId");

-- ─── EmployeeTaxProfile hardening ────────────────────────────────────────────

ALTER TABLE "EmployeeTaxProfile"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "effectiveFrom" DATE,
  ADD COLUMN IF NOT EXISTS "effectiveTo" DATE,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_monthlyTaxAmount_nonneg_chk"
  CHECK ("monthlyTaxAmount" >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeTaxProfile_companyId_id_key"
  ON "EmployeeTaxProfile"("companyId", "id");

CREATE INDEX IF NOT EXISTS "EmployeeTaxProfile_companyId_employeeId_effectiveFrom_idx"
  ON "EmployeeTaxProfile"("companyId", "employeeId", "effectiveFrom");

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_endedByUserId_fkey"
  FOREIGN KEY ("endedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeTaxProfile"
  DROP CONSTRAINT IF EXISTS "EmployeeTaxProfile_effective_range_excl";

ALTER TABLE "EmployeeTaxProfile"
  ADD CONSTRAINT "EmployeeTaxProfile_effective_range_excl"
  EXCLUDE USING gist (
    "companyId" WITH =,
    "employeeId" WITH =,
    daterange(
      COALESCE("effectiveFrom", '-infinity'::date),
      COALESCE("effectiveTo", 'infinity'::date),
      '[]'
    ) WITH &&
  )
  WHERE ("isActive" = true AND "archivedAt" IS NULL);

-- ─── EmployeeDeduction hardening ─────────────────────────────────────────────

ALTER TABLE "EmployeeDeduction"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

ALTER TABLE "EmployeeDeduction"
  ADD CONSTRAINT "EmployeeDeduction_monthlyAmount_nonneg_chk"
  CHECK ("monthlyAmount" >= 0);

ALTER TABLE "EmployeeDeduction"
  ADD CONSTRAINT "EmployeeDeduction_endMonth_gte_startMonth_chk"
  CHECK ("endMonth" IS NULL OR "endMonth" >= "startMonth");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDeduction_companyId_id_key"
  ON "EmployeeDeduction"("companyId", "id");

CREATE INDEX IF NOT EXISTS "EmployeeDeduction_companyId_employeeId_isActive_startMonth_idx"
  ON "EmployeeDeduction"("companyId", "employeeId", "isActive", "startMonth");

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDeduction_companyId_deductionCode_key"
  ON "EmployeeDeduction"("companyId", "deductionCode")
  WHERE "deductionCode" IS NOT NULL;

ALTER TABLE "EmployeeDeduction"
  ADD CONSTRAINT "EmployeeDeduction_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeDeduction"
  ADD CONSTRAINT "EmployeeDeduction_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeDeduction"
  ADD CONSTRAINT "EmployeeDeduction_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── PayrollRun hardening ────────────────────────────────────────────────────

ALTER TABLE "PayrollRun"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "runNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "periodStart" DATE,
  ADD COLUMN IF NOT EXISTS "periodEnd" DATE,
  ADD COLUMN IF NOT EXISTS "currencyCode" TEXT,
  ADD COLUMN IF NOT EXISTS "statusEnum" "PayrollRunStatus",
  ADD COLUMN IF NOT EXISTS "totalEarnings" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "totalDeductions" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "totalNet" DECIMAL(18, 2),
  ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "calculatedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "calculatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paidByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "paymentAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "financeTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

UPDATE "PayrollRun"
SET
  "statusEnum" = CASE
    WHEN upper(trim("status")) = 'DRAFT' THEN 'DRAFT'::"PayrollRunStatus"
    WHEN upper(trim("status")) = 'PROCESSED' THEN 'LEGACY_IMPORTED'::"PayrollRunStatus"
    WHEN upper(trim("status")) IN (
      'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED', 'LEGACY_IMPORTED'
    ) THEN upper(trim("status"))::"PayrollRunStatus"
    ELSE "statusEnum"
  END,
  "periodStart" = COALESCE(
    "periodStart",
    make_date("payrollYear", "payrollMonth", 1)
  ),
  "periodEnd" = COALESCE(
    "periodEnd",
    (make_date("payrollYear", "payrollMonth", 1) + interval '1 month' - interval '1 day')::date
  )
WHERE "statusEnum" IS NULL
   OR "periodStart" IS NULL
   OR "periodEnd" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_companyId_id_key"
  ON "PayrollRun"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_companyId_runNumber_key"
  ON "PayrollRun"("companyId", "runNumber")
  WHERE "runNumber" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_companyId_financeTransactionId_key"
  ON "PayrollRun"("companyId", "financeTransactionId")
  WHERE "financeTransactionId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_statusEnum_payrollYear_payrollMonth_idx"
  ON "PayrollRun"("companyId", "statusEnum", "payrollYear", "payrollMonth");

CREATE INDEX IF NOT EXISTS "PayrollRun_companyId_statusEnum_approvedAt_idx"
  ON "PayrollRun"("companyId", "statusEnum", "approvedAt")
  WHERE "statusEnum" = 'APPROVED';

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_payrollMonth_chk"
  CHECK ("payrollMonth" >= 1 AND "payrollMonth" <= 12);

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_totals_nonneg_chk"
  CHECK (
    ("totalEarnings" IS NULL OR "totalEarnings" >= 0)
    AND ("totalDeductions" IS NULL OR "totalDeductions" >= 0)
    AND ("totalNet" IS NULL OR "totalNet" >= 0)
  );

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_calculatedByUserId_fkey"
  FOREIGN KEY ("calculatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_paidByUserId_fkey"
  FOREIGN KEY ("paidByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRun"
  ADD CONSTRAINT "PayrollRun_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- paymentAccountId / financeTransactionId FKs deferred until Office Finance Lite tables land.

-- ─── PayrollRunEmployee hardening ────────────────────────────────────────────

ALTER TABLE "PayrollRunEmployee"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeSalaryId" TEXT,
  ADD COLUMN IF NOT EXISTS "employeeCode" TEXT,
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "designationName" TEXT,
  ADD COLUMN IF NOT EXISTS "totalDeductions" DECIMAL(18, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'PayrollRunEmployee'
      AND column_name = 'grossSalary'
  ) THEN
    ALTER TABLE "PayrollRunEmployee" RENAME COLUMN "grossSalary" TO "grossEarnings";
  END IF;
END $$;

UPDATE "PayrollRunEmployee" pre
SET
  "companyId" = COALESCE(pre."companyId", e."companyId"),
  "branchId" = COALESCE(pre."branchId", e."branchId"),
  "employeeCode" = COALESCE(pre."employeeCode", e."employeeCode"),
  "displayName" = COALESCE(
    pre."displayName",
    trim(both from concat_ws(' ', e."firstName", e."lastName"))
  ),
  "designationName" = COALESCE(pre."designationName", d."designationName"),
  "totalDeductions" = COALESCE(
    pre."totalDeductions",
    COALESCE(pre."taxAmount", 0) + COALESCE(pre."deductionAmount", 0)
  )
FROM "employees" e
LEFT JOIN "designations" d ON d."id" = e."designationId"
WHERE pre."employeeId" = e."id";

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRunEmployee_payrollRunId_employeeId_key"
  ON "PayrollRunEmployee"("payrollRunId", "employeeId");

-- Full unique index required for composite FKs (partial unique indexes are not FK-compatible).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "PayrollRunEmployee" WHERE "companyId" IS NULL) THEN
    RAISE EXCEPTION 'PayrollRunEmployee.companyId backfill incomplete before unique index';
  END IF;
END $$;

ALTER TABLE "PayrollRunEmployee"
  ALTER COLUMN "companyId" SET NOT NULL;

DROP INDEX IF EXISTS "PayrollRunEmployee_companyId_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRunEmployee_companyId_id_key"
  ON "PayrollRunEmployee"("companyId", "id");

CREATE INDEX IF NOT EXISTS "PayrollRunEmployee_employeeId_payrollYear_payrollMonth_idx"
  ON "PayrollRunEmployee"("employeeId", "payrollYear", "payrollMonth");

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_amounts_nonneg_chk"
  CHECK (
    "grossEarnings" >= 0
    AND "taxAmount" >= 0
    AND "deductionAmount" >= 0
    AND ("totalDeductions" IS NULL OR "totalDeductions" >= 0)
    AND "netSalary" >= 0
  );

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_employeeSalaryId_fkey"
  FOREIGN KEY ("employeeSalaryId") REFERENCES "EmployeeSalary"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_company_run_fkey"
  FOREIGN KEY ("companyId", "payrollRunId")
  REFERENCES "PayrollRun"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployee"
  ADD CONSTRAINT "PayrollRunEmployee_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite tenant key required for attendance-period linkage FKs.
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_periods_companyId_id_key"
  ON "attendance_periods"("companyId", "id");

-- ─── PayrollRunAttendancePeriod ────────────────────────────────────────────────

CREATE TABLE "PayrollRunAttendancePeriod" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "attendancePeriodId" TEXT NOT NULL,
  "attendancePeriodVersion" INTEGER NOT NULL,
  "attendancePeriodStatus" "AttendancePeriodStatus" NOT NULL,
  "periodStart" DATE NOT NULL,
  "periodEnd" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRunAttendancePeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRunAttendancePeriod_payrollRunId_attendancePeriodId_key"
  ON "PayrollRunAttendancePeriod"("payrollRunId", "attendancePeriodId");

CREATE UNIQUE INDEX "PayrollRunAttendancePeriod_companyId_id_key"
  ON "PayrollRunAttendancePeriod"("companyId", "id");

CREATE INDEX "PayrollRunAttendancePeriod_companyId_payrollRunId_idx"
  ON "PayrollRunAttendancePeriod"("companyId", "payrollRunId");

CREATE INDEX "PayrollRunAttendancePeriod_attendancePeriodId_idx"
  ON "PayrollRunAttendancePeriod"("attendancePeriodId");

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_company_run_fkey"
  FOREIGN KEY ("companyId", "payrollRunId")
  REFERENCES "PayrollRun"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_company_branch_fkey"
  FOREIGN KEY ("companyId", "branchId")
  REFERENCES "branches"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_attendancePeriodId_fkey"
  FOREIGN KEY ("attendancePeriodId") REFERENCES "attendance_periods"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAttendancePeriod"
  ADD CONSTRAINT "PayrollRunAttendancePeriod_company_attendance_period_fkey"
  FOREIGN KEY ("companyId", "attendancePeriodId")
  REFERENCES "attendance_periods"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── PayrollRunEmployeeLine ──────────────────────────────────────────────────

CREATE TABLE "PayrollRunEmployeeLine" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollRunEmployeeId" TEXT NOT NULL,
  "lineSequence" INTEGER NOT NULL,
  "source" "PayrollLineSource" NOT NULL,
  "direction" "PayrollAdjustmentDirection" NOT NULL,
  "salaryComponentId" TEXT,
  "taxProfileId" TEXT,
  "recurringDeductionId" TEXT,
  "adjustmentId" TEXT,
  "overtimeRequestId" TEXT,
  "leaveRequestId" TEXT,
  "lineCode" TEXT NOT NULL,
  "lineName" TEXT NOT NULL,
  "lineDescription" TEXT,
  "amount" DECIMAL(18, 2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollRunEmployeeLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRunEmployeeLine_payrollRunEmployeeId_lineSequence_key"
  ON "PayrollRunEmployeeLine"("payrollRunEmployeeId", "lineSequence");

CREATE UNIQUE INDEX "PayrollRunEmployeeLine_companyId_id_key"
  ON "PayrollRunEmployeeLine"("companyId", "id");

CREATE INDEX "PayrollRunEmployeeLine_payrollRunEmployeeId_idx"
  ON "PayrollRunEmployeeLine"("payrollRunEmployeeId");

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_amount_nonneg_chk"
  CHECK ("amount" >= 0);

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_payrollRunEmployeeId_fkey"
  FOREIGN KEY ("payrollRunEmployeeId") REFERENCES "PayrollRunEmployee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_company_run_employee_fkey"
  FOREIGN KEY ("companyId", "payrollRunEmployeeId")
  REFERENCES "PayrollRunEmployee"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_salaryComponentId_fkey"
  FOREIGN KEY ("salaryComponentId") REFERENCES "SalaryComponent"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_taxProfileId_fkey"
  FOREIGN KEY ("taxProfileId") REFERENCES "EmployeeTaxProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_recurringDeductionId_fkey"
  FOREIGN KEY ("recurringDeductionId") REFERENCES "EmployeeDeduction"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_overtimeRequestId_fkey"
  FOREIGN KEY ("overtimeRequestId") REFERENCES "overtime_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_leaveRequestId_fkey"
  FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- adjustmentId FK added after PayrollRunAdjustment is created.

-- ─── PayrollRunAdjustment ────────────────────────────────────────────────────

CREATE TABLE "PayrollRunAdjustment" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "direction" "PayrollAdjustmentDirection" NOT NULL,
  "sourceType" "PayrollLineSource" NOT NULL,
  "sourceId" TEXT,
  "amount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "archivedByUserId" TEXT,
  "archiveReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" TEXT,
  "cancellationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollRunAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRunAdjustment_companyId_id_key"
  ON "PayrollRunAdjustment"("companyId", "id");

CREATE INDEX "PayrollRunAdjustment_payrollRunId_employeeId_idx"
  ON "PayrollRunAdjustment"("payrollRunId", "employeeId");

CREATE INDEX "PayrollRunAdjustment_companyId_payrollRunId_idx"
  ON "PayrollRunAdjustment"("companyId", "payrollRunId");

CREATE UNIQUE INDEX "PayrollRunAdjustment_companyId_sourceType_sourceId_claim_key"
  ON "PayrollRunAdjustment"("companyId", "sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL AND "cancelledAt" IS NULL AND "archivedAt" IS NULL;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_amount_positive_chk"
  CHECK ("amount" > 0);

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_company_run_fkey"
  FOREIGN KEY ("companyId", "payrollRunId")
  REFERENCES "PayrollRun"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunAdjustment"
  ADD CONSTRAINT "PayrollRunAdjustment_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollRunEmployeeLine"
  ADD CONSTRAINT "PayrollRunEmployeeLine_adjustmentId_fkey"
  FOREIGN KEY ("adjustmentId") REFERENCES "PayrollRunAdjustment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── PayrollPayslip ────────────────────────────────────────────────────────────

CREATE TABLE "PayrollPayslip" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "payrollRunId" TEXT NOT NULL,
  "payrollRunEmployeeId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeCode" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "payrollYear" INTEGER NOT NULL,
  "payrollMonth" INTEGER NOT NULL,
  "status" "PayrollPayslipStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "fileObjectId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollPayslip_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollPayslip_payrollRunEmployeeId_key"
  ON "PayrollPayslip"("payrollRunEmployeeId");

CREATE UNIQUE INDEX "PayrollPayslip_companyId_id_key"
  ON "PayrollPayslip"("companyId", "id");

CREATE UNIQUE INDEX "PayrollPayslip_fileObjectId_key"
  ON "PayrollPayslip"("fileObjectId")
  WHERE "fileObjectId" IS NOT NULL;

CREATE INDEX "PayrollPayslip_companyId_employeeId_payrollYear_payrollMonth_idx"
  ON "PayrollPayslip"("companyId", "employeeId", "payrollYear", "payrollMonth");

CREATE INDEX "PayrollPayslip_companyId_status_updatedAt_idx"
  ON "PayrollPayslip"("companyId", "status", "updatedAt");

CREATE INDEX "PayrollPayslip_employeeId_status_idx"
  ON "PayrollPayslip"("employeeId", "status");

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_payrollMonth_chk"
  CHECK ("payrollMonth" >= 1 AND "payrollMonth" <= 12);

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_payrollRunId_fkey"
  FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_company_run_fkey"
  FOREIGN KEY ("companyId", "payrollRunId")
  REFERENCES "PayrollRun"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_payrollRunEmployeeId_fkey"
  FOREIGN KEY ("payrollRunEmployeeId") REFERENCES "PayrollRunEmployee"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_company_run_employee_fkey"
  FOREIGN KEY ("companyId", "payrollRunEmployeeId")
  REFERENCES "PayrollRunEmployee"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_company_employee_fkey"
  FOREIGN KEY ("companyId", "employeeId")
  REFERENCES "employees"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollPayslip"
  ADD CONSTRAINT "PayrollPayslip_fileObject_fkey"
  FOREIGN KEY ("companyId", "fileObjectId")
  REFERENCES "dsp_pms"."file_objects"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── PayrollActionEvent ───────────────────────────────────────────────────────

CREATE TABLE "PayrollActionEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "entityType" "PayrollActionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "versionBefore" INTEGER NOT NULL,
  "versionAfter" INTEGER NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "privateReason" TEXT,
  "privateNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollActionEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollActionEvent_companyId_operationId_entityType_action_key"
  ON "PayrollActionEvent"("companyId", "operationId", "entityType", "action");

CREATE INDEX "PayrollActionEvent_companyId_entityType_entityId_createdAt_idx"
  ON "PayrollActionEvent"("companyId", "entityType", "entityId", "createdAt");

CREATE INDEX "PayrollActionEvent_companyId_action_createdAt_idx"
  ON "PayrollActionEvent"("companyId", "action", "createdAt");

ALTER TABLE "PayrollActionEvent"
  ADD CONSTRAINT "PayrollActionEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollActionEvent"
  ADD CONSTRAINT "PayrollActionEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── PayrollCommandReceipt ─────────────────────────────────────────────────────

CREATE TABLE "PayrollCommandReceipt" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestHashKeyVersion" TEXT NOT NULL,
  "requestHashFormatVersion" INTEGER NOT NULL DEFAULT 1,
  "resultEntityType" TEXT,
  "resultEntityId" TEXT,
  "safeResultSnapshot" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollCommandReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollCommandReceipt_companyId_operationId_key"
  ON "PayrollCommandReceipt"("companyId", "operationId");

CREATE INDEX "PayrollCommandReceipt_companyId_commandType_idx"
  ON "PayrollCommandReceipt"("companyId", "commandType");

CREATE INDEX "PayrollCommandReceipt_resultEntityType_resultEntityId_idx"
  ON "PayrollCommandReceipt"("resultEntityType", "resultEntityId");

ALTER TABLE "PayrollCommandReceipt"
  ADD CONSTRAINT "PayrollCommandReceipt_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PayrollCommandReceipt"
  ADD CONSTRAINT "PayrollCommandReceipt_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
