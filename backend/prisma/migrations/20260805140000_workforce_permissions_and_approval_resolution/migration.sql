-- WP-02: Workforce permission catalog, tenant-role mappings, and default
-- approval workflow steps for global workforce workflows.
-- Idempotent: safe to re-run via ON CONFLICT / NOT EXISTS guards.

-- P1. Insert permission catalog entries
INSERT INTO "permissions" ("id", "code", "name", "description", "isTenantAssignable", "createdAt", "updatedAt")
VALUES
  (md5('permission:hr.schedule.read'), 'hr.schedule.read', 'Read work schedules', 'View shift rosters and work schedules', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.schedule.manage'), 'hr.schedule.manage', 'Manage work schedules', 'Create and edit draft shift rosters', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.schedule.publish'), 'hr.schedule.publish', 'Publish work schedules', 'Publish, lock, and archive shift rosters', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.holidays.read'), 'hr.holidays.read', 'Read holidays', 'View company and branch holidays', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.holidays.manage'), 'hr.holidays.manage', 'Manage holidays', 'Create and update holidays', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.attendance.regularize'), 'hr.attendance.regularize', 'Regularize attendance', 'Submit and decide attendance regularizations', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.attendance.lock'), 'hr.attendance.lock', 'Lock attendance periods', 'Review and lock monthly attendance periods', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.overtime.read'), 'hr.overtime.read', 'Read overtime', 'View overtime policies and requests', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.overtime.manage'), 'hr.overtime.manage', 'Manage overtime', 'Configure overtime policies and calculate requests', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.overtime.approve'), 'hr.overtime.approve', 'Approve overtime', 'Approve or reject overtime requests', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.comp-off.read'), 'hr.comp-off.read', 'Read comp-off', 'View compensatory-off credits', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.comp-off.manage'), 'hr.comp-off.manage', 'Manage comp-off', 'Revoke or administer compensatory-off credits', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.calendar.read'), 'hr.calendar.read', 'Read workforce calendar', 'View privacy-filtered workforce calendars', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.team.read'), 'hr.team.read', 'Read team workforce', 'View team schedules, attendance, and calendars', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5('permission:hr.team.approve'), 'hr.team.approve', 'Approve team requests', 'Approve team leave, regularization, and overtime', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "isTenantAssignable" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- P2. Default role mappings (custom roles get no automatic grant)
WITH mappings("roleCode", "permissionCode") AS (
  VALUES
    -- Organization Owner: all workforce permissions
    ('ORGANIZATION_OWNER', 'hr.schedule.read'),
    ('ORGANIZATION_OWNER', 'hr.schedule.manage'),
    ('ORGANIZATION_OWNER', 'hr.schedule.publish'),
    ('ORGANIZATION_OWNER', 'hr.holidays.read'),
    ('ORGANIZATION_OWNER', 'hr.holidays.manage'),
    ('ORGANIZATION_OWNER', 'hr.attendance.regularize'),
    ('ORGANIZATION_OWNER', 'hr.attendance.lock'),
    ('ORGANIZATION_OWNER', 'hr.overtime.read'),
    ('ORGANIZATION_OWNER', 'hr.overtime.manage'),
    ('ORGANIZATION_OWNER', 'hr.overtime.approve'),
    ('ORGANIZATION_OWNER', 'hr.comp-off.read'),
    ('ORGANIZATION_OWNER', 'hr.comp-off.manage'),
    ('ORGANIZATION_OWNER', 'hr.calendar.read'),
    ('ORGANIZATION_OWNER', 'hr.team.read'),
    ('ORGANIZATION_OWNER', 'hr.team.approve'),

    -- Company Administrator: all workforce permissions
    ('COMPANY_ADMINISTRATOR', 'hr.schedule.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.schedule.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.schedule.publish'),
    ('COMPANY_ADMINISTRATOR', 'hr.holidays.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.holidays.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.attendance.regularize'),
    ('COMPANY_ADMINISTRATOR', 'hr.attendance.lock'),
    ('COMPANY_ADMINISTRATOR', 'hr.overtime.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.overtime.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.overtime.approve'),
    ('COMPANY_ADMINISTRATOR', 'hr.comp-off.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.comp-off.manage'),
    ('COMPANY_ADMINISTRATOR', 'hr.calendar.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.team.read'),
    ('COMPANY_ADMINISTRATOR', 'hr.team.approve'),

    -- HR Manager: all workforce permissions
    ('HR_MANAGER', 'hr.schedule.read'),
    ('HR_MANAGER', 'hr.schedule.manage'),
    ('HR_MANAGER', 'hr.schedule.publish'),
    ('HR_MANAGER', 'hr.holidays.read'),
    ('HR_MANAGER', 'hr.holidays.manage'),
    ('HR_MANAGER', 'hr.attendance.regularize'),
    ('HR_MANAGER', 'hr.attendance.lock'),
    ('HR_MANAGER', 'hr.overtime.read'),
    ('HR_MANAGER', 'hr.overtime.manage'),
    ('HR_MANAGER', 'hr.overtime.approve'),
    ('HR_MANAGER', 'hr.comp-off.read'),
    ('HR_MANAGER', 'hr.comp-off.manage'),
    ('HR_MANAGER', 'hr.calendar.read'),
    ('HR_MANAGER', 'hr.team.read'),
    ('HR_MANAGER', 'hr.team.approve'),

    -- Project Manager: team + calendar only
    ('PROJECT_MANAGER', 'hr.team.read'),
    ('PROJECT_MANAGER', 'hr.team.approve'),
    ('PROJECT_MANAGER', 'hr.calendar.read')
)
INSERT INTO "role_permissions" ("id", "roleId", "permissionId")
SELECT
  md5('role-permission:' || mapping."roleCode" || ':' || mapping."permissionCode"),
  role."id",
  permission."id"
FROM mappings mapping
JOIN "roles" role ON role."code" = mapping."roleCode" AND role."isSystem" = true
JOIN "permissions" permission ON permission."code" = mapping."permissionCode"
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- P3. Ensure global workforce workflows have a default REPORTING_MANAGER first step
-- (resolver applies HR / administrator fallback when the manager is missing).
INSERT INTO "approval_workflow_steps" (
  "id", "workflowId", "stepNo", "approverType", "approverRole", "createdAt"
)
SELECT
  gen_random_uuid()::text,
  aw."id",
  1,
  'REPORTING_MANAGER',
  NULL,
  CURRENT_TIMESTAMP
FROM "approval_workflows" aw
WHERE aw."scopeKey" IN (
  'GLOBAL:LEAVE_APPROVAL',
  'GLOBAL:ATTENDANCE_REGULARIZATION',
  'GLOBAL:OVERTIME_APPROVAL'
)
AND NOT EXISTS (
  SELECT 1 FROM "approval_workflow_steps" s
  WHERE s."workflowId" = aw."id" AND s."stepNo" = 1
);
