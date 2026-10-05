-- Read-only preflight for 20260901100000_hr_operations_hardening.
-- Run every query and reconcile non-zero rows before applying the migration.

SELECT 'hr_request_missing_or_cross_tenant' AS finding, COUNT(*) AS rows
FROM "hr_requests" request
LEFT JOIN "employees" employee ON employee.id = request."employeeId"
LEFT JOIN "hr_request_types" type ON type.id = request."requestTypeId"
WHERE employee.id IS NULL
   OR type.id IS NULL
   OR employee."companyId" IS DISTINCT FROM type."companyId"
UNION ALL
SELECT 'separation_missing_employee_or_scope', COUNT(*)
FROM "employee_separations" separation
LEFT JOIN "employees" employee ON employee.id = separation."employeeId"
WHERE employee.id IS NULL
UNION ALL
SELECT 'duplicate_open_separations', COUNT(*)
FROM (
  SELECT "employeeId" FROM "employee_separations"
  WHERE "status" IN ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'CLEARANCE_IN_PROGRESS')
  GROUP BY "employeeId" HAVING COUNT(*) > 1
) duplicates
UNION ALL
SELECT 'clearance_manual_item_without_department', COUNT(*)
FROM "employee_clearance_items"
WHERE "clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN')
UNION ALL
SELECT 'local_generated_hr_request_file', COUNT(*)
FROM "hr_requests"
WHERE "generatedFilePath" IS NOT NULL;

SELECT 'unbound_authenticated_upload_session', COUNT(*)
FROM "file_upload_sessions" session
LEFT JOIN "file_objects" object ON object.id = session."fileObjectId"
WHERE session."publicSessionTokenHash" IS NULL
  AND object."creatorUserId" IS NULL
  AND session."status" IN ('ISSUED', 'UPLOADED', 'FINALIZING', 'CLEAN');

SELECT 'hr_request_terminal_evidence_missing', COUNT(*)
FROM "hr_requests"
WHERE "status" IN ('REJECTED', 'CANCELLED', 'COMPLETED');

SELECT 'separation_terminal_evidence_missing', COUNT(*)
FROM "employee_separations"
WHERE "status" IN ('REJECTED', 'CANCELLED', 'COMPLETED');

SELECT 'clearance_terminal_evidence_missing', COUNT(*)
FROM "employee_clearances"
WHERE "status" = 'COMPLETED';

SELECT 'clearance_item_invalid_cleared_by', COUNT(*)
FROM "employee_clearance_items" item
LEFT JOIN "employee_clearances" clearance ON clearance.id = item."clearanceId"
LEFT JOIN "employee_separations" separation ON separation.id = clearance."separationId"
LEFT JOIN "employees" subject ON subject.id = separation."employeeId"
LEFT JOIN "employees" clearer ON clearer.id = item."clearedById"
WHERE item."clearedById" IS NOT NULL
  AND (clearer.id IS NULL
    OR subject.id IS NULL
    OR clearer."companyId" IS DISTINCT FROM subject."companyId");

-- Detail query for reconciliation owners; this is intentionally read-only.
SELECT item.id, item."clearanceType", item."clearanceId"
FROM "employee_clearance_items" item
WHERE item."clearanceType" IN ('HR', 'FINANCE', 'IT', 'ADMIN')
ORDER BY item.id;
