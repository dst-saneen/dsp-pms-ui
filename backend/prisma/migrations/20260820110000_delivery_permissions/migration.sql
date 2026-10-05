-- Phase H: seed delivery monitoring permissions.
-- HR roles get branch-scoped read/retry. Super-admin gets global ops.

INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (
    md5('permission:hr.recruitment.delivery.read'),
    'hr.recruitment.delivery.read',
    'View recruitment delivery',
    'View delivery messages for the assigned company and branch',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:hr.recruitment.delivery.retry'),
    'hr.recruitment.delivery.retry',
    'Retry recruitment delivery',
    'Retry failed or dead-lettered deliveries in the assigned company and branch',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:platform.delivery.read'),
    'platform.delivery.read',
    'View global delivery operations',
    'View all delivery messages, dead letters, suppressions, and health',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:platform.delivery.retry'),
    'platform.delivery.retry',
    'Operate global delivery',
    'Retry, cancel, and release suppressions across tenants',
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = EXCLUDED."isTenantAssignable",
  "updatedAt" = CURRENT_TIMESTAMP;

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'hr.recruitment.delivery.read'),
    ('ORGANIZATION_OWNER', 'hr.recruitment.delivery.retry'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.delivery.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.recruitment.delivery.retry'),
    ('HR_MANAGER', 'hr.recruitment.delivery.read'),
    ('HR_MANAGER', 'hr.recruitment.delivery.retry'),
    ('SUPER_ADMINISTRATOR', 'platform.delivery.read'),
    ('SUPER_ADMINISTRATOR', 'platform.delivery.retry')
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
