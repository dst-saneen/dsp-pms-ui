-- EMPLOYEE must only work tasks + submit own timesheets (not approve / manage projects).
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."code" = 'EMPLOYEE'
  AND p."code" IN (
    'projects.projects.read',
    'projects.projects.manage',
    'projects.timesheets.approve'
  );
