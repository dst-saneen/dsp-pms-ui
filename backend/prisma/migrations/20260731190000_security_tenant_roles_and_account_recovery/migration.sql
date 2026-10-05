-- Developer 1 security completion: tenant roles, invitation and password recovery.
-- Review and merge this draft with other in-flight migrations before deployment.

ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INVITED' BEFORE 'ACTIVE';

ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'USER_INVITED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'INVITATION_ACCEPTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'INVITATION_RESENT';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_RESET_COMPLETED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'ROLE_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'USER_STATUS_CHANGED';

ALTER TABLE "users"
    ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "roles"
    ADD COLUMN "companyGroupId" TEXT,
    ADD COLUMN "normalizedName" TEXT;

ALTER TABLE "permissions"
    ADD COLUMN "isTenantAssignable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "audit_logs"
    ADD COLUMN "requestId" TEXT,
    ADD COLUMN "companyGroupId" TEXT,
    ADD COLUMN "companyId" TEXT,
    ADD COLUMN "branchId" TEXT;

CREATE TABLE "user_invitations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyGroupId" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resendAvailableAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "password_reset_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "password_reset_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_companyGroupId_normalizedName_key"
    ON "roles"("companyGroupId", "normalizedName");
CREATE INDEX "roles_companyGroupId_isActive_idx"
    ON "roles"("companyGroupId", "isActive");

ALTER TABLE "users"
    ADD CONSTRAINT "users_status_password_check"
    CHECK (
      ("status" = 'INVITED' AND "passwordHash" IS NULL)
      OR ("status" <> 'INVITED' AND "passwordHash" IS NOT NULL)
    );

ALTER TABLE "roles"
    ADD CONSTRAINT "roles_ownership_check"
    CHECK (
      ("isSystem" = true AND "companyGroupId" IS NULL AND "normalizedName" IS NULL)
      OR ("isSystem" = false AND "companyGroupId" IS NOT NULL AND "normalizedName" IS NOT NULL)
    );

CREATE INDEX "audit_logs_requestId_idx" ON "audit_logs"("requestId");
CREATE INDEX "audit_logs_companyGroupId_createdAt_idx"
    ON "audit_logs"("companyGroupId", "createdAt");
CREATE INDEX "audit_logs_companyId_createdAt_idx"
    ON "audit_logs"("companyId", "createdAt");
CREATE INDEX "audit_logs_branchId_createdAt_idx"
    ON "audit_logs"("branchId", "createdAt");

CREATE UNIQUE INDEX "user_invitations_tokenHash_key"
    ON "user_invitations"("tokenHash");
CREATE INDEX "user_invitations_userId_consumedAt_revokedAt_idx"
    ON "user_invitations"("userId", "consumedAt", "revokedAt");
CREATE INDEX "user_invitations_companyGroupId_createdAt_idx"
    ON "user_invitations"("companyGroupId", "createdAt");
CREATE INDEX "user_invitations_normalizedEmail_idx"
    ON "user_invitations"("normalizedEmail");
CREATE INDEX "user_invitations_expiresAt_idx"
    ON "user_invitations"("expiresAt");
CREATE UNIQUE INDEX "user_invitations_one_current_per_user_key"
    ON "user_invitations"("userId")
    WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;

CREATE UNIQUE INDEX "password_reset_challenges_tokenHash_key"
    ON "password_reset_challenges"("tokenHash");
CREATE INDEX "password_reset_challenges_userId_consumedAt_revokedAt_idx"
    ON "password_reset_challenges"("userId", "consumedAt", "revokedAt");
CREATE INDEX "password_reset_challenges_expiresAt_idx"
    ON "password_reset_challenges"("expiresAt");
CREATE UNIQUE INDEX "password_reset_challenges_one_current_per_user_key"
    ON "password_reset_challenges"("userId")
    WHERE "consumedAt" IS NULL AND "revokedAt" IS NULL;

ALTER TABLE "roles"
    ADD CONSTRAINT "roles_companyGroupId_fkey"
    FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_invitations"
    ADD CONSTRAINT "user_invitations_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "user_invitations_companyGroupId_fkey"
    FOREIGN KEY ("companyGroupId") REFERENCES "company_groups"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "user_invitations_invitedByUserId_fkey"
    FOREIGN KEY ("invitedByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "password_reset_challenges"
    ADD CONSTRAINT "password_reset_challenges_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Only security and organization-foundation permissions are tenant assignable
-- until Developer 2 and Developer 3 domain acceptance is complete.
UPDATE "permissions"
SET "isTenantAssignable" = true
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
    'organization.structure.manage'
);

UPDATE "permissions"
SET
    "name" = CASE
      WHEN "code" = 'hr.leave.read' THEN 'View leave'
      WHEN "code" = 'hr.leave.manage' THEN 'Manage leave'
      ELSE "name"
    END,
    "description" = CASE
      WHEN "code" = 'hr.leave.read' THEN 'View leave policies, balances and requests within an authorized organization scope.'
      WHEN "code" = 'hr.leave.manage' THEN 'Manage leave policies, balances and requests within an authorized organization scope.'
      ELSE "description"
    END
WHERE "code" IN ('hr.leave.read', 'hr.leave.manage');

INSERT INTO "permissions"
    ("id", "code", "name", "description", "isTenantAssignable", "updatedAt")
VALUES
    (md5('permission:hr.attendance.read'), 'hr.attendance.read', 'View attendance', 'View attendance within an authorized organization scope.', false, CURRENT_TIMESTAMP),
    (md5('permission:hr.attendance.manage'), 'hr.attendance.manage', 'Manage attendance', 'Manage attendance within an authorized organization scope.', false, CURRENT_TIMESTAMP),
    (md5('permission:hr.self.read'), 'hr.self.read', 'View own HR profile', 'View the signed-in employee''s own HR information.', false, CURRENT_TIMESTAMP),
    (md5('permission:hr.self.manage'), 'hr.self.manage', 'Manage own HR requests', 'Submit and manage the signed-in employee''s own HR requests.', false, CURRENT_TIMESTAMP),
    (md5('permission:assets.assignments.read'), 'assets.assignments.read', 'View asset assignments', 'View asset custody and assignment records.', false, CURRENT_TIMESTAMP),
    (md5('permission:assets.assignments.manage'), 'assets.assignments.manage', 'Manage asset assignments', 'Assign, return and transfer assets within an authorized organization scope.', false, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "isTenantAssignable" = EXCLUDED."isTenantAssignable",
    "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
    VALUES
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
JOIN "roles" role ON role."code" = mapping."roleCode"
JOIN "permissions" permission ON permission."code" = mapping."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
