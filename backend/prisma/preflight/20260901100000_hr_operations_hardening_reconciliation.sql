-- Reconciliation workbook queries for HR Operations. These are read-only;
-- decide corrections in an approved data-fix runbook, never by editing history
-- during migration execution.

SELECT request.id, request."requestNo", request.status, request."employeeId",
       employee."companyId" AS employee_company_id, employee."branchId" AS employee_branch_id,
       type."companyId" AS request_type_company_id
FROM "hr_requests" request
LEFT JOIN "employees" employee ON employee.id = request."employeeId"
LEFT JOIN "hr_request_types" type ON type.id = request."requestTypeId"
WHERE employee.id IS NULL OR type.id IS NULL
   OR (request."companyId" IS NOT NULL AND request."companyId" IS DISTINCT FROM employee."companyId")
   OR (request."companyId" IS NOT NULL AND request."companyId" IS DISTINCT FROM type."companyId")
ORDER BY request.id;

SELECT separation.id, separation.status, separation."employeeId", employee."companyId", employee."branchId"
FROM "employee_separations" separation
LEFT JOIN "employees" employee ON employee.id = separation."employeeId"
WHERE employee.id IS NULL
   OR (separation."companyId" IS NOT NULL AND separation."companyId" IS DISTINCT FROM employee."companyId")
ORDER BY separation.id;

SELECT item.id, item."clearanceId", item."companyId", item."clearanceType",
       item."clearedById", clearer."companyId" AS clearer_company_id
FROM "employee_clearance_items" item
LEFT JOIN "employees" clearer ON clearer.id = item."clearedById"
WHERE item."clearedById" IS NOT NULL
  AND (clearer.id IS NULL
    OR (item."companyId" IS NOT NULL AND clearer."companyId" IS DISTINCT FROM item."companyId"))
ORDER BY item.id;
