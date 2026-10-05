-- W18: tenant owners/admins need company-scoped Delivery Operations access.
-- APIs already filter by active company; platform.delivery was previously
-- Super Admin only, which blocked ORGANIZATION_OWNER from Ops → Delivery Queue.

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('ORGANIZATION_OWNER', 'platform.delivery.read'),
    ('ORGANIZATION_OWNER', 'platform.delivery.retry'),
    ('COMPANY_ADMINISTRATOR', 'platform.delivery.read'),
    ('COMPANY_ADMINISTRATOR', 'platform.delivery.retry')
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
