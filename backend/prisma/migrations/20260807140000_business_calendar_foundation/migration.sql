-- Business Calendar Stage 1 foundation
-- Additive enums, tables, branch subdivision, runtime snapshot FKs,
-- global lookup seeds, and permission catalog. Idempotent seeds via ON CONFLICT.

-- CreateEnum
CREATE TYPE "BusinessCalendarScope" AS ENUM ('COMPANY', 'BRANCH');

-- CreateEnum
CREATE TYPE "BusinessCalendarRuntimeMode" AS ENUM ('LEGACY', 'SHADOW', 'ACTIVE');

-- CreateEnum
CREATE TYPE "BusinessCalendarVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'SUPERSEDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "BusinessCalendarRuleMode" AS ENUM ('DEFINE', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "BusinessDayEffect" AS ENUM (
  'NONE',
  'NON_WORKING_DAY',
  'WORKING_DAY_OVERRIDE',
  'FIRST_HALF_NON_WORKING',
  'SECOND_HALF_NON_WORKING'
);

-- CreateEnum
CREATE TYPE "BusinessDayStatus" AS ENUM ('WORKING', 'NON_WORKING');

-- CreateEnum
CREATE TYPE "CalendarEventTargetType" AS ENUM ('COMPANY', 'BRANCH', 'DEPARTMENT', 'EMPLOYEE', 'PROJECT');

-- CreateEnum
CREATE TYPE "CalendarSourceKind" AS ENUM (
  'MANUAL',
  'EXCEL',
  'CSV',
  'ICS',
  'REST_API',
  'GOVERNMENT_API',
  'MIGRATION'
);

-- CreateEnum
CREATE TYPE "CalendarImportStatus" AS ENUM (
  'UPLOADED',
  'VALIDATED',
  'REVIEW_REQUIRED',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'FAILED'
);

-- CreateEnum
CREATE TYPE "CalendarImportRowStatus" AS ENUM (
  'VALID',
  'DUPLICATE',
  'CHANGED',
  'INVALID',
  'SELECTED',
  'SKIPPED',
  'PUBLISHED'
);

-- CreateEnum
CREATE TYPE "CalendarImpactStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');

-- AlterTable: normalized subdivision for office location readiness
ALTER TABLE "branches" ADD COLUMN "countrySubdivisionCode" TEXT;

-- CreateTable
CREATE TABLE "business_calendars" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "parentCalendarId" TEXT,
    "scope" "BusinessCalendarScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "calendarCode" TEXT NOT NULL,
    "calendarName" TEXT NOT NULL,
    "defaultTimezone" TEXT NOT NULL,
    "runtimeMode" "BusinessCalendarRuntimeMode" NOT NULL DEFAULT 'LEGACY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_versions" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "BusinessCalendarVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "amendsVersionId" TEXT,
    "changeReason" TEXT,
    "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
    "contentChecksum" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_working_week_rules" (
    "id" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "ruleMode" "BusinessCalendarRuleMode" NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL,
    "dayPortion" "DayPortion" NOT NULL DEFAULT 'FULL_DAY',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_working_week_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_event_types" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "eventTypeCode" TEXT NOT NULL,
    "eventTypeName" TEXT NOT NULL,
    "description" TEXT,
    "allowsBusinessDayEffect" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "colorToken" TEXT,
    "iconKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_event_categories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "colorToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_event_sources" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "scopeKey" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceKind" "CalendarSourceKind" NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_event_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_events" (
    "id" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "eventTypeId" TEXT NOT NULL,
    "eventCategoryId" TEXT NOT NULL,
    "eventSourceId" TEXT NOT NULL,
    "eventCode" TEXT,
    "eventName" TEXT NOT NULL,
    "description" TEXT,
    "allDay" BOOLEAN NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "eventTimezone" TEXT,
    "businessDayEffect" "BusinessDayEffect" NOT NULL DEFAULT 'NONE',
    "paidHoliday" BOOLEAN NOT NULL DEFAULT false,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,
    "externalReference" TEXT,
    "sourcePayloadHash" TEXT,
    "legacyHolidayId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_event_targets" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "targetType" "CalendarEventTargetType" NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "departmentId" TEXT,
    "employeeId" TEXT,
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendar_event_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_amendments" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "previousVersionId" TEXT NOT NULL,
    "amendmentVersionId" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "previousChecksum" TEXT NOT NULL,
    "newChecksum" TEXT NOT NULL,
    "impactSummary" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_calendar_amendments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_runtime_days" (
    "id" TEXT NOT NULL,
    "officeScopeKey" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "calendarId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "runtimeRevision" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "companyVersionId" TEXT NOT NULL,
    "branchVersionId" TEXT,
    "timezone" TEXT NOT NULL,
    "dayStatus" "BusinessDayStatus" NOT NULL,
    "dayPortion" "DayPortion" NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "controllingEventId" TEXT,
    "resolutionTrace" JSONB NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3) NOT NULL,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "business_calendar_runtime_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_impacts" (
    "id" TEXT NOT NULL,
    "amendmentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "businessDate" DATE NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "impactCode" TEXT NOT NULL,
    "impactSummary" TEXT NOT NULL,
    "status" "CalendarImpactStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_impacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_import_batches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "calendarVersionId" TEXT NOT NULL,
    "eventSourceId" TEXT NOT NULL,
    "sourceKind" "CalendarSourceKind" NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceObjectKey" TEXT,
    "sourceChecksum" TEXT NOT NULL,
    "status" "CalendarImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    "changedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "uploadedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_calendar_import_rows" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "externalReference" TEXT,
    "normalizedPayload" JSONB NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" "CalendarImportRowStatus" NOT NULL,
    "validationErrors" JSONB,
    "candidateEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_calendar_import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_request_calendar_days" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "runtimeDayId" TEXT NOT NULL,
    "dayPortion" "DayPortion" NOT NULL,
    "chargedDays" DECIMAL(5,2) NOT NULL,
    "calculationStatus" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_request_calendar_days_pkey" PRIMARY KEY ("id")
);

