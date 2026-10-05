-- HR Manager can publish onboarding templates (same as Owner / Company Admin).
-- Editing templates uses hr.onboarding.manage; Publish requires hr.onboarding.publish.

WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    ('HR_MANAGER', 'hr.onboarding.publish')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT md5('role-permission:' || m."roleCode" || ':' || m."permissionCode"), r."id", p."id"
FROM mappings m
JOIN "roles" r ON r."code" = m."roleCode"
JOIN "permissions" p ON p."code" = m."permissionCode"
ON CONFLICT DO NOTHING;
