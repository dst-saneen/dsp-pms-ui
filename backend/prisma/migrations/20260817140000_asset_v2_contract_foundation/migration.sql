-- Asset V2 contract foundation (Section 1): enums + permissions + custodian role.
-- Column/table usage is deferred to the expand migration (Section 2).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "roles"
    WHERE "id" = '00000000-0000-4000-8000-000000000008'
      AND "code" <> 'ASSET_DEPARTMENT_CUSTODIAN'
  ) THEN
    RAISE EXCEPTION 'Role id ...0008 is occupied by another code; reconcile before Asset V2 seed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "roles"
    WHERE "code" = 'ASSET_DEPARTMENT_CUSTODIAN'
      AND "id" <> '00000000-0000-4000-8000-000000000008'
  ) THEN
    RAISE EXCEPTION 'ASSET_DEPARTMENT_CUSTODIAN exists under another id; reconcile before Asset V2 seed';
  END IF;
END $$;

CREATE TYPE "AssetKind" AS ENUM ('GENERAL', 'HARDWARE', 'CARD', 'SOFTWARE_LICENSE');
CREATE TYPE "AssetTrackingMode" AS ENUM ('LOCATION', 'INDIVIDUAL', 'POOL');
CREATE TYPE "AssetLifecycleStatus" AS ENUM (
  'ACTIVE', 'IN_REPAIR', 'LOST', 'DISPOSED', 'SUSPENDED', 'RETIRED'
);
CREATE TYPE "AssetActionType" AS ENUM (
  'CATEGORY_ARCHIVED', 'CATEGORY_REACTIVATED', 'TYPE_ARCHIVED', 'TYPE_REACTIVATED',
  'ARCHIVED', 'REACTIVATED', 'SENT_TO_REPAIR', 'REPAIR_COMPLETED', 'MARKED_LOST',
  'DISPOSED', 'SUSPENDED', 'RESUMED', 'RETIRED', 'LICENSE_CAPACITY_RESIZED',
  'LICENSE_ALLOCATION_REVOKED', 'IDENTIFIER_CORRECTED', 'DEPARTMENT_GRANT_CREATED',
  'DEPARTMENT_GRANT_REVOKED', 'DEPARTMENT_GRANT_REACTIVATED'
);
CREATE TYPE "AssetActionEntityType" AS ENUM (
  'CATEGORY', 'TYPE', 'ASSET', 'LICENSE_ALLOCATION', 'DEPARTMENT_GRANT'
);
CREATE TYPE "EmployeeAssetStatus" AS ENUM (
  'ASSIGNED', 'RETURNED', 'DAMAGED', 'LOST', 'WAIVED'
);
CREATE TYPE "LicenseAllocationStatus" AS ENUM ('ACTIVE', 'REVOKED', 'WAIVED');
CREATE TYPE "AssetTransferStatus" AS ENUM (
  'PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'FORCED'
);
CREATE TYPE "AssetCustodyTargetType" AS ENUM ('EMPLOYEE_ASSET', 'LICENSE_ALLOCATION');
CREATE TYPE "AssetCustodyRequestType" AS ENUM (
  'RETURN', 'REPORT_DAMAGED', 'REPORT_LOST', 'REVOKE_LICENSE'
);
CREATE TYPE "AssetCustodyRequestStatus" AS ENUM (
  'SUBMITTED', 'IN_REVIEW', 'COMPLETED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE "AssetClearanceItemStatus" AS ENUM ('OPEN', 'RESOLVED', 'WAIVED');
CREATE TYPE "AssetClearanceResolutionType" AS ENUM (
  'RETURNED', 'DAMAGED', 'LOST', 'REVOKED', 'WAIVED'
);
CREATE TYPE "AssetClearanceWaiverStatus" AS ENUM (
  'REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED'
);
CREATE TYPE "AssetClearanceWaiverReasonCode" AS ENUM (
  'ASSET_NOT_RECOVERABLE', 'EMPLOYEE_UNAVAILABLE', 'COST_RECOVERY_APPROVED',
  'LEGAL_OR_SECURITY_HOLD', 'MANAGEMENT_EXCEPTION', 'OTHER'
);
CREATE TYPE "AssetSourceType" AS ENUM ('MANUAL', 'IMPORT', 'ONBOARDING_TASK');
CREATE TYPE "AssetReminderDispatchStatus" AS ENUM (
  'PENDING', 'ENQUEUED', 'SUPPRESSED', 'FAILED'
);

INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (
    md5('permission:assets.department.read'),
    'assets.department.read',
    'Read department-scoped assets',
    'Read assets in granted departments only',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.department.manage'),
    'assets.department.manage',
    'Manage department-scoped assets',
    'Manage assets in granted departments only',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.department.assignments.read'),
    'assets.department.assignments.read',
    'Read department-scoped custody',
    'Read custody and allocations for granted departments',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.department.assignments.manage'),
    'assets.department.assignments.manage',
    'Manage department-scoped custody',
    'Manage custody and allocations for granted departments',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.department-access.manage'),
    'assets.department-access.manage',
    'Manage department custodian grants',
    NULL,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.transfers.force'),
    'assets.transfers.force',
    'Force asset ownership transfers',
    NULL,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.clearance.waive'),
    'assets.clearance.waive',
    'Approve or reject asset clearance waivers',
    NULL,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.cards.sensitive.lookup'),
    'assets.cards.sensitive.lookup',
    'Protected card identifier lookup',
    'Exact card lookup; never returns plaintext',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.sensitive-metadata.read'),
    'assets.sensitive-metadata.read',
    'View licence vault reference',
    'Authorized detail only',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:assets.private-history.read'),
    'assets.private-history.read',
    'View private asset history notes',
    'Lifecycle reasons and request/transfer/waiver notes',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = EXCLUDED."isTenantAssignable",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "roles" ("id", "code", "name", "description", "isSystem", "isActive", "updatedAt")
VALUES (
  '00000000-0000-4000-8000-000000000008',
  'ASSET_DEPARTMENT_CUSTODIAN',
  'Asset Department Custodian',
  'Manage assets and custody within explicitly granted departments.',
  true,
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "code" = EXCLUDED."code",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isSystem" = EXCLUDED."isSystem",
  "isActive" = EXCLUDED."isActive",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    -- Organization Owner & Company Admin: all Asset V2 permissions
    ('ORGANIZATION_OWNER', 'assets.department.read'),
    ('ORGANIZATION_OWNER', 'assets.department.manage'),
    ('ORGANIZATION_OWNER', 'assets.department.assignments.read'),
    ('ORGANIZATION_OWNER', 'assets.department.assignments.manage'),
    ('ORGANIZATION_OWNER', 'assets.department-access.manage'),
    ('ORGANIZATION_OWNER', 'assets.transfers.force'),
    ('ORGANIZATION_OWNER', 'assets.clearance.waive'),
    ('ORGANIZATION_OWNER', 'assets.cards.sensitive.lookup'),
    ('ORGANIZATION_OWNER', 'assets.sensitive-metadata.read'),
    ('ORGANIZATION_OWNER', 'assets.private-history.read'),
    ('COMPANY_ADMINISTRATOR', 'assets.department.read'),
    ('COMPANY_ADMINISTRATOR', 'assets.department.manage'),
    ('COMPANY_ADMINISTRATOR', 'assets.department.assignments.read'),
    ('COMPANY_ADMINISTRATOR', 'assets.department.assignments.manage'),
    ('COMPANY_ADMINISTRATOR', 'assets.department-access.manage'),
    ('COMPANY_ADMINISTRATOR', 'assets.transfers.force'),
    ('COMPANY_ADMINISTRATOR', 'assets.clearance.waive'),
    ('COMPANY_ADMINISTRATOR', 'assets.cards.sensitive.lookup'),
    ('COMPANY_ADMINISTRATOR', 'assets.sensitive-metadata.read'),
    ('COMPANY_ADMINISTRATOR', 'assets.private-history.read'),
    -- Asset Manager: broad ops + force/sensitive/private (existing broad perms unchanged)
    ('ASSET_MANAGER', 'assets.department.read'),
    ('ASSET_MANAGER', 'assets.department.manage'),
    ('ASSET_MANAGER', 'assets.department.assignments.read'),
    ('ASSET_MANAGER', 'assets.department.assignments.manage'),
    ('ASSET_MANAGER', 'assets.transfers.force'),
    ('ASSET_MANAGER', 'assets.cards.sensitive.lookup'),
    ('ASSET_MANAGER', 'assets.sensitive-metadata.read'),
    ('ASSET_MANAGER', 'assets.private-history.read'),
    -- HR Manager: broad read + waiver approval
    ('HR_MANAGER', 'assets.department.read'),
    ('HR_MANAGER', 'assets.department.assignments.read'),
    ('HR_MANAGER', 'assets.clearance.waive'),
    -- Department custodian: department operational permissions + org structure read
    ('ASSET_DEPARTMENT_CUSTODIAN', 'dashboard.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'organization.companies.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'organization.branches.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'organization.structure.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'assets.department.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'assets.department.manage'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'assets.department.assignments.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'assets.department.assignments.manage'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'hr.self.read'),
    ('ASSET_DEPARTMENT_CUSTODIAN', 'hr.self.manage')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"),
  r."id",
  p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;
