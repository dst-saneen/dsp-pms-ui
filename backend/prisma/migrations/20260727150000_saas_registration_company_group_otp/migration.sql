-- SaaS Company Group tenancy, pending registration, and OTP verification.
-- This migration is additive and preserves all existing assignments and sessions.

-- Recreate RoleScope transactionally so the new value can be used by the
-- replacement check constraint in this same migration.
ALTER TABLE "user_role_assignments"
    DROP CONSTRAINT "user_role_assignments_scope_check";

ALTER TYPE "RoleScope" RENAME TO "RoleScope_old";
CREATE TYPE "RoleScope" AS ENUM (
    'GLOBAL',
    'COMPANY_GROUP',
    'COMPANY',
    'BRANCH'
);
ALTER TABLE "user_role_assignments"
    ALTER COLUMN "scope" TYPE "RoleScope"
    USING ("scope"::text::"RoleScope");
DROP TYPE "RoleScope_old";

ALTER TYPE "SecurityEventType" ADD VALUE 'REGISTRATION_STARTED';
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_VERIFICATION_SENT';
ALTER TYPE "SecurityEventType" ADD VALUE 'EMAIL_VERIFICATION_SUCCEEDED';

CREATE TYPE "RegistrationType" AS ENUM (
    'PLATFORM_OWNER',
    'ORGANIZATION_OWNER'
);

ALTER TABLE "users"
    ADD COLUMN "displayName" TEXT,
    ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "defaultCompanyGroupId" TEXT;

ALTER TABLE "user_role_assignments"
    ADD COLUMN "companyGroupId" TEXT;

ALTER TABLE "auth_sessions"
    ADD COLUMN "activeCompanyGroupId" TEXT;

CREATE TABLE "pending_registrations" (
    "id" TEXT NOT NULL,
    "type" "RegistrationType" NOT NULL,
    "organizationName" TEXT,
    "displayName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "otpExpiresAt" TIMESTAMP(3) NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_defaultCompanyGroupId_idx"
    ON "users"("defaultCompanyGroupId");
CREATE INDEX "user_role_assignments_companyGroupId_idx"
    ON "user_role_assignments"("companyGroupId");
CREATE UNIQUE INDEX "pending_registrations_type_normalizedEmail_key"
    ON "pending_registrations"("type", "normalizedEmail");
CREATE INDEX "pending_registrations_type_consumedAt_idx"
    ON "pending_registrations"("type", "consumedAt");
CREATE INDEX "pending_registrations_otpExpiresAt_idx"
    ON "pending_registrations"("otpExpiresAt");

ALTER TABLE "users"
    ADD CONSTRAINT "users_defaultCompanyGroupId_fkey"
    FOREIGN KEY ("defaultCompanyGroupId") REFERENCES "company_groups"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_companyGroupId_fkey"
    FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_sessions"
    ADD CONSTRAINT "auth_sessions_activeCompanyGroupId_fkey"
    FOREIGN KEY ("activeCompanyGroupId") REFERENCES "company_groups"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "user_role_assignments"
    ADD CONSTRAINT "user_role_assignments_scope_check" CHECK (
        ("scope" = 'GLOBAL'
            AND "companyGroupId" IS NULL
            AND "companyId" IS NULL
            AND "branchId" IS NULL
            AND "scopeKey" = 'GLOBAL')
        OR ("scope" = 'COMPANY_GROUP'
            AND "companyGroupId" IS NOT NULL
            AND "companyId" IS NULL
            AND "branchId" IS NULL
            AND "scopeKey" = 'COMPANY_GROUP:' || "companyGroupId")
        OR ("scope" = 'COMPANY'
            AND "companyGroupId" IS NULL
            AND "companyId" IS NOT NULL
            AND "branchId" IS NULL
            AND "scopeKey" = 'COMPANY:' || "companyId")
        OR ("scope" = 'BRANCH'
            AND "companyGroupId" IS NULL
            AND "companyId" IS NOT NULL
            AND "branchId" IS NOT NULL
            AND "scopeKey" = 'BRANCH:' || "branchId")
    );

INSERT INTO "roles" (
    "id",
    "code",
    "name",
    "description",
    "isSystem",
    "isActive",
    "updatedAt"
)
VALUES (
    '00000000-0000-4000-8000-000000000007',
    'ORGANIZATION_OWNER',
    'Organization Owner',
    'Administration across all companies and branches in one Company Group.',
    true,
    true,
    CURRENT_TIMESTAMP
);

WITH owner_permissions("permissionCode") AS (
    VALUES
      ('dashboard.read'),
      ('security.users.read'),
      ('security.users.manage'),
      ('security.roles.read'),
      ('security.roles.manage'),
      ('organization.company-groups.read'),
      ('organization.company-groups.manage'),
      ('organization.companies.read'),
      ('organization.companies.manage'),
      ('organization.branches.read'),
      ('organization.branches.manage'),
      ('organization.structure.read'),
      ('organization.structure.manage'),
      ('hr.employees.read'),
      ('hr.employees.manage'),
      ('assets.assets.read'),
      ('assets.assets.manage')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
    md5('role-permission:ORGANIZATION_OWNER:' || p."code"),
    '00000000-0000-4000-8000-000000000007',
    p."id"
FROM owner_permissions mapping
JOIN "permissions" p ON p."code" = mapping."permissionCode";
