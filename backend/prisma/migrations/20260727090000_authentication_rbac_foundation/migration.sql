-- Authentication, durable sessions, scoped RBAC, and security events.
-- This migration is intentionally data-preserving and does not create users.

CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'DISABLED');
CREATE TYPE "RoleScope" AS ENUM ('GLOBAL', 'COMPANY', 'BRANCH');
CREATE TYPE "SecurityEventType" AS ENUM (
    'LOGIN_SUCCEEDED',
    'LOGIN_FAILED',
    'ACCOUNT_LOCKED',
    'PASSWORD_CHANGED',
    'SESSION_REFRESHED',
    'SESSION_REVOKED',
    'CONTEXT_CHANGED'
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "normalizedUsername" TEXT NOT NULL,
    "email" TEXT,
    "normalizedEmail" TEXT,
    "passwordHash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "securityVersion" INTEGER NOT NULL DEFAULT 1,
    "employeeId" TEXT,
    "defaultCompanyId" TEXT,
    "defaultBranchId" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "companyId" TEXT,
    "branchId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_role_assignments_scope_check" CHECK (
        ("scope" = 'GLOBAL' AND "companyId" IS NULL AND "branchId" IS NULL AND "scopeKey" = 'GLOBAL')
        OR ("scope" = 'COMPANY' AND "companyId" IS NOT NULL AND "branchId" IS NULL AND "scopeKey" = 'COMPANY:' || "companyId")
        OR ("scope" = 'BRANCH' AND "companyId" IS NOT NULL AND "branchId" IS NOT NULL AND "scopeKey" = 'BRANCH:' || "branchId")
    )
);

CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "securityVersion" INTEGER NOT NULL,
    "activeCompanyId" TEXT,
    "activeBranchId" TEXT,
    "authorizationSnapshot" JSONB NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idleExpiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "SecurityEventType" NOT NULL,
    "requestId" TEXT,
    "sessionId" TEXT,
    "ipHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_normalizedUsername_key" ON "users"("normalizedUsername");
CREATE UNIQUE INDEX "users_normalizedEmail_key" ON "users"("normalizedEmail");
CREATE UNIQUE INDEX "users_employeeId_key" ON "users"("employeeId");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE INDEX "users_employeeId_idx" ON "users"("employeeId");

CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

CREATE UNIQUE INDEX "user_role_assignments_userId_roleId_scopeKey_key"
    ON "user_role_assignments"("userId", "roleId", "scopeKey");
CREATE INDEX "user_role_assignments_userId_isActive_idx"
    ON "user_role_assignments"("userId", "isActive");
CREATE INDEX "user_role_assignments_companyId_idx" ON "user_role_assignments"("companyId");
CREATE INDEX "user_role_assignments_branchId_idx" ON "user_role_assignments"("branchId");

CREATE UNIQUE INDEX "auth_sessions_refreshTokenHash_key" ON "auth_sessions"("refreshTokenHash");
CREATE INDEX "auth_sessions_userId_revokedAt_idx" ON "auth_sessions"("userId", "revokedAt");
CREATE INDEX "auth_sessions_idleExpiresAt_idx" ON "auth_sessions"("idleExpiresAt");
CREATE INDEX "auth_sessions_absoluteExpiresAt_idx" ON "auth_sessions"("absoluteExpiresAt");

CREATE INDEX "security_events_userId_createdAt_idx" ON "security_events"("userId", "createdAt");
CREATE INDEX "security_events_type_createdAt_idx" ON "security_events"("type", "createdAt");
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_entityName_entityId_createdAt_idx"
    ON "audit_logs"("entityName", "entityId", "createdAt");