-- AlterTable: optional runtime snapshot refs
ALTER TABLE "shift_roster_entries" ADD COLUMN "businessCalendarRuntimeDayId" TEXT;
ALTER TABLE "attendances" ADD COLUMN "businessCalendarRuntimeDayId" TEXT;

-- CreateIndex / unique
CREATE UNIQUE INDEX "business_calendars_scopeKey_key" ON "business_calendars"("scopeKey");
CREATE UNIQUE INDEX "business_calendars_companyId_calendarCode_key" ON "business_calendars"("companyId", "calendarCode");
CREATE INDEX "business_calendars_companyId_idx" ON "business_calendars"("companyId");
CREATE INDEX "business_calendars_branchId_idx" ON "business_calendars"("branchId");
CREATE INDEX "business_calendars_parentCalendarId_idx" ON "business_calendars"("parentCalendarId");
CREATE INDEX "business_calendars_createdByUserId_idx" ON "business_calendars"("createdByUserId");
CREATE INDEX "business_calendars_updatedByUserId_idx" ON "business_calendars"("updatedByUserId");

CREATE UNIQUE INDEX "business_calendar_versions_calendarId_versionNumber_key" ON "business_calendar_versions"("calendarId", "versionNumber");
CREATE INDEX "business_calendar_versions_calendarId_status_effectiveFrom_idx" ON "business_calendar_versions"("calendarId", "status", "effectiveFrom");
CREATE INDEX "business_calendar_versions_amendsVersionId_idx" ON "business_calendar_versions"("amendsVersionId");
CREATE INDEX "business_calendar_versions_createdByUserId_idx" ON "business_calendar_versions"("createdByUserId");
CREATE INDEX "business_calendar_versions_submittedByUserId_idx" ON "business_calendar_versions"("submittedByUserId");
CREATE INDEX "business_calendar_versions_reviewedByUserId_idx" ON "business_calendar_versions"("reviewedByUserId");
CREATE INDEX "business_calendar_versions_publishedByUserId_idx" ON "business_calendar_versions"("publishedByUserId");

CREATE UNIQUE INDEX "bc_week_rules_version_dow_key" ON "business_calendar_working_week_rules"("calendarVersionId", "dayOfWeek");
CREATE INDEX "bc_week_rules_calendarVersionId_idx" ON "business_calendar_working_week_rules"("calendarVersionId");

