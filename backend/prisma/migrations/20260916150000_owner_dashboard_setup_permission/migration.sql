INSERT INTO "permissions" (
  "id",
  "code",
  "name",
  "description",
  "isTenantAssignable",
  "createdAt",
  "updatedAt"
)
VALUES (
  md5('permission:dashboard.setup.read'),
  'dashboard.setup.read',
  'View workspace setup guide',
  'View organization workspace readiness and guided setup actions.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = EXCLUDED."isTenantAssignable",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || role."code" || ':dashboard.setup.read'),
  role."id",
  permission."id"
FROM "roles" role
CROSS JOIN "permissions" permission
WHERE role."code" IN ('ORGANIZATION_OWNER', 'COMPANY_ADMINISTRATOR')
  AND permission."code" = 'dashboard.setup.read'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