ALTER TABLE "users"
    ADD CONSTRAINT "users_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "users_defaultCompanyId_fkey"
    FOREIGN KEY ("defaultCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "users_defaultBranchId_fkey"
    FOREIGN KEY ("defaultBranchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "role_permissions"
    ADD CONSTRAINT "role_permissions_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "role_permissions_permissionId_fkey"
    FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "user_role_assignments_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "user_role_assignments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "user_role_assignments_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "auth_sessions_activeCompanyId_fkey"
    FOREIGN KEY ("activeCompanyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "auth_sessions_activeBranchId_fkey"
    FOREIGN KEY ("activeBranchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "security_events"
    ADD CONSTRAINT "security_events_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Starter role catalog uses Project Manager for project-delivery access.
INSERT INTO "roles" ("id", "code", "name", "description", "isSystem", "isActive", "updatedAt")
VALUES
    ('00000000-0000-4000-8000-000000000001', 'SUPER_ADMINISTRATOR', 'Super Administrator', 'Global platform administration.', true, true, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000002', 'COMPANY_ADMINISTRATOR', 'Company Administrator', 'Administration within an assigned company or branch.', true, true, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000003', 'HR_MANAGER', 'HR Manager', 'Human resources management within an assigned company or branch.', true, true, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000004', 'PROJECT_MANAGER', 'Project Manager', 'Project and task management within an assigned company or branch.', true, true, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000005', 'ASSET_MANAGER', 'Asset Manager', 'Asset management within an assigned company or branch.', true, true, CURRENT_TIMESTAMP),
    ('00000000-0000-4000-8000-000000000006', 'EMPLOYEE', 'Employee', 'Self-service employee access.', true, true, CURRENT_TIMESTAMP);

INSERT INTO "permissions" ("id", "code", "name", "description", "updatedAt")
VALUES
    (md5('permission:platform.admin'), 'platform.admin', 'Platform administration', 'Access routes not yet assigned to a narrower permission.', CURRENT_TIMESTAMP),
    (md5('permission:dashboard.read'), 'dashboard.read', 'View dashboard', NULL, CURRENT_TIMESTAMP),
    (md5('permission:security.users.read'), 'security.users.read', 'View users', NULL, CURRENT_TIMESTAMP),
    (md5('permission:security.users.manage'), 'security.users.manage', 'Manage users', NULL, CURRENT_TIMESTAMP),
    (md5('permission:security.roles.read'), 'security.roles.read', 'View roles and permissions', NULL, CURRENT_TIMESTAMP),
    (md5('permission:security.roles.manage'), 'security.roles.manage', 'Manage role assignments', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.company-groups.read'), 'organization.company-groups.read', 'View company groups', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.company-groups.manage'), 'organization.company-groups.manage', 'Manage company groups', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.companies.read'), 'organization.companies.read', 'View companies', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.companies.manage'), 'organization.companies.manage', 'Manage companies', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.branches.read'), 'organization.branches.read', 'View branches', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.branches.manage'), 'organization.branches.manage', 'Manage branches', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.structure.read'), 'organization.structure.read', 'View departments, designations, and shifts', NULL, CURRENT_TIMESTAMP),
    (md5('permission:organization.structure.manage'), 'organization.structure.manage', 'Manage departments, designations, and shifts', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.employees.read'), 'hr.employees.read', 'View employees', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.employees.manage'), 'hr.employees.manage', 'Manage employees', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.onboarding.read'), 'hr.onboarding.read', 'View onboarding', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.onboarding.manage'), 'hr.onboarding.manage', 'Manage onboarding', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.documents.read'), 'hr.documents.read', 'View employee documents', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.documents.manage'), 'hr.documents.manage', 'Manage employee documents', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.leave.read'), 'hr.leave.read', 'View leave and attendance', NULL, CURRENT_TIMESTAMP),
    (md5('permission:hr.leave.manage'), 'hr.leave.manage', 'Manage leave and attendance', NULL, CURRENT_TIMESTAMP),
    (md5('permission:projects.projects.read'), 'projects.projects.read', 'View projects and tasks', NULL, CURRENT_TIMESTAMP),
    (md5('permission:projects.projects.manage'), 'projects.projects.manage', 'Manage projects and tasks', NULL, CURRENT_TIMESTAMP),
    (md5('permission:assets.assets.read'), 'assets.assets.read', 'View assets', NULL, CURRENT_TIMESTAMP),
    (md5('permission:assets.assets.manage'), 'assets.assets.manage', 'Manage assets', NULL, CURRENT_TIMESTAMP),
    (md5('permission:payroll.payroll.read'), 'payroll.payroll.read', 'View payroll', NULL, CURRENT_TIMESTAMP),
    (md5('permission:payroll.payroll.manage'), 'payroll.payroll.manage', 'Manage payroll', NULL, CURRENT_TIMESTAMP),
    (md5('permission:workflow.workflow.read'), 'workflow.workflow.read', 'View workflows and approvals', NULL, CURRENT_TIMESTAMP),
    (md5('permission:workflow.workflow.manage'), 'workflow.workflow.manage', 'Manage workflows and approvals', NULL, CURRENT_TIMESTAMP),
    (md5('permission:audit.read'), 'audit.read', 'View business audits', NULL, CURRENT_TIMESTAMP);