CREATE UNIQUE INDEX "business_calendar_event_types_scopeKey_key" ON "business_calendar_event_types"("scopeKey");
CREATE UNIQUE INDEX "bc_event_types_company_code_key" ON "business_calendar_event_types"("companyId", "eventTypeCode");
CREATE INDEX "business_calendar_event_types_companyId_idx" ON "business_calendar_event_types"("companyId");
CREATE INDEX "bc_event_types_active_order_idx" ON "business_calendar_event_types"("isActive", "displayOrder");

CREATE UNIQUE INDEX "business_calendar_event_categories_scopeKey_key" ON "business_calendar_event_categories"("scopeKey");
CREATE UNIQUE INDEX "bc_event_categories_company_code_key" ON "business_calendar_event_categories"("companyId", "categoryCode");
CREATE INDEX "business_calendar_event_categories_companyId_idx" ON "business_calendar_event_categories"("companyId");
CREATE INDEX "bc_event_categories_active_order_idx" ON "business_calendar_event_categories"("isActive", "displayOrder");

CREATE UNIQUE INDEX "business_calendar_event_sources_scopeKey_key" ON "business_calendar_event_sources"("scopeKey");
CREATE UNIQUE INDEX "bc_event_sources_company_code_key" ON "business_calendar_event_sources"("companyId", "sourceCode");
CREATE INDEX "business_calendar_event_sources_companyId_idx" ON "business_calendar_event_sources"("companyId");
CREATE INDEX "bc_event_sources_active_order_idx" ON "business_calendar_event_sources"("isActive", "displayOrder");

CREATE UNIQUE INDEX "business_calendar_events_legacyHolidayId_key" ON "business_calendar_events"("legacyHolidayId");
CREATE INDEX "bc_events_version_dates_idx" ON "business_calendar_events"("calendarVersionId", "startDate", "endDate");
CREATE INDEX "bc_events_company_dates_idx" ON "business_calendar_events"("companyId", "startDate", "endDate");
CREATE INDEX "business_calendar_events_eventTypeId_idx" ON "business_calendar_events"("eventTypeId");
CREATE INDEX "business_calendar_events_eventCategoryId_idx" ON "business_calendar_events"("eventCategoryId");
CREATE INDEX "business_calendar_events_eventSourceId_idx" ON "business_calendar_events"("eventSourceId");
CREATE INDEX "business_calendar_events_externalReference_idx" ON "business_calendar_events"("externalReference");
CREATE INDEX "business_calendar_events_createdByUserId_idx" ON "business_calendar_events"("createdByUserId");

CREATE UNIQUE INDEX "bc_event_targets_combo_key" ON "business_calendar_event_targets"("eventId", "targetType", "companyId", "branchId", "departmentId", "employeeId", "projectId");
CREATE INDEX "business_calendar_event_targets_eventId_idx" ON "business_calendar_event_targets"("eventId");
CREATE INDEX "business_calendar_event_targets_companyId_idx" ON "business_calendar_event_targets"("companyId");
CREATE INDEX "business_calendar_event_targets_branchId_idx" ON "business_calendar_event_targets"("branchId");
CREATE INDEX "business_calendar_event_targets_departmentId_idx" ON "business_calendar_event_targets"("departmentId");
CREATE INDEX "business_calendar_event_targets_employeeId_idx" ON "business_calendar_event_targets"("employeeId");
CREATE INDEX "business_calendar_event_targets_projectId_idx" ON "business_calendar_event_targets"("projectId");

CREATE UNIQUE INDEX "business_calendar_amendments_amendmentVersionId_key" ON "business_calendar_amendments"("amendmentVersionId");
CREATE INDEX "bc_amendments_calendar_effective_idx" ON "business_calendar_amendments"("calendarId", "effectiveDate");
CREATE INDEX "business_calendar_amendments_previousVersionId_idx" ON "business_calendar_amendments"("previousVersionId");
CREATE INDEX "business_calendar_amendments_createdByUserId_idx" ON "business_calendar_amendments"("createdByUserId");
CREATE INDEX "business_calendar_amendments_publishedByUserId_idx" ON "business_calendar_amendments"("publishedByUserId");

