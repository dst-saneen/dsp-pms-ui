-- Project Lite Phase 0: expand permissions and map Project Manager / self-service roles.
-- Feature remains off (PROJECTS_LITE_ENABLED=false) until later phases pass gates.

INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (
    md5('permission:projects.projects.read'),
    'projects.projects.read',
    'View projects',
    'View projects, stages, team and tasks within assigned company or branch',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:projects.projects.manage'),
    'projects.projects.manage',
    'Manage projects',
    'Manage project lifecycle, stages, team and tasks within assigned company or branch',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:projects.tasks.work'),
    'projects.tasks.work',
    'Work on project tasks',
    'Start, submit and update work on tasks assigned to the authenticated employee',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:projects.timesheets.submit'),
    'projects.timesheets.submit',
    'Submit project timesheets',
    'Maintain and submit own weekly project timesheets',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    md5('permission:projects.timesheets.approve'),
    'projects.timesheets.approve',
    'Approve project timesheets',
    'View and decide timesheets assigned to the authenticated reporting manager',
    true,
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
    ('ORGANIZATION_OWNER', 'projects.projects.read'),
    ('ORGANIZATION_OWNER', 'projects.projects.manage'),
    ('ORGANIZATION_OWNER', 'projects.tasks.work'),
    ('ORGANIZATION_OWNER', 'projects.timesheets.submit'),
    ('ORGANIZATION_OWNER', 'projects.timesheets.approve'),
    ('COMPANY_ADMINISTRATOR', 'projects.projects.read'),
    ('COMPANY_ADMINISTRATOR', 'projects.projects.manage'),
    ('COMPANY_ADMINISTRATOR', 'projects.tasks.work'),
    ('COMPANY_ADMINISTRATOR', 'projects.timesheets.submit'),
    ('COMPANY_ADMINISTRATOR', 'projects.timesheets.approve'),
    ('PROJECT_MANAGER', 'projects.projects.read'),
    ('PROJECT_MANAGER', 'projects.projects.manage'),
    ('PROJECT_MANAGER', 'projects.tasks.work'),
    ('PROJECT_MANAGER', 'projects.timesheets.submit'),
    ('PROJECT_MANAGER', 'projects.timesheets.approve'),
    ('EMPLOYEE', 'projects.tasks.work'),
    ('EMPLOYEE', 'projects.timesheets.submit')
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
