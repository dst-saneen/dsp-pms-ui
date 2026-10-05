-- Asset V2 expand migration (Section 2): nullable V2 columns, new tables, non-blocking indexes.
-- Contract enforcement (NOT NULL, composite FKs, triggers) follows in a later migration after backfill.

-- ============================================================================
-- 1. Supporting composite unique keys
-- ============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "branches_companyId_id_key"
  ON "branches"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "departments_companyId_branchId_id_key"
  ON "departments"("companyId", "branchId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "asset_categories_companyId_id_key"
  ON "asset_categories"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "employees_companyId_id_key"
  ON "employees"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "assets_companyId_id_key"
  ON "assets"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_clearance_items_clearanceId_id_key"
  ON "employee_clearance_items"("clearanceId", "id");

-- ============================================================================
-- 2. Extend existing taxonomy / inventory tables
-- ============================================================================
ALTER TABLE "asset_categories"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;

ALTER TABLE "asset_types"
  ADD COLUMN IF NOT EXISTS "kind" "AssetKind",
  ADD COLUMN IF NOT EXISTS "trackingMode" "AssetTrackingMode",
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;

ALTER TABLE "assets"
  ADD COLUMN IF NOT EXISTS "departmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" "AssetKind",
  ADD COLUMN IF NOT EXISTS "trackingMode" "AssetTrackingMode",
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "AssetLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "serialNumberNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedByUserId" TEXT;

ALTER TABLE "employee_assets"
  ADD COLUMN IF NOT EXISTS "companyId" TEXT,
  ADD COLUMN IF NOT EXISTS "branchIdAtAssignment" TEXT,
  ADD COLUMN IF NOT EXISTS "departmentIdAtAssignment" TEXT,
  ADD COLUMN IF NOT EXISTS "custodyStatus" "EmployeeAssetStatus",
  ADD COLUMN IF NOT EXISTS "assignedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acknowledgedByUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "conditionOnReturn" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceType" "AssetSourceType" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCommandKey" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceCommandHash" TEXT,
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Archive actor FKs (SetNull — non-authoritative metadata)
ALTER TABLE "asset_categories" DROP CONSTRAINT IF EXISTS "asset_categories_archivedByUserId_fkey";
ALTER TABLE "asset_categories"
  ADD CONSTRAINT "asset_categories_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "asset_types" DROP CONSTRAINT IF EXISTS "asset_types_archivedByUserId_fkey";
ALTER TABLE "asset_types"
  ADD CONSTRAINT "asset_types_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_archivedByUserId_fkey";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_archivedByUserId_fkey"
  FOREIGN KEY ("archivedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_departmentId_fkey";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite AssetType -> AssetCategory integrity (company-safe)
ALTER TABLE "asset_types" DROP CONSTRAINT IF EXISTS "asset_types_assetCategoryId_fkey";
ALTER TABLE "asset_types"
  ADD CONSTRAINT "asset_types_companyId_assetCategoryId_fkey"
  FOREIGN KEY ("companyId", "assetCategoryId")
  REFERENCES "asset_categories"("companyId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "asset_types_companyId_id_key"
  ON "asset_types"("companyId", "id");

CREATE UNIQUE INDEX IF NOT EXISTS "asset_types_companyId_id_kind_trackingMode_key"
  ON "asset_types"("companyId", "id", "kind", "trackingMode");

CREATE INDEX IF NOT EXISTS "assets_departmentId_idx" ON "assets"("departmentId");
CREATE INDEX IF NOT EXISTS "assets_lifecycleStatus_idx" ON "assets"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "employee_assets_companyId_idx" ON "employee_assets"("companyId");
CREATE INDEX IF NOT EXISTS "employee_assets_custodyStatus_idx" ON "employee_assets"("custodyStatus");
CREATE INDEX IF NOT EXISTS "employee_assets_employeeId_custodyStatus_idx" ON "employee_assets"("employeeId", "custodyStatus");
CREATE INDEX IF NOT EXISTS "employee_assets_assetId_custodyStatus_idx" ON "employee_assets"("assetId", "custodyStatus");
CREATE INDEX IF NOT EXISTS "employee_assets_companyId_sourceCommandKey_idx" ON "employee_assets"("companyId", "sourceCommandKey");

CREATE UNIQUE INDEX IF NOT EXISTS "employee_assets_companyId_id_employeeId_key"
  ON "employee_assets"("companyId", "id", "employeeId")
  WHERE "companyId" IS NOT NULL;

-- V2 custody partial unique (coexists with legacy status index during dual-write)
CREATE UNIQUE INDEX IF NOT EXISTS "employee_assets_one_active_custody_per_asset_idx"
  ON "employee_assets"("assetId")
  WHERE "custodyStatus" = 'ASSIGNED' AND "closedAt" IS NULL;

-- ============================================================================
-- 3. New V2 tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS "asset_card_details" (
  "assetId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "cardNumberCiphertext" BYTEA NOT NULL,
  "encryptionNonce" BYTEA NOT NULL,
  "encryptionAuthTag" BYTEA NOT NULL,
  "wrappedDataKey" BYTEA NOT NULL,
  "maskedCardNumber" TEXT NOT NULL,
  "keyEncryptionKeyVersion" TEXT NOT NULL,
  "encryptionFormatVersion" INTEGER NOT NULL,
  "issuer" TEXT,
  "accessZone" TEXT,
  "issuedDate" DATE NOT NULL,
  "expiryDate" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_card_details_pkey" PRIMARY KEY ("assetId")
);

CREATE TABLE IF NOT EXISTS "asset_card_lookup_indexes" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "lookupKeyVersion" TEXT NOT NULL,
  "digest" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_card_lookup_indexes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_software_license_details" (
  "assetId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "vendorName" TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "contractReference" TEXT,
  "vaultReference" TEXT,
  "startsOn" DATE,
  "expiresOn" DATE,
  "renewsOn" DATE,
  "seatCapacity" INTEGER NOT NULL DEFAULT 1,
  "allocatedSeatCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_software_license_details_pkey" PRIMARY KEY ("assetId")
);

CREATE TABLE IF NOT EXISTS "software_license_allocations" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "status" "LicenseAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "allocatedAt" TIMESTAMP(3) NOT NULL,
  "allocatedByUserId" TEXT NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByUserId" TEXT,
  "sourceType" "AssetSourceType" NOT NULL DEFAULT 'MANUAL',
  "sourceId" TEXT,
  "sourceCommandKey" TEXT,
  "sourceCommandHash" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "remarks" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "software_license_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "department_asset_grants" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "department_asset_grants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_ownership_transfers" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "fromBranchId" TEXT NOT NULL,
  "fromDepartmentId" TEXT NOT NULL,
  "toBranchId" TEXT NOT NULL,
  "toDepartmentId" TEXT NOT NULL,
  "status" "AssetTransferStatus" NOT NULL DEFAULT 'PENDING',
  "reason" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "cancelledByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "forcedByUserId" TEXT,
  "forcedAt" TIMESTAMP(3),
  "forceReason" TEXT,
  "assetVersionAtRequest" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_ownership_transfers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_domain_action_events" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "departmentId" TEXT,
  "entityType" "AssetActionEntityType" NOT NULL,
  "action" "AssetActionType" NOT NULL,
  "assetCategoryId" TEXT,
  "assetTypeId" TEXT,
  "assetId" TEXT,
  "licenseAllocationId" TEXT,
  "departmentGrantId" TEXT,
  "effectiveDate" DATE,
  "privateReason" TEXT,
  "privateNote" TEXT,
  "actorUserId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "versionBefore" INTEGER NOT NULL,
  "versionAfter" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_domain_action_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_custody_requests" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "targetType" "AssetCustodyTargetType" NOT NULL,
  "employeeAssetId" TEXT,
  "licenseAllocationId" TEXT,
  "requestType" "AssetCustodyRequestType" NOT NULL,
  "status" "AssetCustodyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "occurredOn" DATE,
  "employeeNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNote" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_custody_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_clearance_items" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "clearanceId" TEXT NOT NULL,
  "clearanceSummaryItemId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "employeeAssetId" TEXT,
  "licenseAllocationId" TEXT,
  "status" "AssetClearanceItemStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "resolutionType" "AssetClearanceResolutionType",
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_clearance_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_clearance_waivers" (
  "id" TEXT NOT NULL,
  "assetClearanceItemId" TEXT NOT NULL,
  "status" "AssetClearanceWaiverStatus" NOT NULL DEFAULT 'REQUESTED',
  "reasonCode" "AssetClearanceWaiverReasonCode" NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReference" TEXT,
  "requestedByUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL,
  "decidedByUserId" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decisionNote" TEXT,
  "cancelledByUserId" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_clearance_waivers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "asset_command_receipts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "commandType" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "requestHashKeyVersion" TEXT NOT NULL,
  "requestHashFormatVersion" INTEGER NOT NULL,
  "resultEntityType" TEXT,
  "resultEntityId" TEXT,
  "safeResultSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "asset_command_receipts_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 4. Foreign keys for new tables
-- ============================================================================
ALTER TABLE "asset_card_details" DROP CONSTRAINT IF EXISTS "asset_card_details_assetId_fkey";
ALTER TABLE "asset_card_details"
  ADD CONSTRAINT "asset_card_details_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_card_lookup_indexes" DROP CONSTRAINT IF EXISTS "asset_card_lookup_indexes_assetId_fkey";
ALTER TABLE "asset_card_lookup_indexes"
  ADD CONSTRAINT "asset_card_lookup_indexes_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_software_license_details" DROP CONSTRAINT IF EXISTS "asset_software_license_details_assetId_fkey";
ALTER TABLE "asset_software_license_details"
  ADD CONSTRAINT "asset_software_license_details_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_assetId_fkey";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_employeeId_fkey";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_allocatedByUserId_fkey";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_allocatedByUserId_fkey"
  FOREIGN KEY ("allocatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_revokedByUserId_fkey";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_acknowledgedByUserId_fkey";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_acknowledgedByUserId_fkey"
  FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "department_asset_grants" DROP CONSTRAINT IF EXISTS "department_asset_grants_departmentId_fkey";
ALTER TABLE "department_asset_grants"
  ADD CONSTRAINT "department_asset_grants_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_asset_grants" DROP CONSTRAINT IF EXISTS "department_asset_grants_userId_fkey";
ALTER TABLE "department_asset_grants"
  ADD CONSTRAINT "department_asset_grants_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_asset_grants" DROP CONSTRAINT IF EXISTS "department_asset_grants_grantedByUserId_fkey";
ALTER TABLE "department_asset_grants"
  ADD CONSTRAINT "department_asset_grants_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "department_asset_grants" DROP CONSTRAINT IF EXISTS "department_asset_grants_revokedByUserId_fkey";
ALTER TABLE "department_asset_grants"
  ADD CONSTRAINT "department_asset_grants_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_assetId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_fromDepartmentId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_fromDepartmentId_fkey"
  FOREIGN KEY ("fromDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_toDepartmentId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_toDepartmentId_fkey"
  FOREIGN KEY ("toDepartmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_requestedByUserId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_decidedByUserId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_cancelledByUserId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_transfers" DROP CONSTRAINT IF EXISTS "asset_ownership_transfers_forcedByUserId_fkey";
ALTER TABLE "asset_ownership_transfers"
  ADD CONSTRAINT "asset_ownership_transfers_forcedByUserId_fkey"
  FOREIGN KEY ("forcedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_domain_action_events" DROP CONSTRAINT IF EXISTS "asset_domain_action_events_actorUserId_fkey";
ALTER TABLE "asset_domain_action_events"
  ADD CONSTRAINT "asset_domain_action_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_custody_requests" DROP CONSTRAINT IF EXISTS "asset_custody_requests_employeeId_fkey";
ALTER TABLE "asset_custody_requests"
  ADD CONSTRAINT "asset_custody_requests_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_custody_requests" DROP CONSTRAINT IF EXISTS "asset_custody_requests_employeeAssetId_fkey";
ALTER TABLE "asset_custody_requests"
  ADD CONSTRAINT "asset_custody_requests_employeeAssetId_fkey"
  FOREIGN KEY ("employeeAssetId") REFERENCES "employee_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_custody_requests" DROP CONSTRAINT IF EXISTS "asset_custody_requests_licenseAllocationId_fkey";
ALTER TABLE "asset_custody_requests"
  ADD CONSTRAINT "asset_custody_requests_licenseAllocationId_fkey"
  FOREIGN KEY ("licenseAllocationId") REFERENCES "software_license_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_custody_requests" DROP CONSTRAINT IF EXISTS "asset_custody_requests_reviewedByUserId_fkey";
ALTER TABLE "asset_custody_requests"
  ADD CONSTRAINT "asset_custody_requests_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_custody_requests" DROP CONSTRAINT IF EXISTS "asset_custody_requests_resolvedByUserId_fkey";
ALTER TABLE "asset_custody_requests"
  ADD CONSTRAINT "asset_custody_requests_resolvedByUserId_fkey"
  FOREIGN KEY ("resolvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_clearance_items" DROP CONSTRAINT IF EXISTS "asset_clearance_items_clearanceId_fkey";
ALTER TABLE "asset_clearance_items"
  ADD CONSTRAINT "asset_clearance_items_clearanceId_fkey"
  FOREIGN KEY ("clearanceId") REFERENCES "employee_clearances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_items" DROP CONSTRAINT IF EXISTS "asset_clearance_items_clearanceSummaryItemId_fkey";
ALTER TABLE "asset_clearance_items"
  ADD CONSTRAINT "asset_clearance_items_clearanceSummaryItemId_fkey"
  FOREIGN KEY ("clearanceId", "clearanceSummaryItemId")
  REFERENCES "employee_clearance_items"("clearanceId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_items" DROP CONSTRAINT IF EXISTS "asset_clearance_items_employeeId_fkey";
ALTER TABLE "asset_clearance_items"
  ADD CONSTRAINT "asset_clearance_items_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_items" DROP CONSTRAINT IF EXISTS "asset_clearance_items_employeeAssetId_fkey";
ALTER TABLE "asset_clearance_items"
  ADD CONSTRAINT "asset_clearance_items_employeeAssetId_fkey"
  FOREIGN KEY ("employeeAssetId") REFERENCES "employee_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_items" DROP CONSTRAINT IF EXISTS "asset_clearance_items_licenseAllocationId_fkey";
ALTER TABLE "asset_clearance_items"
  ADD CONSTRAINT "asset_clearance_items_licenseAllocationId_fkey"
  FOREIGN KEY ("licenseAllocationId") REFERENCES "software_license_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_clearance_waivers" DROP CONSTRAINT IF EXISTS "asset_clearance_waivers_assetClearanceItemId_fkey";
ALTER TABLE "asset_clearance_waivers"
  ADD CONSTRAINT "asset_clearance_waivers_assetClearanceItemId_fkey"
  FOREIGN KEY ("assetClearanceItemId") REFERENCES "asset_clearance_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_waivers" DROP CONSTRAINT IF EXISTS "asset_clearance_waivers_requestedByUserId_fkey";
ALTER TABLE "asset_clearance_waivers"
  ADD CONSTRAINT "asset_clearance_waivers_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_waivers" DROP CONSTRAINT IF EXISTS "asset_clearance_waivers_decidedByUserId_fkey";
ALTER TABLE "asset_clearance_waivers"
  ADD CONSTRAINT "asset_clearance_waivers_decidedByUserId_fkey"
  FOREIGN KEY ("decidedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_clearance_waivers" DROP CONSTRAINT IF EXISTS "asset_clearance_waivers_cancelledByUserId_fkey";
ALTER TABLE "asset_clearance_waivers"
  ADD CONSTRAINT "asset_clearance_waivers_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "asset_command_receipts" DROP CONSTRAINT IF EXISTS "asset_command_receipts_actorUserId_fkey";
ALTER TABLE "asset_command_receipts"
  ADD CONSTRAINT "asset_command_receipts_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_assignedByUserId_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_closedByUserId_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_closedByUserId_fkey"
  FOREIGN KEY ("closedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_acknowledgedByUserId_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_acknowledgedByUserId_fkey"
  FOREIGN KEY ("acknowledgedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_branchIdAtAssignment_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_branchIdAtAssignment_fkey"
  FOREIGN KEY ("branchIdAtAssignment") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_departmentIdAtAssignment_fkey";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_departmentIdAtAssignment_fkey"
  FOREIGN KEY ("departmentIdAtAssignment") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- 5. Indexes and partial uniques (non-blocking)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "asset_card_details_companyId_idx" ON "asset_card_details"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_card_lookup_company_version_digest_key"
  ON "asset_card_lookup_indexes"("companyId", "lookupKeyVersion", "digest");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_card_lookup_asset_version_key"
  ON "asset_card_lookup_indexes"("companyId", "assetId", "lookupKeyVersion");

CREATE INDEX IF NOT EXISTS "asset_software_license_details_companyId_idx" ON "asset_software_license_details"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "software_license_allocations_companyId_id_key"
  ON "software_license_allocations"("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "software_license_allocations_companyId_id_employeeId_key"
  ON "software_license_allocations"("companyId", "id", "employeeId");
CREATE INDEX IF NOT EXISTS "software_license_allocations_employeeId_status_idx"
  ON "software_license_allocations"("employeeId", "status");
CREATE INDEX IF NOT EXISTS "software_license_allocations_assetId_status_idx"
  ON "software_license_allocations"("assetId", "status");
CREATE INDEX IF NOT EXISTS "software_license_allocations_companyId_status_idx"
  ON "software_license_allocations"("companyId", "status");
CREATE INDEX IF NOT EXISTS "software_license_allocations_companyId_sourceCommandKey_idx"
  ON "software_license_allocations"("companyId", "sourceCommandKey");
CREATE UNIQUE INDEX IF NOT EXISTS "software_license_allocations_one_active_employee_idx"
  ON "software_license_allocations"("assetId", "employeeId")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "department_asset_grants_userId_departmentId_key"
  ON "department_asset_grants"("userId", "departmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "department_asset_grants_companyId_id_key"
  ON "department_asset_grants"("companyId", "id");
CREATE INDEX IF NOT EXISTS "department_asset_grants_companyId_branchId_departmentId_idx"
  ON "department_asset_grants"("companyId", "branchId", "departmentId");

CREATE INDEX IF NOT EXISTS "asset_ownership_transfers_companyId_assetId_status_idx"
  ON "asset_ownership_transfers"("companyId", "assetId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_ownership_transfers_one_pending_per_asset_idx"
  ON "asset_ownership_transfers"("assetId")
  WHERE "status" = 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "asset_domain_action_events_companyId_operationId_action_key"
  ON "asset_domain_action_events"("companyId", "operationId", "action");
CREATE INDEX IF NOT EXISTS "asset_domain_action_events_companyId_action_createdAt_idx"
  ON "asset_domain_action_events"("companyId", "action", "createdAt");

CREATE INDEX IF NOT EXISTS "asset_custody_requests_companyId_employeeId_status_idx"
  ON "asset_custody_requests"("companyId", "employeeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_custody_requests_one_open_employee_asset_idx"
  ON "asset_custody_requests"("employeeAssetId")
  WHERE "status" IN ('SUBMITTED', 'IN_REVIEW') AND "employeeAssetId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "asset_custody_requests_one_open_license_allocation_idx"
  ON "asset_custody_requests"("licenseAllocationId")
  WHERE "status" IN ('SUBMITTED', 'IN_REVIEW') AND "licenseAllocationId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "asset_clearance_items_clearanceId_status_idx"
  ON "asset_clearance_items"("clearanceId", "status");
CREATE INDEX IF NOT EXISTS "asset_clearance_items_employeeId_status_idx"
  ON "asset_clearance_items"("employeeId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_clearance_items_one_per_clearance_employee_asset_idx"
  ON "asset_clearance_items"("clearanceId", "employeeAssetId")
  WHERE "employeeAssetId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "asset_clearance_items_one_per_clearance_license_allocation_idx"
  ON "asset_clearance_items"("clearanceId", "licenseAllocationId")
  WHERE "licenseAllocationId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "asset_clearance_waivers_assetClearanceItemId_status_idx"
  ON "asset_clearance_waivers"("assetClearanceItemId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "asset_clearance_waivers_one_requested_per_item_idx"
  ON "asset_clearance_waivers"("assetClearanceItemId")
  WHERE "status" = 'REQUESTED';

CREATE UNIQUE INDEX IF NOT EXISTS "asset_command_receipts_companyId_operationId_key"
  ON "asset_command_receipts"("companyId", "operationId");
CREATE INDEX IF NOT EXISTS "asset_command_receipts_companyId_commandType_idx"
  ON "asset_command_receipts"("companyId", "commandType");

CREATE UNIQUE INDEX IF NOT EXISTS "assets_company_serial_normalized_key"
  ON "assets"("companyId", "serialNumberNormalized")
  WHERE "serialNumberNormalized" IS NOT NULL;

-- Expand-safe CHECK constraints (allow NULL classification during backfill)
ALTER TABLE "asset_types" DROP CONSTRAINT IF EXISTS "asset_types_kind_tracking_check";
ALTER TABLE "asset_types"
  ADD CONSTRAINT "asset_types_kind_tracking_check"
  CHECK (
    ("kind" IS NULL AND "trackingMode" IS NULL) OR
    (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
    (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
  ) NOT VALID;

ALTER TABLE "assets" DROP CONSTRAINT IF EXISTS "assets_kind_tracking_check";
ALTER TABLE "assets"
  ADD CONSTRAINT "assets_kind_tracking_check"
  CHECK (
    ("kind" IS NULL AND "trackingMode" IS NULL) OR
    (kind = 'GENERAL' AND "trackingMode" IN ('LOCATION', 'INDIVIDUAL')) OR
    (kind = 'HARDWARE' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'CARD' AND "trackingMode" = 'INDIVIDUAL') OR
    (kind = 'SOFTWARE_LICENSE' AND "trackingMode" = 'POOL')
  ) NOT VALID;

ALTER TABLE "employee_assets" DROP CONSTRAINT IF EXISTS "employee_assets_source_command_pair_check";
ALTER TABLE "employee_assets"
  ADD CONSTRAINT "employee_assets_source_command_pair_check"
  CHECK (
    ("sourceCommandKey" IS NULL AND "sourceCommandHash" IS NULL) OR
    ("sourceCommandKey" IS NOT NULL AND "sourceCommandHash" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "software_license_allocations" DROP CONSTRAINT IF EXISTS "software_license_allocations_source_command_pair_check";
ALTER TABLE "software_license_allocations"
  ADD CONSTRAINT "software_license_allocations_source_command_pair_check"
  CHECK (
    ("sourceCommandKey" IS NULL AND "sourceCommandHash" IS NULL) OR
    ("sourceCommandKey" IS NOT NULL AND "sourceCommandHash" IS NOT NULL)
  ) NOT VALID;