CREATE UNIQUE INDEX "bc_runtime_days_office_date_rev_key" ON "business_calendar_runtime_days"("officeScopeKey", "businessDate", "runtimeRevision");
CREATE INDEX "bc_runtime_days_office_date_current_idx" ON "business_calendar_runtime_days"("officeScopeKey", "businessDate", "isCurrent");
CREATE INDEX "bc_runtime_days_company_date_idx" ON "business_calendar_runtime_days"("companyId", "businessDate");
CREATE INDEX "bc_runtime_days_branch_date_idx" ON "business_calendar_runtime_days"("branchId", "businessDate");
CREATE INDEX "bc_runtime_days_calendar_date_idx" ON "business_calendar_runtime_days"("calendarId", "businessDate");
CREATE INDEX "business_calendar_runtime_days_companyVersionId_idx" ON "business_calendar_runtime_days"("companyVersionId");
CREATE INDEX "business_calendar_runtime_days_branchVersionId_idx" ON "business_calendar_runtime_days"("branchVersionId");
CREATE INDEX "business_calendar_runtime_days_controllingEventId_idx" ON "business_calendar_runtime_days"("controllingEventId");

-- One current runtime day per office + business date
CREATE UNIQUE INDEX "bc_runtime_days_current_office_date_key"
  ON "business_calendar_runtime_days"("officeScopeKey", "businessDate")
  WHERE "isCurrent" = true;

CREATE INDEX "business_calendar_impacts_amendmentId_idx" ON "business_calendar_impacts"("amendmentId");
CREATE INDEX "business_calendar_impacts_companyId_businessDate_idx" ON "business_calendar_impacts"("companyId", "businessDate");
CREATE INDEX "business_calendar_impacts_branchId_businessDate_idx" ON "business_calendar_impacts"("branchId", "businessDate");
CREATE INDEX "business_calendar_impacts_status_createdAt_idx" ON "business_calendar_impacts"("status", "createdAt");
CREATE INDEX "business_calendar_impacts_entityType_entityId_idx" ON "business_calendar_impacts"("entityType", "entityId");
CREATE INDEX "business_calendar_impacts_resolvedByUserId_idx" ON "business_calendar_impacts"("resolvedByUserId");

CREATE INDEX "business_calendar_import_batches_companyId_status_idx" ON "business_calendar_import_batches"("companyId", "status");
CREATE INDEX "business_calendar_import_batches_calendarId_idx" ON "business_calendar_import_batches"("calendarId");
CREATE INDEX "business_calendar_import_batches_calendarVersionId_idx" ON "business_calendar_import_batches"("calendarVersionId");
CREATE INDEX "business_calendar_import_batches_eventSourceId_idx" ON "business_calendar_import_batches"("eventSourceId");
CREATE INDEX "business_calendar_import_batches_sourceChecksum_idx" ON "business_calendar_import_batches"("sourceChecksum");
CREATE INDEX "business_calendar_import_batches_uploadedByUserId_idx" ON "business_calendar_import_batches"("uploadedByUserId");
CREATE INDEX "business_calendar_import_batches_reviewedByUserId_idx" ON "business_calendar_import_batches"("reviewedByUserId");

CREATE UNIQUE INDEX "business_calendar_import_rows_importBatchId_rowNumber_key" ON "business_calendar_import_rows"("importBatchId", "rowNumber");
CREATE INDEX "business_calendar_import_rows_importBatchId_status_idx" ON "business_calendar_import_rows"("importBatchId", "status");
CREATE INDEX "business_calendar_import_rows_externalReference_idx" ON "business_calendar_import_rows"("externalReference");
CREATE INDEX "business_calendar_import_rows_payloadHash_idx" ON "business_calendar_import_rows"("payloadHash");
CREATE INDEX "business_calendar_import_rows_candidateEventId_idx" ON "business_calendar_import_rows"("candidateEventId");

CREATE UNIQUE INDEX "leave_request_calendar_days_leaveRequestId_businessDate_key" ON "leave_request_calendar_days"("leaveRequestId", "businessDate");
CREATE INDEX "leave_request_calendar_days_runtimeDayId_idx" ON "leave_request_calendar_days"("runtimeDayId");
CREATE INDEX "leave_request_calendar_days_businessDate_idx" ON "leave_request_calendar_days"("businessDate");

CREATE INDEX "shift_roster_entries_businessCalendarRuntimeDayId_idx" ON "shift_roster_entries"("businessCalendarRuntimeDayId");
CREATE INDEX "attendances_businessCalendarRuntimeDayId_idx" ON "attendances"("businessCalendarRuntimeDayId");

