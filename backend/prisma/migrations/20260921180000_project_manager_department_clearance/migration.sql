-- Allow Project Managers to clear checklist items for their own department
-- (Engineering manager Meera path after separation approval).

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('PROJECT_MANAGER', 'hr.clearance.department.read'),
    ('PROJECT_MANAGER', 'hr.clearance.department.manage')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"),
  r.id,
  p.id
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode" AND r."isSystem" = true
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
