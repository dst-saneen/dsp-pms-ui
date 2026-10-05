-- Optional / floating holidays foundation (Phase 1).
-- Additive: existing calendar events remain mandatory (isOptionalHoliday = false).
-- Existing leave policies remain branch-scoped; company-default policies are newly allowed.

-- 1. Leave type category
ALTER TYPE "LeaveTypeCategory" ADD VALUE IF NOT EXISTS 'OPTIONAL_HOLIDAY';

-- 2. Calendar event classification
ALTER TABLE "business_calendar_events"
  ADD COLUMN IF NOT EXISTS "isOptionalHoliday" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "business_calendar_events_companyId_isOptionalHoliday_startDate_idx"
  ON "business_calendar_events" ("companyId", "isOptionalHoliday", "startDate");

-- 3. Company / year holiday maximum policy
CREATE TABLE IF NOT EXISTS "company_holiday_policies" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "maximumHolidayDays" INTEGER NOT NULL,
  "optionalHolidayLeaveTypeId" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_holiday_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_holiday_policies_year_chk"
    CHECK ("year" BETWEEN 2000 AND 2100),
  CONSTRAINT "company_holiday_policies_maximum_chk"
    CHECK ("maximumHolidayDays" BETWEEN 1 AND 366)
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_holiday_policies_companyId_year_key"
  ON "company_holiday_policies" ("companyId", "year");

CREATE INDEX IF NOT EXISTS "company_holiday_policies_optionalHolidayLeaveTypeId_idx"
  ON "company_holiday_policies" ("optionalHolidayLeaveTypeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_holiday_policies_companyId_fkey'
  ) THEN
    ALTER TABLE "company_holiday_policies"
      ADD CONSTRAINT "company_holiday_policies_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'company_holiday_policies_optionalHolidayLeaveTypeId_fkey'
  ) THEN
    ALTER TABLE "company_holiday_policies"
      ADD CONSTRAINT "company_holiday_policies_optionalHolidayLeaveTypeId_fkey"
      FOREIGN KEY ("optionalHolidayLeaveTypeId") REFERENCES "leave_types"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Leave request link to selected optional calendar event
ALTER TABLE "leave_requests"
  ADD COLUMN IF NOT EXISTS "optionalHolidayEventId" TEXT;

CREATE INDEX IF NOT EXISTS "leave_requests_optionalHolidayEventId_idx"
  ON "leave_requests" ("optionalHolidayEventId");

CREATE INDEX IF NOT EXISTS "leave_requests_employeeId_optionalHolidayEventId_status_idx"
  ON "leave_requests" ("employeeId", "optionalHolidayEventId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_requests_optionalHolidayEventId_fkey'
  ) THEN
    ALTER TABLE "leave_requests"
      ADD CONSTRAINT "leave_requests_optionalHolidayEventId_fkey"
      FOREIGN KEY ("optionalHolidayEventId") REFERENCES "business_calendar_events"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- One active selection per employee/event; cancelled history remains allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "leave_requests_active_optional_event_uidx"
ON "leave_requests" ("employeeId", "optionalHolidayEventId")
WHERE "optionalHolidayEventId" IS NOT NULL
  AND "isActive" = true
  AND "status" <> 'CANCELLED';

-- 5. Company-default leave policies (nullable branch)
ALTER TABLE "leave_policies"
  ALTER COLUMN "branchId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_policies_company_default_scope_chk'
  ) THEN
    ALTER TABLE "leave_policies"
      ADD CONSTRAINT "leave_policies_company_default_scope_chk"
      CHECK (
        "branchId" IS NOT NULL
        OR ("departmentId" IS NULL AND "designationId" IS NULL)
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "leave_policies_active_company_default_uidx"
ON "leave_policies" ("companyId", "leaveTypeId")
WHERE "isActive" = true
  AND "branchId" IS NULL
  AND "departmentId" IS NULL
  AND "designationId" IS NULL;