-- CHECKs
ALTER TABLE "business_calendars"
  ADD CONSTRAINT "business_calendars_scope_parent_check"
  CHECK (
    (
      "scope" = 'COMPANY'
      AND "branchId" IS NULL
      AND "parentCalendarId" IS NULL
      AND "scopeKey" = ('COMPANY:' || "companyId")
    )
    OR (
      "scope" = 'BRANCH'
      AND "branchId" IS NOT NULL
      AND "parentCalendarId" IS NOT NULL
      AND "scopeKey" = ('BRANCH:' || "branchId")
    )
  );

ALTER TABLE "business_calendar_versions"
  ADD CONSTRAINT "business_calendar_versions_version_positive_check"
  CHECK ("versionNumber" > 0);

ALTER TABLE "business_calendar_versions"
  ADD CONSTRAINT "business_calendar_versions_effective_range_check"
  CHECK ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom");

ALTER TABLE "business_calendar_versions"
  ADD CONSTRAINT "business_calendar_versions_optimistic_positive_check"
  CHECK ("optimisticVersion" > 0);

ALTER TABLE "business_calendar_working_week_rules"
  ADD CONSTRAINT "business_calendar_working_week_rules_day_of_week_check"
  CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6);

ALTER TABLE "business_calendar_events"
  ADD CONSTRAINT "business_calendar_events_date_range_check"
  CHECK ("endDate" >= "startDate");

ALTER TABLE "business_calendar_events"
  ADD CONSTRAINT "business_calendar_events_timed_event_check"
  CHECK (
    "allDay" = true
    OR (
      "startsAt" IS NOT NULL
      AND "endsAt" IS NOT NULL
      AND "eventTimezone" IS NOT NULL
      AND "endsAt" > "startsAt"
    )
  );

ALTER TABLE "business_calendar_events"
  ADD CONSTRAINT "business_calendar_events_paid_holiday_effect_check"
  CHECK (
    "paidHoliday" = false
    OR "businessDayEffect" IN (
      'NON_WORKING_DAY',
      'FIRST_HALF_NON_WORKING',
      'SECOND_HALF_NON_WORKING'
    )
  );

ALTER TABLE "business_calendar_event_targets"
  ADD CONSTRAINT "business_calendar_event_targets_exactly_one_check"
  CHECK (
    (
      "targetType" = 'COMPANY'
      AND "branchId" IS NULL
      AND "departmentId" IS NULL
      AND "employeeId" IS NULL
      AND "projectId" IS NULL
    )
    OR (
      "targetType" = 'BRANCH'
      AND "branchId" IS NOT NULL
      AND "departmentId" IS NULL
      AND "employeeId" IS NULL
      AND "projectId" IS NULL
    )
    OR (
      "targetType" = 'DEPARTMENT'
      AND "departmentId" IS NOT NULL
      AND "employeeId" IS NULL
      AND "projectId" IS NULL
      AND "branchId" IS NULL
    )
    OR (
      "targetType" = 'EMPLOYEE'
      AND "employeeId" IS NOT NULL
      AND "departmentId" IS NULL
      AND "projectId" IS NULL
      AND "branchId" IS NULL
    )
    OR (
      "targetType" = 'PROJECT'
      AND "projectId" IS NOT NULL
      AND "departmentId" IS NULL
      AND "employeeId" IS NULL
      AND "branchId" IS NULL
    )
  );

ALTER TABLE "business_calendar_runtime_days"
  ADD CONSTRAINT "business_calendar_runtime_days_revision_positive_check"
  CHECK ("runtimeRevision" > 0);

ALTER TABLE "leave_request_calendar_days"
  ADD CONSTRAINT "leave_request_calendar_days_charged_days_check"
  CHECK ("chargedDays" >= 0 AND "chargedDays" <= 1);

-- Published effective-range overlap protection (requires btree_gist)
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "business_calendar_versions"
  ADD CONSTRAINT "business_calendar_versions_published_range_excl"
  EXCLUDE USING gist (
    "calendarId" WITH =,
    daterange("effectiveFrom", COALESCE("effectiveTo", 'infinity'::date), '[]') WITH &&
  )
  WHERE ("status" = 'PUBLISHED');

