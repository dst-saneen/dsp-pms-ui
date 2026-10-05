# Block B0 — Dry-run report (read-only)

Recorded: 2026-08-11  
Database: **not queried**. Shared `dsp_erp_dev` / AWS RDS were not touched.  
Migration SQL (unapplied): `backend/prisma/migrations/20260811120000_leave_policy_matrix_and_manager_hr_approval/migration.sql`

## Block A exit (gate just completed)

| Check | Result |
|-------|--------|
| Prisma validate + generate | Pass |
| Backend `lint:check` | 0 errors / 0 warnings |
| Backend `build` | Pass |
| Backend `test` | 65 suites, 355 tests pass |
| Frontend `lint` | Pass |
| Frontend production `next build` | Pass |
| `git diff --check` | Pass (CRLF warnings only) |

## Schema inspection (no new tables/columns)

| Object | Finding | B0 action |
|--------|---------|-----------|
| `leave_policies` | Columns already include `departmentId` + `designationId`. Unique is `(companyId, branchId, departmentId, designationId, leaveTypeId)`. Postgres treats NULLs as distinct, so **duplicate active Branch-default / Branch+Dept / Branch+Designation rows are possible**. | Four **partial unique indexes** on active rows at the four scopes. |
| `approval_workflows` / steps | Global `GLOBAL:LEAVE_APPROVAL` already seeded with **step 1 `REPORTING_MANAGER` only** (`20260805140000`). Resolver currently folds HR into manager-missing fallback on that single step. | Add **step 2 `ROLE` / `HR_MANAGER`** on global + uncustomized company copies. |
| `approval_transactions` | Existing leave transactions stay as-is. | **No rewrite.** |
| `leave_requests` / balances | `submittedAt` exists; no matrix snapshot columns needed for B1. | Index `(status, submittedAt)` only. |
| Pending queue | Steps indexed by `approverId` only. | Composite `(approverId, status, stepNo)`. |

**No missing relation that would require a new table or column.**

## Queries to run on a disposable DB before apply

Duplicate active policies (must be empty or CREATE UNIQUE INDEX fails):

```sql
-- Branch default
SELECT "companyId", "branchId", "leaveTypeId", COUNT(*)
FROM "leave_policies"
WHERE "isActive" AND "departmentId" IS NULL AND "designationId" IS NULL
GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;

-- Branch + department
SELECT "companyId", "branchId", "departmentId", "leaveTypeId", COUNT(*)
FROM "leave_policies"
WHERE "isActive" AND "departmentId" IS NOT NULL AND "designationId" IS NULL
GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;

-- Branch + designation
SELECT "companyId", "branchId", "designationId", "leaveTypeId", COUNT(*)
FROM "leave_policies"
WHERE "isActive" AND "departmentId" IS NULL AND "designationId" IS NOT NULL
GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;

-- Branch + department + designation
SELECT "companyId", "branchId", "departmentId", "designationId", "leaveTypeId", COUNT(*)
FROM "leave_policies"
WHERE "isActive" AND "departmentId" IS NOT NULL AND "designationId" IS NOT NULL
GROUP BY 1, 2, 3, 4, 5 HAVING COUNT(*) > 1;
```

Leave workflows (global vs company; customized = do not auto-upgrade):

```sql
SELECT aw."scopeKey", aw."companyId", aw."isActive",
       COUNT(s."id") AS step_count,
       STRING_AGG(s."stepNo" || ':' || s."approverType" || COALESCE(':' || s."approverRole", ''), ', ' ORDER BY s."stepNo") AS steps
FROM "approval_workflows" aw
LEFT JOIN "approval_workflow_steps" s ON s."workflowId" = aw."id"
WHERE aw."workflowCode" = 'LEAVE_APPROVAL'
   OR aw."scopeKey" LIKE '%:LEAVE_APPROVAL'
GROUP BY aw."id"
ORDER BY aw."scopeKey";
```

Customized company workflows (owner review list — **not** updated by the migration):

```sql
SELECT aw."scopeKey", aw."companyId"
FROM "approval_workflows" aw
WHERE aw."scopeKey" LIKE 'COMPANY:%:LEAVE_APPROVAL'
  AND aw."isActive"
  AND NOT (
    (SELECT COUNT(*) FROM "approval_workflow_steps" s WHERE s."workflowId" = aw."id") = 1
    AND EXISTS (
      SELECT 1 FROM "approval_workflow_steps" s
      WHERE s."workflowId" = aw."id"
        AND s."stepNo" = 1
        AND s."approverType" = 'REPORTING_MANAGER'
    )
  );
```

Pending leave / missing managers (informational):

```sql
SELECT lr."status", COUNT(*) FROM "leave_requests" lr GROUP BY 1;

SELECT COUNT(*) AS submitted_without_manager
FROM "leave_requests" lr
JOIN "employees" e ON e."id" = lr."employeeId"
WHERE lr."status" IN ('SUBMITTED', 'PENDING')
  AND (e."managerId" IS NULL OR e."isActive" = false);
```

## Apply rules

1. Review the SQL file.  
2. Apply only on **empty or snapshot disposable** DBs with schema `dsp_pms`.  
3. Confirm objects land in `dsp_pms`.  
4. Re-run does not duplicate steps/indexes.  
5. Row counts on `leave_policies` / `leave_requests` / `employee_leave_balances` / `approval_transactions` must be unchanged (steps may increase by +1 on uncustomized leave workflows only).  
6. **Do not** `migrate deploy` to `dsp_erp_dev`.

## Not in this migration (Block B1+)

- Resolver Branch+Designation-only tier and matrix APIs.  
- Sequential skip-manager / same-actor rules (uses the new step 2 once B2 lands).  
- Existing in-flight one-step approval transactions stay one-step until they complete.
