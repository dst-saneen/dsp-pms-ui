# Leave Policy Matrix and Manager-HR Approval Migration Deployment Plan

| Field | Value |
|---|---|
| Status | READY FOR EXECUTION REVIEW - NOT APPLIED |
| Version | 1.0 |
| Plan date | 2026-08-13 |
| Repository baseline | `main` at `22f195b` |
| Migration | `20260811120000_leave_policy_matrix_and_manager_hr_approval` |
| Development target | PostgreSQL database `dsp_erp_dev`, schema `dsp_pms` |
| Current database result | Prisma reports the migration as pending |
| Change control | Applying the migration to shared AWS RDS requires explicit approval, backup evidence and a named operator |

## 1. Purpose

This work order closes the gap between the Leave code already delivered by Saneen and the database schema currently running in the shared development environment.

The repository change and the database deployment are separate activities:

- Saneen added the migration in commit `30de1cf` on 2026-08-11.
- Saneen's 2026-08-12 review remediation in commit `5d2cddf` changed Leave services, tests and UI behavior, but did not modify this migration.
- A read-only Prisma status check on 2026-08-13 found 95 migration folders and reported this migration as not yet applied to `dsp_erp_dev.dsp_pms`.
- No migration was executed or resolved during that check.

The objective is to validate the migration safely, deploy it through Prisma to the approved environment, verify its business effect and complete Employee/Manager/HR smoke testing without changing existing Leave history.

## 2. Migration Scope

The migration is additive. It does not create new tables or columns and does not rewrite existing Leave requests, Leave balances or approval transactions.

It performs these changes:

1. Creates four partial unique indexes so only one active Leave Policy can exist for a Leave Type at each supported Branch, Department and Designation scope.
2. Creates an approval-queue lookup index on approver, status and step number.
3. Creates a Leave Request lookup index on status and submission date.
4. Adds Step 2 `ROLE / HR_MANAGER` to the active global `LEAVE_APPROVAL` workflow when that step is missing.
5. Adds the same HR step to an active Company Leave workflow only when it is still the uncustomized one-step Reporting Manager workflow.
6. Leaves customized Company workflows unchanged.
7. Leaves already-created approval transactions unchanged; existing in-flight one-step requests finish using their stored transaction steps.

## 3. Primary Risks

| Risk | Consequence | Control |
|---|---|---|
| Duplicate active Leave Policies already exist | A unique-index statement can fail | Run all four duplicate queries before deployment; result must be zero rows |
| Other migrations become pending before deployment | `prisma migrate deploy` would apply more than this migration | Re-run status immediately before deployment and stop if any unreviewed migration is pending |
| DDL waits on active database sessions | Migration can block or increase response time | Use a low-traffic window, stop mutation traffic and monitor locks |
| Customized Company workflow is mistaken for a default workflow | Incorrect approval chain | Inventory every active Company Leave workflow before applying |
| HR role is not configured for a Company | New Leave requests can wait at HR review | Verify an eligible scoped HR approver exists before UAT |
| Application and database versions differ during rollout | Requests can use incomplete behavior | Deploy migration and compatible backend as one controlled release |
| Failed migration is marked failed in Prisma history | Later deployments remain blocked | Do not use `migrate resolve --applied`; inspect the exact failure and use a reviewed recovery plan |

## 4. Hard Safety Rules

- Do not run `prisma migrate dev`, `prisma migrate reset`, cleanup SQL or destructive tests against AWS RDS.
- Do not manually insert a successful row into `_prisma_migrations`.
- Do not run `prisma migrate resolve --applied` unless the complete SQL was independently applied and every object was verified. That is not the planned deployment path.
- Do not delete or merge duplicate policies automatically. A business owner must decide which policy remains active.
- Do not expose database URLs, passwords, certificate contents or employee Leave information in logs or evidence files.
- Do not apply to shared `dsp_erp_dev` until the disposable rehearsal, backup and go/no-go review have passed.
- Stop if the connected database or schema is not exactly the approved target.
- Stop if a new pending migration appears.

## 5. Work Package A - Freeze and Record the Baseline

### Actions

1. Record the Git branch, commit and operator.
2. Confirm the worktree is clean or document unrelated changes.
3. Confirm the migration file checksum.
4. Run Prisma validation and static migration preflight.
5. Record the current migration status without changing the database.

### Commands

Run from `C:\DataScape\HRMS\ERP`:

