-- Allow HR Manager to create customers/vendors (finance settings) for Client projects UAT.
WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('HR_MANAGER', 'finance.settings.manage')
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