-- Permission mapping uses readable role codes and remains safely idempotent in review tooling.
WITH mappings("roleCode", "permissionCode") AS (
    VALUES
      ('SUPER_ADMINISTRATOR', 'platform.admin'),
      ('COMPANY_ADMINISTRATOR', 'dashboard.read'),
      ('COMPANY_ADMINISTRATOR', 'security.users.read'),
      ('COMPANY_ADMINISTRATOR', 'security.users.manage'),
      ('COMPANY_ADMINISTRATOR', 'security.roles.read'),
      ('COMPANY_ADMINISTRATOR', 'security.roles.manage'),
      ('COMPANY_ADMINISTRATOR', 'organization.companies.read'),
      ('COMPANY_ADMINISTRATOR', 'organization.companies.manage'),
      ('COMPANY_ADMINISTRATOR', 'organization.branches.read'),
      ('COMPANY_ADMINISTRATOR', 'organization.branches.manage'),
      ('COMPANY_ADMINISTRATOR', 'organization.structure.read'),
      ('COMPANY_ADMINISTRATOR', 'organization.structure.manage'),
      ('COMPANY_ADMINISTRATOR', 'hr.employees.read'),
      ('COMPANY_ADMINISTRATOR', 'hr.employees.manage'),
      ('COMPANY_ADMINISTRATOR', 'assets.assets.read'),
      ('COMPANY_ADMINISTRATOR', 'assets.assets.manage'),
      ('HR_MANAGER', 'dashboard.read'),
      ('HR_MANAGER', 'organization.companies.read'),
      ('HR_MANAGER', 'organization.branches.read'),
      ('HR_MANAGER', 'organization.structure.read'),
      ('HR_MANAGER', 'hr.employees.read'),
      ('HR_MANAGER', 'hr.employees.manage'),
      ('PROJECT_MANAGER', 'dashboard.read'),
      ('PROJECT_MANAGER', 'organization.companies.read'),
      ('PROJECT_MANAGER', 'organization.branches.read'),
      ('PROJECT_MANAGER', 'organization.structure.read'),
      ('PROJECT_MANAGER', 'hr.employees.read'),
      ('ASSET_MANAGER', 'dashboard.read'),
      ('ASSET_MANAGER', 'organization.companies.read'),
      ('ASSET_MANAGER', 'organization.branches.read'),
      ('ASSET_MANAGER', 'organization.structure.read'),
      ('ASSET_MANAGER', 'hr.employees.read'),
      ('ASSET_MANAGER', 'assets.assets.read'),
      ('ASSET_MANAGER', 'assets.assets.manage'),
      ('EMPLOYEE', 'dashboard.read')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
    md5('role-permission:' || r."code" || ':' || p."code"),
    r."id",
    p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode";