```powershell
git status --short
git branch --show-current
git rev-parse HEAD
Get-FileHash .\backend\prisma\migrations\20260811120000_leave_policy_matrix_and_manager_hr_approval\migration.sql -Algorithm SHA256

cd .\backend
pnpm.cmd run prisma:validate
pnpm.cmd run migration:leave-policy:preflight
pnpm.cmd run prisma:migrate:status
```

### Exit criteria

- Branch and commit are recorded.
- Prisma schema validates.
- Static B0 preflight passes.
- The only expected pending migration is `20260811120000_leave_policy_matrix_and_manager_hr_approval`.
- No database write has occurred.

## 6. Work Package B - Read-Only Target Data Assessment

Run these checks against the intended target using a read-only database account where possible. Set the search path explicitly to `dsp_pms`.

### B1. Confirm database identity

```sql
SELECT current_database() AS database_name,
       current_schema() AS current_schema,
       current_user AS connected_user;

SHOW search_path;
```

Expected database: `dsp_erp_dev`.

Expected application schema: `dsp_pms`.

### B2. Check duplicate active policies

Execute the four duplicate-policy queries maintained in:

`docs/product/leave-next-phase-block-b0-dry-run.md`

Every query must return zero rows. If any query returns a row:

1. Stop the deployment.
2. Export only the safe identifiers and counts for review.
3. Ask HR/Product to identify the authoritative policy.
4. Prepare separate, reviewed remediation SQL.
5. Re-run the assessment after remediation.

### B3. Inventory Leave approval workflows

```sql
SELECT aw."id",
       aw."scopeKey",
       aw."companyId",
       aw."isActive",
       COUNT(s."id") AS step_count,
       STRING_AGG(
         s."stepNo" || ':' || s."approverType" || COALESCE(':' || s."approverRole", ''),
         ', ' ORDER BY s."stepNo"
       ) AS steps
FROM "approval_workflows" aw
LEFT JOIN "approval_workflow_steps" s ON s."workflowId" = aw."id"
WHERE aw."workflowCode" = 'LEAVE_APPROVAL'
   OR aw."scopeKey" LIKE '%:LEAVE_APPROVAL'
GROUP BY aw."id"
ORDER BY aw."scopeKey";
```

Classify each workflow as:

- Global default.
- Uncustomized Company workflow: exactly one Step 1 `REPORTING_MANAGER`.
- Customized Company workflow: any other step structure.

Record the expected number of HR steps the migration should add. Do not expect customized workflows to change.

### B4. Capture baseline counts

```sql
SELECT 'leave_policies' AS entity, COUNT(*) AS row_count FROM "leave_policies"
UNION ALL
SELECT 'leave_requests', COUNT(*) FROM "leave_requests"
UNION ALL
SELECT 'employee_leave_balances', COUNT(*) FROM "employee_leave_balances"
UNION ALL
SELECT 'approval_transactions', COUNT(*) FROM "approval_transactions"
UNION ALL
SELECT 'approval_workflow_steps', COUNT(*) FROM "approval_workflow_steps";
```

Also record:

- Count of submitted/pending Leave requests.
- Count of active scoped HR users eligible to process Leave.
- IDs of the workflow steps that exist before deployment.

### Exit criteria

- Database identity is confirmed.
- All duplicate queries return zero rows.
- Expected workflow changes are documented.
- Baseline counts are stored in the release evidence without sensitive content.

## 7. Work Package C - Disposable Database Rehearsal

The repository includes a protected validation script that does not read `backend/.env`. It requires an explicit disposable database URL, creates an isolated schema, deploys all migrations, verifies B0 objects, deploys again to confirm idempotency and drops the schema by default.

### Commands

```powershell
cd C:\DataScape\HRMS\ERP\backend

$env:B0_VALIDATE_DATABASE_URL = '<approved-disposable-postgresql-url>'
# Set only when the disposable server requires the AWS CA file:
# $env:DATABASE_SSL_CA = 'certs/global-bundle.pem'

pnpm.cmd run migration:leave-policy:apply

Remove-Item Env:B0_VALIDATE_DATABASE_URL -ErrorAction SilentlyContinue
```

Do not set `B0_ALLOW_SHARED_DEV=1` for a normal rehearsal. Use a separately named disposable database.

### Required rehearsals