-- AddForeignKey
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_parentCalendarId_fkey" FOREIGN KEY ("parentCalendarId") REFERENCES "business_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendars" ADD CONSTRAINT "business_calendars_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_amendsVersionId_fkey" FOREIGN KEY ("amendsVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_versions" ADD CONSTRAINT "business_calendar_versions_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_working_week_rules" ADD CONSTRAINT "business_calendar_working_week_rules_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "business_calendar_event_types" ADD CONSTRAINT "business_calendar_event_types_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_categories" ADD CONSTRAINT "business_calendar_event_categories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_sources" ADD CONSTRAINT "business_calendar_event_sources_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_eventTypeId_fkey" FOREIGN KEY ("eventTypeId") REFERENCES "business_calendar_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_eventCategoryId_fkey" FOREIGN KEY ("eventCategoryId") REFERENCES "business_calendar_event_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_eventSourceId_fkey" FOREIGN KEY ("eventSourceId") REFERENCES "business_calendar_event_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_events" ADD CONSTRAINT "business_calendar_events_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "business_calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_event_targets" ADD CONSTRAINT "business_calendar_event_targets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_amendments" ADD CONSTRAINT "business_calendar_amendments_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_amendments" ADD CONSTRAINT "business_calendar_amendments_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_amendments" ADD CONSTRAINT "business_calendar_amendments_amendmentVersionId_fkey" FOREIGN KEY ("amendmentVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_amendments" ADD CONSTRAINT "business_calendar_amendments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_amendments" ADD CONSTRAINT "business_calendar_amendments_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_companyVersionId_fkey" FOREIGN KEY ("companyVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_branchVersionId_fkey" FOREIGN KEY ("branchVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_runtime_days" ADD CONSTRAINT "business_calendar_runtime_days_controllingEventId_fkey" FOREIGN KEY ("controllingEventId") REFERENCES "business_calendar_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_impacts" ADD CONSTRAINT "business_calendar_impacts_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "business_calendar_amendments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_impacts" ADD CONSTRAINT "business_calendar_impacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_impacts" ADD CONSTRAINT "business_calendar_impacts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_impacts" ADD CONSTRAINT "business_calendar_impacts_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "business_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_calendarVersionId_fkey" FOREIGN KEY ("calendarVersionId") REFERENCES "business_calendar_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_eventSourceId_fkey" FOREIGN KEY ("eventSourceId") REFERENCES "business_calendar_event_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_batches" ADD CONSTRAINT "business_calendar_import_batches_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "business_calendar_import_rows" ADD CONSTRAINT "business_calendar_import_rows_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "business_calendar_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_calendar_import_rows" ADD CONSTRAINT "business_calendar_import_rows_candidateEventId_fkey" FOREIGN KEY ("candidateEventId") REFERENCES "business_calendar_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "leave_request_calendar_days" ADD CONSTRAINT "leave_request_calendar_days_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "leave_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "leave_request_calendar_days" ADD CONSTRAINT "leave_request_calendar_days_runtimeDayId_fkey" FOREIGN KEY ("runtimeDayId") REFERENCES "business_calendar_runtime_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shift_roster_entries" ADD CONSTRAINT "shift_roster_entries_businessCalendarRuntimeDayId_fkey" FOREIGN KEY ("businessCalendarRuntimeDayId") REFERENCES "business_calendar_runtime_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_businessCalendarRuntimeDayId_fkey" FOREIGN KEY ("businessCalendarRuntimeDayId") REFERENCES "business_calendar_runtime_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Branch belongs to same company as calendar (when branch is set)
ALTER TABLE "branches"
  ADD CONSTRAINT "branches_id_companyId_key" UNIQUE ("id", "companyId");

