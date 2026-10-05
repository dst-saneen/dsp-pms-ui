-- Phase 4 / Work Package E:
-- Activate tenant-assignable workforce permissions, insert missing system-role
-- mappings (B3 matrix), and add core foreign-key indexes.
-- Safe to re-run mappings via ON CONFLICT DO NOTHING.
-- Does NOT grant platform.admin to any tenant role.

-- E1. Mark accepted tenant domains as assignable.
UPDATE "permissions"
SET
    "isTenantAssignable" = true,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" IN (
    'dashboard.read',
    'security.users.read',
    'security.users.manage',
    'security.roles.read',
    'security.roles.manage',
    'organization.company-groups.read',
    'organization.company-groups.manage',
    'organization.companies.read',
    'organization.companies.manage',
    'organization.branches.read',
    'organization.branches.manage',
    'organization.structure.read',
    'organization.structure.manage',
    'hr.employees.read',
    'hr.employees.manage',
    'hr.onboarding.read',
    'hr.onboarding.manage',
    'hr.documents.read',
    'hr.documents.manage',
    'hr.leave.read',
    'hr.leave.manage',
    'hr.attendance.read',
    'hr.attendance.manage',
    'hr.self.read',
    'hr.self.manage',
    'assets.assets.read',
    'assets.assets.manage',
    'assets.assignments.read',
    'assets.assignments.manage'
);

-- E1. Missing system-role permission mappings from B3 matrix.
-- Prior migrations already grant many of these; ON CONFLICT skips duplicates.
WITH mappings("roleCode", "permissionCode") AS (
    VALUES
      -- Organization Owner: full workforce + self
      ('ORGANIZATION_OWNER', 'hr.onboarding.read'),
      ('ORGANIZATION_OWNER', 'hr.onboarding.manage'),
      ('ORGANIZATION_OWNER', 'hr.documents.read'),
      ('ORGANIZATION_OWNER', 'hr.documents.manage'),
      ('ORGANIZATION_OWNER', 'hr.leave.read'),
      ('ORGANIZATION_OWNER', 'hr.leave.manage'),
      ('ORGANIZATION_OWNER', 'hr.attendance.read'),
      ('ORGANIZATION_OWNER', 'hr.attendance.manage'),
      ('ORGANIZATION_OWNER', 'assets.assignments.read'),
      ('ORGANIZATION_OWNER', 'assets.assignments.manage'),
      ('ORGANIZATION_OWNER', 'hr.self.read'),
      ('ORGANIZATION_OWNER', 'hr.self.manage'),

      -- Company Administrator: onboarding, documents, leave, self
      -- (attendance + assignments come from 20260731190000)
      ('COMPANY_ADMINISTRATOR', 'hr.onboarding.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.onboarding.manage'),
      ('COMPANY_ADMINISTRATOR', 'hr.documents.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.documents.manage'),
      ('COMPANY_ADMINISTRATOR', 'hr.leave.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.leave.manage'),
      ('COMPANY_ADMINISTRATOR', 'hr.self.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.self.manage'),

      -- HR Manager: onboarding, documents, leave, asset read
      -- (attendance + self come from 20260731190000)
      ('HR_MANAGER', 'hr.onboarding.read'),
      ('HR_MANAGER', 'hr.onboarding.manage'),
      ('HR_MANAGER', 'hr.documents.read'),
      ('HR_MANAGER', 'hr.documents.manage'),
      ('HR_MANAGER', 'hr.leave.read'),
      ('HR_MANAGER', 'hr.leave.manage'),
      ('HR_MANAGER', 'assets.assets.read'),
      ('HR_MANAGER', 'assets.assignments.read'),

      -- Project Manager already has org/employees/dashboard/self from earlier migrations.

      -- Asset Manager self + assignments already from 20260731190000.

      -- Ensure Company Admin / Org Owner leave+attendance if pending migration
      -- was applied without those grants (idempotent).
      ('COMPANY_ADMINISTRATOR', 'hr.attendance.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.attendance.manage'),
      ('COMPANY_ADMINISTRATOR', 'assets.assignments.read'),
      ('COMPANY_ADMINISTRATOR', 'assets.assignments.manage'),
      ('HR_MANAGER', 'hr.attendance.read'),
      ('HR_MANAGER', 'hr.attendance.manage'),
      ('HR_MANAGER', 'hr.self.read'),
      ('HR_MANAGER', 'hr.self.manage'),
      ('PROJECT_MANAGER', 'hr.self.read'),
      ('PROJECT_MANAGER', 'hr.self.manage'),
      ('ASSET_MANAGER', 'assets.assignments.read'),
      ('ASSET_MANAGER', 'assets.assignments.manage'),
      ('ASSET_MANAGER', 'hr.self.read'),
      ('ASSET_MANAGER', 'hr.self.manage'),
      ('EMPLOYEE', 'hr.self.read'),
      ('EMPLOYEE', 'hr.self.manage')
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

-- E2. Core foreign-key indexes (skip if an equivalent leading index already exists).
CREATE INDEX IF NOT EXISTS "companies_companyGroupId_idx"
    ON "companies"("companyGroupId");

CREATE INDEX IF NOT EXISTS "departments_companyId_idx"
    ON "departments"("companyId");

CREATE INDEX IF NOT EXISTS "employees_companyId_idx"
    ON "employees"("companyId");

CREATE INDEX IF NOT EXISTS "employees_branchId_idx"
    ON "employees"("branchId");

CREATE INDEX IF NOT EXISTS "employees_departmentId_idx"
    ON "employees"("departmentId");

CREATE INDEX IF NOT EXISTS "employees_designationId_idx"
    ON "employees"("designationId");

CREATE INDEX IF NOT EXISTS "employees_managerId_idx"
    ON "employees"("managerId");

CREATE INDEX IF NOT EXISTS "auth_sessions_activeCompanyGroupId_idx"
    ON "auth_sessions"("activeCompanyGroupId");

CREATE INDEX IF NOT EXISTS "auth_sessions_activeCompanyId_idx"
    ON "auth_sessions"("activeCompanyId");

CREATE INDEX IF NOT EXISTS "auth_sessions_activeBranchId_idx"
    ON "auth_sessions"("activeBranchId");

CREATE INDEX IF NOT EXISTS "user_role_assignments_roleId_idx"
    ON "user_role_assignments"("roleId");

CREATE INDEX IF NOT EXISTS "users_defaultCompanyId_idx"
    ON "users"("defaultCompanyId");

CREATE INDEX IF NOT EXISTS "users_defaultBranchId_idx"
    ON "users"("defaultBranchId");

CREATE INDEX IF NOT EXISTS "leave_requests_leaveBalanceId_idx"
    ON "leave_requests"("leaveBalanceId");

CREATE INDEX IF NOT EXISTS "attendances_shiftId_idx"
    ON "attendances"("shiftId");