1. Empty disposable database with schema `dsp_pms`.
2. Production-shaped disposable copy containing representative Leave Policies, workflows, balances, requests and approvals.

### Evidence

- First deployment completed.
- Six expected indexes exist.
- Global Leave workflow has at least two steps.
- Second deployment produced no duplicate objects or steps.
- Core business row counts are unchanged.
- Disposable schema/database was removed after evidence capture.

### Exit criteria

Both rehearsals pass. A successful empty-database run alone is not sufficient for the shared development deployment.

## 8. Work Package D - Shared Development Go/No-Go

The release owner conducts the review with Engineering and HR/Product.

### Go conditions

- Work Packages A-C passed.
- No duplicate active policy exists.
- Every affected Company has an eligible HR approver or an approved fallback.
- Customized Company workflows were reviewed and accepted unchanged.
- Backup evidence is recorded with timestamp and owner.
- A low-traffic deployment window is approved.
- The compatible backend build is ready.
- Only the reviewed migration is pending.

### No-go conditions

- Any duplicate query returns data.
- Backup evidence is missing.
- Target identity is ambiguous.
- Any additional unreviewed migration is pending.
- Disposable rehearsal failed.
- No eligible HR approver exists for a Company using sequential approval.
- Active DB locks or traffic make the DDL unsafe.

## 9. Work Package E - Backup and Deployment

### Before deployment

1. Stop or drain backend mutation traffic.
2. Capture the AWS RDS snapshot or verified logical-backup identifier.
3. Record current application version and migration status.
4. Run the duplicate checks one final time.
5. Confirm the target database and schema.

### Deployment command

From `backend`, using the approved environment configuration:

```powershell
pnpm.cmd run prisma:migrate:status
pnpm.cmd run prisma:migrate:deploy
pnpm.cmd run prisma:migrate:status
```

Expected final result: `Database schema is up to date!`

Do not substitute `prisma migrate resolve --applied` for `prisma migrate deploy`.

### Immediate stop conditions

- Prisma displays another pending migration.
- Connection points to the wrong database or schema.
- Unique-index creation reports duplicates.
- A lock timeout, permission failure or partially applied migration is reported.
- The backend cannot start with the migrated schema.

## 10. Work Package F - Database Verification

### F1. Verify migration history

```sql
SELECT "migration_name", "started_at", "finished_at", "rolled_back_at"
FROM "_prisma_migrations"
WHERE "migration_name" = '20260811120000_leave_policy_matrix_and_manager_hr_approval';
```

Expected:

- Exactly one migration-history row.
- `finished_at` is populated.
- `rolled_back_at` is null.

### F2. Verify indexes

```sql
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'dsp_pms'
  AND indexname IN (
    'leave_policies_active_branch_default_uidx',
    'leave_policies_active_branch_dept_uidx',
    'leave_policies_active_branch_designation_uidx',
    'leave_policies_active_branch_dept_designation_uidx',
    'approval_transaction_steps_approverId_status_stepNo_idx',
    'leave_requests_status_submittedAt_idx'
  )
ORDER BY indexname;
```

Expected: six rows.

### F3. Verify workflow steps

Re-run the workflow inventory query from Work Package B3.

Expected:

- The active global Leave workflow contains Step 1 Reporting Manager and Step 2 HR Manager.
- Each uncustomized active Company Leave workflow contains the added Step 2 HR Manager.
- Customized Company workflows are unchanged.
- No workflow contains duplicate step numbers.

### F4. Verify business data stability

Compare the baseline and post-deployment counts.

Expected:

- `leave_policies`: unchanged.
- `leave_requests`: unchanged.
- `employee_leave_balances`: unchanged.
- `approval_transactions`: unchanged.
- `approval_workflow_steps`: increases only by the pre-calculated number of missing HR steps.

### Exit criteria

Migration history, six indexes, workflow steps and row counts match the approved expectations.

## 11. Work Package G - Automated Validation

Run with no destructive fixtures against shared AWS RDS:

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd run prisma:validate
pnpm.cmd run lint:check
pnpm.cmd run build
pnpm.cmd run test
pnpm.cmd run test
pnpm.cmd run test:e2e