ALTER TABLE "business_calendars"
  ADD CONSTRAINT "business_calendars_branch_company_fkey"
  FOREIGN KEY ("branchId", "companyId") REFERENCES "branches"("id", "companyId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed protected global event types (companyId NULL, isSystem true)
INSERT INTO "business_calendar_event_types" (
  "id", "companyId", "scopeKey", "eventTypeCode", "eventTypeName", "description",
  "allowsBusinessDayEffect", "isSystem", "isActive", "displayOrder", "colorToken", "iconKey",
  "createdAt", "updatedAt"
)
VALUES
  (md5('business-calendar-event-type:GLOBAL:HOLIDAY'), NULL, 'GLOBAL:HOLIDAY', 'HOLIDAY', 'Holiday', 'Statutory or company holiday that may change business-day status', true, true, true, 10, 'holiday', 'calendar-holiday', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:CELEBRATION'), NULL, 'GLOBAL:CELEBRATION', 'CELEBRATION', 'Celebration', 'Informational celebration or observance', false, true, true, 20, 'celebration', 'calendar-celebration', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:MEETING'), NULL, 'GLOBAL:MEETING', 'MEETING', 'Meeting', 'Meeting or assembly; does not change business-day by default', false, true, true, 30, 'meeting', 'calendar-meeting', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:TRAINING'), NULL, 'GLOBAL:TRAINING', 'TRAINING', 'Training', 'Training or learning event', false, true, true, 40, 'training', 'calendar-training', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:MAINTENANCE'), NULL, 'GLOBAL:MAINTENANCE', 'MAINTENANCE', 'Maintenance', 'Maintenance window that may close operations', true, true, true, 50, 'maintenance', 'calendar-maintenance', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:SHUTDOWN'), NULL, 'GLOBAL:SHUTDOWN', 'SHUTDOWN', 'Shutdown', 'Planned operational shutdown', true, true, true, 60, 'shutdown', 'calendar-shutdown', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:PAYROLL'), NULL, 'GLOBAL:PAYROLL', 'PAYROLL', 'Payroll', 'Payroll processing marker', false, true, true, 70, 'payroll', 'calendar-payroll', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:AUDIT'), NULL, 'GLOBAL:AUDIT', 'AUDIT', 'Audit', 'Audit or compliance marker', false, true, true, 80, 'audit', 'calendar-audit', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-type:GLOBAL:CUSTOM'), NULL, 'GLOBAL:CUSTOM', 'CUSTOM', 'Custom', 'Tenant-defined custom event type', true, true, true, 90, 'custom', 'calendar-custom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "eventTypeName" = EXCLUDED."eventTypeName",
  "description" = EXCLUDED."description",
  "allowsBusinessDayEffect" = EXCLUDED."allowsBusinessDayEffect",
  "isSystem" = true,
  "isActive" = true,
  "displayOrder" = EXCLUDED."displayOrder",
  "colorToken" = EXCLUDED."colorToken",
  "iconKey" = EXCLUDED."iconKey",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed protected global event categories
INSERT INTO "business_calendar_event_categories" (
  "id", "companyId", "scopeKey", "categoryCode", "categoryName", "description",
  "isSystem", "isActive", "displayOrder", "colorToken", "createdAt", "updatedAt"
)
VALUES
  (md5('business-calendar-event-category:GLOBAL:GOVERNMENT'), NULL, 'GLOBAL:GOVERNMENT', 'GOVERNMENT', 'Government', 'Government or statutory observances', true, true, 10, 'government', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-category:GLOBAL:COMPANY'), NULL, 'GLOBAL:COMPANY', 'COMPANY', 'Company', 'Company-declared events', true, true, 20, 'company', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-category:GLOBAL:REGIONAL'), NULL, 'GLOBAL:REGIONAL', 'REGIONAL', 'Regional', 'Regional or state observances', true, true, 30, 'regional', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-category:GLOBAL:OPERATIONAL'), NULL, 'GLOBAL:OPERATIONAL', 'OPERATIONAL', 'Operational', 'Operational closures and maintenance', true, true, 40, 'operational', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-category:GLOBAL:SYSTEM'), NULL, 'GLOBAL:SYSTEM', 'SYSTEM', 'System', 'System-generated markers', true, true, 50, 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-category:GLOBAL:CUSTOM'), NULL, 'GLOBAL:CUSTOM', 'CUSTOM', 'Custom', 'Tenant-defined categories', true, true, 60, 'custom', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "categoryName" = EXCLUDED."categoryName",
  "description" = EXCLUDED."description",
  "isSystem" = true,
  "isActive" = true,
  "displayOrder" = EXCLUDED."displayOrder",
  "colorToken" = EXCLUDED."colorToken",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed protected global event sources
