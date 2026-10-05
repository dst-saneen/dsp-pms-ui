-- Give HR Manager Project Lite access for ops UAT (read + manage + self work).
-- Safe to re-run: ON CONFLICT DO NOTHING.

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('HR_MANAGER', 'projects.projects.read'),
    ('HR_MANAGER', 'projects.projects.manage'),
    ('HR_MANAGER', 'projects.tasks.work'),
    ('HR_MANAGER', 'projects.timesheets.submit'),
    ('HR_MANAGER', 'projects.timesheets.approve')
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