cd ..\frontend
pnpm.cmd run lint
pnpm.cmd exec tsc --noEmit
pnpm.cmd run build
```

All commands must pass. Any integration suite that creates or deletes business records must use a disposable PostgreSQL database, not `dsp_erp_dev`.

## 12. Work Package H - Functional Smoke and UAT

Use dedicated UAT users and approved non-production data. Do not use hard-coded shared credentials.

### Employee flow

1. Employee signs in within the correct Company and Branch.
2. Employee opens Leave balances and sees only their own balances.
3. Employee creates a valid Leave draft.
4. Employee submits the request.
5. The request enters Manager review when an eligible scoped manager exists.
6. The employee cannot approve their own request.

### Manager flow

1. The reporting manager signs in.
2. Only authorized reporting employees appear in the manager queue.
3. The manager approves the request exactly once.
4. A repeated or concurrent approval returns a stable conflict and does not create another transition.
5. The request advances to HR review.

### HR flow

1. An eligible scoped HR user signs in.
2. The HR queue shows the Manager-approved request.
3. An HR user from another Company or Branch cannot retrieve or act on it.
4. HR approves the request exactly once.
5. Balance consumption, ledger entry, audit entry and approval state are consistent.

### Policy matrix flow

1. HR opens the Leave Policy matrix.
2. HR creates or updates a valid Designation/Leave Type entitlement.
3. An enabled zero-day or negative entitlement is rejected.
4. Re-saving the same active policy does not create a duplicate row.
5. Omitted matrix cells follow the approved replace behavior.

### Calendar flow

1. Leave duration uses the effective Business Calendar.
2. A holiday is excluded correctly.
3. A working-day override remains a working day and is not displayed as a holiday.
4. A LEGACY Branch retains applicable Company holidays in a mixed-mode Company.

### Required personas

- Employee.
- Reporting Manager with active login and scoped `hr.team.approve`.
- HR Manager with scoped Leave permission.
- Foreign-Company HR negative test.
- Organization Owner or Company Administrator fallback test where configured.

Use `docs/product/leave-next-phase-uat-checklist.md` and `docs/product/leave-review-phase-h.md` for the signed test record.

## 13. Recovery and Rollback

### If deployment fails before completion

1. Keep application mutation traffic stopped.
2. Save the Prisma error and database logs without secrets.
3. Inspect `_prisma_migrations`, the six indexes and workflow steps.
4. Do not mark the migration applied.
5. Do not manually delete the migration-history row.
6. Decide between a reviewed forward-fix migration and backup restoration.
7. Rehearse the selected recovery on a disposable copy first.

### If deployment succeeds but application validation fails

Prefer a forward application fix because the new indexes protect data integrity and the migration changes no historical Leave transactions.

If rollback is unavoidable:

1. Keep traffic stopped.
2. Restore the approved pre-deployment snapshot into a separately named database first.
3. Validate the restored database before redirecting traffic.
4. Do not drop indexes or HR steps ad hoc without a reviewed reverse-impact report.
5. Record the incident and create a corrective migration before the next deployment.

## 14. Completion Criteria

The migration work is complete only when all of the following are true:

- Prisma reports the target schema is up to date.
- The migration-history row is successful.
- All six indexes exist under `dsp_pms`.
- Duplicate active Leave Policies are prevented at all four supported scopes.
- Expected global and uncustomized Company workflows include HR Step 2.
- Customized workflows are unchanged.
- Existing Leave requests, balances and approval transactions retain their pre-deployment counts.
- Backend and frontend quality gates pass.
- Employee, Manager and HR UAT passes with tenant-isolation negative tests.
- Backup, deployment, verification and sign-off evidence is attached.

## 15. Closure Record

| Evidence | Owner | Result | Reference |
|---|---|---|---|
| Git baseline and migration checksum | Engineering | Pending | |
| Read-only duplicate and workflow assessment | DBA/Engineering | Pending | |
| Empty disposable rehearsal | Engineering | Pending | |
| Production-shaped disposable rehearsal | Engineering | Pending | |
| Backup evidence | Operations | Pending | |
| Shared development deployment | Operations/Engineering | Pending | |
| Post-deployment SQL verification | DBA/Engineering | Pending | |
| Automated quality gates | Engineering | Pending | |
| Employee/Manager/HR UAT | HR/Product | Pending | |
| Technical sign-off | Technical Lead | Pending | |

### Final result

- Deployment date: ____________________
- Target database/schema: ____________________
- Applied by: ____________________
- Git commit: ____________________
- Backup reference: ____________________
- Migration result: PASS / FAIL
- UAT result: PASS / FAIL
- Approved for next environment: YES / NO