INSERT INTO "business_calendar_event_sources" (
  "id", "companyId", "scopeKey", "sourceCode", "sourceName", "sourceKind", "description",
  "isSystem", "isActive", "displayOrder", "createdAt", "updatedAt"
)
VALUES
  (md5('business-calendar-event-source:GLOBAL:MANUAL'), NULL, 'GLOBAL:MANUAL', 'MANUAL', 'Manual', 'MANUAL', 'Manually entered events', true, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:EXCEL'), NULL, 'GLOBAL:EXCEL', 'EXCEL', 'Excel', 'EXCEL', 'Imported from Excel workbook', true, true, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:CSV'), NULL, 'GLOBAL:CSV', 'CSV', 'CSV', 'CSV', 'Imported from CSV file', true, true, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:ICS'), NULL, 'GLOBAL:ICS', 'ICS', 'ICS', 'ICS', 'Imported from iCalendar feed', true, true, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:REST_API'), NULL, 'GLOBAL:REST_API', 'REST_API', 'REST API', 'REST_API', 'Imported via REST API', true, true, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:GOVERNMENT_API'), NULL, 'GLOBAL:GOVERNMENT_API', 'GOVERNMENT_API', 'Government API', 'GOVERNMENT_API', 'Imported from government holiday API', true, true, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('business-calendar-event-source:GLOBAL:MIGRATION'), NULL, 'GLOBAL:MIGRATION', 'MIGRATION', 'Migration', 'MIGRATION', 'Backfilled from legacy holiday data', true, true, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("scopeKey") DO UPDATE SET
  "sourceName" = EXCLUDED."sourceName",
  "sourceKind" = EXCLUDED."sourceKind",
  "description" = EXCLUDED."description",
  "isSystem" = true,
  "isActive" = true,
  "displayOrder" = EXCLUDED."displayOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Permission catalog (work order §9)
INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (md5('permission:calendar.business.read'), 'calendar.business.read', 'Read business calendars', 'View company and branch business calendars', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.manage'), 'calendar.business.manage', 'Manage business calendars', 'Create and edit business calendar drafts', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.review'), 'calendar.business.review', 'Review business calendars', 'Review calendar versions submitted for approval', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.publish'), 'calendar.business.publish', 'Publish business calendars', 'Publish calendar versions to runtime', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.amend'), 'calendar.business.amend', 'Amend business calendars', 'Create amendment revisions against published calendars', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.import'), 'calendar.business.import', 'Import business calendar events', 'Upload and review calendar import batches', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.runtime.preview'), 'calendar.business.runtime.preview', 'Preview business-day runtime', 'Preview resolved business-day results', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:calendar.business.protected-override'), 'calendar.business.protected-override', 'Override protected calendar events', 'Override protected statutory holidays with elevated reason', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Role mappings: Owner + Admin all; HR all except protected-override
WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'calendar.business.read'),
    ('ORGANIZATION_OWNER', 'calendar.business.manage'),
    ('ORGANIZATION_OWNER', 'calendar.business.review'),
    ('ORGANIZATION_OWNER', 'calendar.business.publish'),
    ('ORGANIZATION_OWNER', 'calendar.business.amend'),
    ('ORGANIZATION_OWNER', 'calendar.business.import'),
    ('ORGANIZATION_OWNER', 'calendar.business.runtime.preview'),
    ('ORGANIZATION_OWNER', 'calendar.business.protected-override'),

    ('COMPANY_ADMINISTRATOR', 'calendar.business.read'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.manage'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.review'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.publish'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.amend'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.import'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.runtime.preview'),
    ('COMPANY_ADMINISTRATOR', 'calendar.business.protected-override'),

    ('HR_MANAGER', 'calendar.business.read'),
    ('HR_MANAGER', 'calendar.business.manage'),
    ('HR_MANAGER', 'calendar.business.review'),
    ('HR_MANAGER', 'calendar.business.publish'),
    ('HR_MANAGER', 'calendar.business.amend'),
    ('HR_MANAGER', 'calendar.business.import'),
    ('HR_MANAGER', 'calendar.business.runtime.preview')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || mapping."roleCode" || ':' || mapping."permissionCode"),
  role."id",
  permission."id"
FROM mappings mapping
JOIN "roles" role ON role."code" = mapping."roleCode" AND role."isSystem" = true
JOIN "permissions" permission ON permission."code" = mapping."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
