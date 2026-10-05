# Developer 3 — Leave, Attendance, Self-Service, and Dashboard

## Document purpose

This is the complete engineering handoff for Developer 3 in the **ERP Foundation Completion** programme.

Developer 3 starts immediately and works in parallel with Developer 2. Developer 3 owns leave, attendance, employee self-service, live manager-dashboard aggregation, and final cross-module UAT coordination. Developer 3 must use the current authentication context without changing User, Role, Permission, Session, or registration structures before Developer 1 joins.

## Delivery outcome

An employee must be able to:

1. View their own workspace.
2. Check in and check out.
3. View attendance history.
4. View leave balances.
5. Create, edit, submit, and cancel their own leave requests.
6. View their onboarding progress, documents, and assigned assets.

An authorized manager must be able to:

1. Review scoped attendance.
2. Correct attendance with a required reason.
3. Review pending leave.
4. Approve, reject, or cancel leave according to policy.
5. View a live tenant-scoped dashboard.

No employee may provide another employee ID to a self-service API.

## Existing implementation to retain

The following already exist and should be completed rather than replaced:

- Leave Type.
- Leave Policy.
- Employee Leave Balance.
- Leave Request.
- Attendance.
- Shift and Employee Shift.
- Holiday.
- Employee Workspace API/components.
- Employee Leave profile components.
- Manager dashboard UI and typed local provider.
- Branch timezone.
- Organization authorization context.
- `OrganizationScopeService`.
- Business audit table.
- Shared UI components and shell.

Known incomplete areas:

- Leave page contains a placeholder Employee UUID.
- Several leave/attendance DTOs accept Employee/Approver IDs from the client.
- Leave/Attendance routes are not fully tenant-mapped.
- Leave and Attendance status columns are uncontrolled strings.
- Balance transitions are not fully protected against concurrency.
- Dashboard data source is `demo`.
- Employee workspace contains placeholder Leave/Project values.
- Attendance is marked planned in navigation.

## Start condition

Before implementation:

1. Pull the latest integration branch.
2. Run current backend/frontend builds.
3. Record Leave Type, Policy, Balance, Request, Attendance, Shift, Holiday, and Employee counts.
4. List every existing Leave/Attendance status/source value.
5. Confirm Branch timezone values and identify blank/invalid values.
6. Build frontend/domain code in parallel while waiting for Developer 2's migration.
7. Rebase after Developer 2 merges the onboarding/asset migration.
8. Create the leave/attendance migration only after that rebase.

## Shared engineering rules

- Schema: `dsp_pms`.
- Do not change User authentication columns, statuses, password/session semantics, Role, Permission, or Session schema. Prisma-only inverse relation fields required for Leave/Attendance actor foreign keys may be added to the `User` model, but they must not alter User database columns.
- Use existing request context and organization scope.
- Self-service always derives Employee from `request.user.employeeId`.
- Manager routes use explicit scoped permissions.
- Out-of-scope records return `404`.
- Invalid transitions return `409` with stable error codes.
- Leave days and attendance totals are calculated server-side.
- Store timestamps in UTC and calculate business dates using Branch timezone.
- No leave reason, personal note, document reference, or sensitive employee content is logged.
- Dashboard fixtures remain only in the development design-system page.
- New tenant navigation remains hidden until Developer 1 activates permissions.

---

## Work package D3-01 — Workforce domain contracts

### Leave statuses

Use one shared TypeScript constant/union:

```text
DRAFT
SUBMITTED
APPROVED
REJECTED
CANCELLED
```

### Attendance statuses

```text
PRESENT
ABSENT
HALF_DAY
LEAVE
HOLIDAY
WEEK_OFF
```

### Attendance source

```text
MANUAL
SELF_SERVICE
IMPORT
API
```

### Attendance approval status

```text
PENDING
APPROVED
REJECTED
```

Do not scatter untyped raw strings through services and UI.

### Stable errors

Define:

- `EMPLOYEE_LINK_REQUIRED`
- `LEAVE_POLICY_NOT_FOUND`
- `LEAVE_BALANCE_NOT_FOUND`
- `LEAVE_BALANCE_INSUFFICIENT`
- `LEAVE_OVERLAP`
- `LEAVE_STATE_CHANGED`
- `LEAVE_SELF_APPROVAL_FORBIDDEN`
- `BRANCH_TIMEZONE_REQUIRED`
- `ALREADY_CHECKED_IN`
- `NOT_CHECKED_IN`
- `ALREADY_CHECKED_OUT`
- `ATTENDANCE_STATE_CHANGED`

---

## Work package D3-02 — Leave and attendance database migration

### Migration name

After rebasing onto Developer 2's migration, create:

`leave_attendance_workflow_integrity`

### `LeaveRequest`

Add:

- `submittedAt`
- `approvedAt`
- `approvedByUserId`
- `rejectedAt`
- `rejectedByUserId`
- `cancelledAt`
- `cancelledByUserId`

Relations:

- Approver/rejector/canceller → User.

Indexes:

- `(employeeId, status, fromDate)`
- `(status, createdAt)`
- `(leaveTypeId, status)`
- `(fromDate, toDate)`

PostgreSQL checks:

- Status is one of the approved Leave states.
- `fromDate <= toDate`.
- `requestedDays > 0`.
- `approvedDays` is null or non-negative.
- Half-day requests have a permitted server-calculated value.

### `EmployeeLeaveBalance`

Retain:

- Unique `(employeeId, leaveTypeId, year)`.

Add checks:

- `entitlement >= 0`.
- `used >= 0`.
- `pending >= 0`.

Do not add a static non-negative Balance constraint because a Leave Policy may explicitly allow a controlled negative balance.

### `Attendance`

Add:

- `lastModifiedByUserId`
- `lastModifiedAt`

Relationship:

- Modifier → User.

Retain:

- Unique `(employeeId, attendanceDate)`.

Indexes:

- `(attendanceDate, status)`
- `(employeeId, attendanceDate, isActive)`
- `(approvalStatus, attendanceDate)`

Checks:

- Status is valid.
- Source is valid.
- Approval status is valid.
- Check-out cannot precede check-in.
- Worked hours cannot be negative.
- Late, early-departure, and overtime minutes cannot be negative.

### `BranchWorkingDay`

Add a Branch working-calendar table with:

- `id`
- `branchId`
- `dayOfWeek` using `0` through `6`
- `isWorkingDay`
- `createdAt`
- `updatedAt`

Constraints:

- Foreign key to Branch.
- Unique `(branchId, dayOfWeek)`.
- Check `dayOfWeek` is between `0` and `6`.
- Index `branchId`.

Backfill seven rows for every existing Branch. Default Monday through Friday to working and Saturday/Sunday to non-working, but mark the Branch configuration for administrator review before Leave or Attendance is activated. Do not silently assume that default is correct for production tenants.

### Preflight and normalization

Before enabling checks:

1. List distinct Leave Request statuses.
2. List distinct Attendance status/source/approval values.
3. Normalize spelling/casing with reviewed SQL.
4. Report unknown values and stop migration until mapped.
5. Detect duplicate Employee/Attendance Date rows.
6. Detect Leave Requests with invalid date ranges.
7. Detect negative Leave Balance fields.
8. Detect check-out before check-in.
9. Detect Branches with missing or invalid timezones.
10. Create and verify seven working-calendar rows per Branch.
11. Record all affected table counts.

### Migration acceptance

- Applies to empty and populated development databases.
- Invalid legacy values are explicitly reported or mapped.
- No business rows are silently deleted.
- Existing valid Leave and Attendance rows remain unchanged.

---

## Work package D3-03 — Leave policy resolver

### Policy precedence

Resolve one active policy in this order:

1. Branch + Department + Designation.
2. Branch + Department.
3. Branch default.

If multiple policies have the same specificity, treat it as a configuration conflict rather than selecting unpredictably.

### Inputs

- Employee.
- Leave Type.
- From/to date.
- Half-day selection.
- Employee Branch.
- Department.
- Designation.
- Active Shift/working pattern.
- Branch working calendar.
- Branch timezone.
- Holiday calendar.

### Server-calculated outputs

- Requested working days.
- Excluded holidays.
- Excluded non-working days.
- Applicable policy ID.
- Entitlement/balance impact.
- Maximum consecutive-day validation.
- Negative-balance validation.

The frontend must not submit a trusted `requestedDays`.

### Date rules

- Convert user-selected dates to Branch-local calendar dates.
- Store normalized timestamps consistently.
- Include both from/to dates.
- Exclude configured holidays.
- Exclude non-working days using `BranchWorkingDay`.
- Allow half-day only when Leave Type permits it.
- Reject an invalid or zero-day request.

### Branch calendar administration

Add working-day configuration to the existing Branch administration flow:

- Display all seven days.
- Require at least one working day.
- Save the seven-day configuration transactionally.
- Require a valid Branch timezone.
- Block Leave/Attendance activation until timezone and working days are reviewed.

### Overlap rule

Reject overlap with the same Employee's:

- `SUBMITTED` requests.
- `APPROVED` requests.

Cancelled/rejected requests do not block a new request.

---

## Work package D3-04 — Leave balance generation

### Purpose

Leave Requests cannot operate reliably until every eligible Employee has a balance for the selected Leave Type and year. Add an idempotent administrative generation process.

### API

- `POST /employee-leave-balances/generate`

Input:

```text
year
companyId?
branchId?
employeeId?
dryRun?
```

All supplied scope IDs must be authorized. The backend derives Company Group from the request context.

### Dry run

Return:

- Eligible Employee count.
- Applicable policy count.
- Balances to create.
- Existing balances to retain.
- Configuration errors.
- Employees without a matching policy.

Dry run performs no writes.

### Generation

For each scoped active Employee and active Leave Type:

1. Resolve the applicable policy.
2. Calculate annual entitlement.
3. Calculate permitted carry forward from the previous year.
4. Cap carry forward using the policy limit.
5. Upsert `(employeeId, leaveTypeId, year)`.
6. Never overwrite non-zero used or pending values.
7. Report skipped/configuration-conflict records.

Run generation in bounded batches and one transaction per batch. Repeating the same request must not duplicate or reset balances.

### Advanced accrual boundary

This plan supports yearly balance generation and capped carry forward. Monthly/daily accrual scheduling remains deferred.

---

## Work package D3-05 — Leave request state machine

### Create Draft

Self-service:

- Employee is derived from session.
- Employee cannot create for another Employee.

Administrative:

- HR may create for a scoped Employee.

Draft:

- May be edited.
- Has no balance impact.
- Can be cancelled by its Employee.

### Submit transaction

Use a Serializable transaction with a bounded retry for serialization/deadlock failures.

1. Scope-load request and Employee.
2. Require `DRAFT`.
3. Recalculate requested days.
4. Resolve policy.
5. Lock/read Leave Balance.
6. Check overlap.
7. Check available/allowed negative balance.
8. Increase `pending`.
9. Save calculated requested days and balance relation.
10. Set `SUBMITTED` and `submittedAt`.
11. Commit.
12. Audit safe status/day values.

Concurrent submit must result in one success.

### Approve transaction

1. Scope-load request.
2. Require `SUBMITTED`.
3. Resolve authenticated approver.
4. Reject self-approval.
5. Lock request and Balance.
6. Recalculate/validate expected pending impact.
7. Reduce pending.
8. Increase used.
9. Recalculate balance.
10. Set `APPROVED`, approver, approved days, and timestamp.
11. Commit.
12. Audit.

### Reject transaction

1. Require `SUBMITTED`.
2. Require rejection reason.
3. Lock Balance.
4. Restore pending days.
5. Set `REJECTED`, rejector, and timestamp.
6. Commit and audit.

### Cancellation

Employee:

- May cancel own `DRAFT`.
- May cancel own `SUBMITTED`, restoring pending days.

Authorized manager:

- May cancel `APPROVED`.
- Must provide reason.
- Restores used/balance transactionally.

Do not physically delete Leave Requests.

### Pending approvals

Replace trust in `pending-approvals/:approverId` with a context-derived pending-approval endpoint.

If the legacy route remains temporarily:

- Verify the supplied approver matches the authenticated actor or is within a manager's authorized scope.
- Mark it deprecated.

### APIs

Administrative:

- Existing Leave Type/Policy/Balance APIs, scope hardened.
- `GET /leave-requests/pending-approvals`
- Existing create/get/update/submit/approve/reject routes, with actor IDs removed from DTOs.

Self-service:

- Added under `/me` in D3-06.

---

## Work package D3-06 — Attendance business-date service

### Timezone

- Use `Branch.timezone`.
- Validate as an IANA timezone.
- Block attendance activation when timezone is missing/invalid.
- Store check-in/out timestamps in UTC.
- Derive `attendanceDate` in Branch timezone.

### Overnight shifts

- Check-in establishes the business date.
- Check-out after midnight remains on the original open attendance row.
- Worked duration is calculated across the date boundary.
- Maximum open-shift duration is 24 hours; older open records require manager correction.

### Self check-in

1. Resolve Employee from session.
2. Load active Branch and Shift.
3. Resolve Branch-local business date.
4. Find existing/open attendance.
5. Reject duplicate check-in.
6. Create or update Attendance with source `SELF_SERVICE`.
7. Calculate lateness after grace period.
8. Audit safe timestamps/status.

### Self check-out

1. Resolve Employee.
2. Find today's or valid overnight open attendance.
3. Reject missing check-in.
4. Reject duplicate check-out.
5. Calculate gross worked time.
6. Deduct `Shift.breakMinutes` only when gross attendance duration reaches the scheduled shift duration minus `graceOutMinutes`; shorter attendance receives no automatic break deduction.
7. Calculate early departure and overtime.
8. Save atomically.
9. Audit.

### Manager correction

Input:

- Corrected check-in/out.
- Status.
- Required correction reason.
- Optional safe remarks.

Rules:

- Requires attendance-manage permission.
- Record must be in manager's organization scope.
- Store modifier user and timestamp.
- Recalculate worked/late/early/overtime values server-side.
- Do not allow ownership/Employee/Branch changes.

### Duplicate protection

Use:

- Existing Employee/Date unique constraint.
- Conditional updates.
- Stable conflict codes.

Do not implement biometric/device integration in this plan.

---

## Work package D3-07 — Self-service context and APIs

### Context resolver

Create one reusable self-service resolver:

1. Read `request.user.employeeId`.
2. If missing, throw `EMPLOYEE_LINK_REQUIRED`.
3. Scope-load active Employee.
4. Load Company, Branch, Department, Designation, and timezone required by self-service.
5. Return the resolved context.

No `/me` endpoint accepts Employee ID.

### APIs

- `GET /me/workspace`
- `GET /me/onboarding`
- `GET /me/documents`
- `GET /me/assets`
- `GET /me/leave`
- `POST /me/leave-requests`
- `PATCH /me/leave-requests/:id`
- `POST /me/leave-requests/:id/submit`
- `POST /me/leave-requests/:id/cancel`
- `GET /me/attendance`
- `POST /me/attendance/check-in`
- `POST /me/attendance/check-out`

### Permissions

Temporarily:

- Routes remain hidden/default-protected during development.

After Developer 1:

- Read endpoints require `hr.self.read`.
- Self-service writes require `hr.self.manage`.

Self-service permission does not permit access to administrative Employee/Leave/Attendance endpoints.

### Workspace data

Return:

- Employee identity.
- Today's attendance.
- Leave balances.
- Upcoming approved leave.
- Onboarding progress/tasks.
- Document status/expiry summary.
- Assigned assets.

Do not return Projects until the Project domain is implemented.

---

## Work package D3-08 — Live manager dashboard

### API

Add:

- `GET /dashboard/manager`

### Response contract

```text
asOf
timezone
context
kpis
pendingOnboardingTasks
pendingLeaveApprovals
attendanceOverview
recentJoiners
source = "live"
```

### KPIs

- Total active employees.
- Present today.
- On leave today.
- Active onboardings.

### Supporting sections

- Pending onboarding tasks.
- Pending leave approvals.
- Attendance overview.
- Recent joiners.

### Query rules

- Use active organization scope.
- Use Branch-local date where Branch scope is active.
- `asOf` is one UTC timestamp for the response.
- Branch scope returns that Branch's IANA timezone.
- Company/Group scope computes each Branch's “today” using its own timezone and returns `timezone = "MULTI"` when more than one timezone is present.
- Apply scope before counts.
- Execute independent aggregate queries in parallel.
- Avoid per-employee/N+1 queries.
- Return zero/empty collections, not fabricated data.
- Do not add Redis caching initially for 10–20 users.

### Removed fixture widgets

Do not show:

- Open Positions.
- Interviews.
- Active Projects.
- Sample trends not supported by real historical data.

Fixtures remain only in `/design-system`.

### Developer 2 integration

Developer 3 may begin with typed mock implementations for:

- Active onboarding count.
- Pending onboarding task list.
- Assigned asset summary.

Before completion, replace those mocks with Developer 2's live scoped summary services and add integration tests.

---

## Work package D3-09 — Frontend implementation

### Employee workspace

Create/complete:

- `/my-workspace`.
- Employee greeting/identity.
- Today attendance.
- Check-in/check-out.
- Leave balances.
- Apply Leave drawer.
- Leave history.
- Upcoming Leave.
- Onboarding progress.
- Document status.
- Assigned Assets.

### Manager Leave

- Leave Type management.
- Leave Policy management.
- Branch working-day/timezone configuration.
- Leave-balance dry run/generation.
- Leave dashboard/list.
- Scoped filters.
- Pending approvals.
- Approve/reject/cancel drawers.
- Balance and policy details.
- Conflict/error feedback.

### Manager Attendance

- Today/month views.
- Employee/status filters.
- Correction drawer.
- Missing timezone/configuration state.
- Export remains deferred unless already implemented safely.

### Manager dashboard

- Connect existing visual dashboard to the live provider.
- Replace demo badge/source.
- Use only real KPIs and sections.
- Loading skeleton.
- Retryable error.
- Empty state.
- Permission denied.

### UI requirements

- Current design system.
- Right-side drawers for forms/actions.
- Keyboard-accessible controls.
- Focus restoration.
- No body horizontal overflow.
- Responsive checks at 1440px, 1024px, 768px, and 390px.
- Stable backend error codes mapped to human-readable messages.

---

## Work package D3-10 — Automated testing

### Leave unit/service tests

- Policy precedence.
- Policy configuration conflict.
- Balance-generation dry run.
- Idempotent yearly balance generation.
- Carry-forward cap.
- Existing used/pending preservation.
- Missing Branch calendar.
- Holiday/non-working-day exclusion.
- Half-day validation.
- Overlap detection.
- Insufficient balance.
- Controlled negative balance.
- Draft edit.
- Concurrent submit.
- Concurrent approval.
- Self-approval rejection.
- Reject balance restoration.
- Submitted cancellation.
- Approved cancellation.
- State-transition idempotency.

### Attendance tests

- IANA timezone validation.
- Branch-local date.
- IANA timezone offset changes across daylight-saving transition dates.
- Duplicate check-in.
- Check-out without check-in.
- Duplicate check-out.
- Overnight shift.
- Break deduction.
- Late/early/overtime calculation.
- Manager correction.
- Cross-tenant correction.

### Self-service tests

- Missing Employee link.
- Disabled Employee.
- Employee cannot provide another Employee ID.
- Own Leave/Attendance/Documents/Onboarding/Assets only.
- Administrative endpoints remain forbidden.

### Dashboard tests

- Company Group, Company, and Branch scope.
- Counts match direct database queries.
- Empty tenant.
- Mixed Branch timezones.
- No fixture data.
- No unauthorized totals.
- Aggregate query count avoids N+1 behavior.

### Required commands

Backend:

```powershell
pnpm.cmd run prisma:validate
pnpm.cmd run prisma:generate
pnpm.cmd run lint:check
pnpm.cmd run test:foundation
pnpm.cmd run build
```

Frontend:

```powershell
pnpm.cmd run lint
pnpm.cmd run build
```

Changed and activated files must have zero lint errors or warnings.

---

## Work package D3-11 — UAT coordination

Developer 3 coordinates evidence but each developer fixes defects in their owned domain.

### UAT dataset

Use 10–20 users across:

- Two Company Groups.
- Multiple Companies.
- Multiple Branches.
- Different timezones if possible.
- Organization Owner.
- Company Administrator.
- HR Manager.
- Asset Manager.
- Project Manager.
- Employee.

### End-to-end workflow

1. Register Company Group.
2. Finish organization onboarding.
3. Invite and activate users.
4. Assign scoped roles.
5. Create/link Employees.
6. Publish onboarding template.
7. Start/complete Employee onboarding.
8. Register/verify Documents.
9. Assign/return Assets.
10. Check in/out.
11. Submit/approve/reject/cancel Leave.
12. Verify `/my-workspace`.
13. Verify Manager dashboard.
14. Repeat cross-tenant negative checks.

### Evidence

Capture:

- Test persona and scope.
- Preconditions.
- Steps.
- Expected result.
- Actual result.
- Request ID for failures.
- Screenshot for UI outcomes.
- Database verification query/result where relevant.

Do not place real sensitive employee information in evidence.

---

## Migration coordination and deployment

Developer 3 creates the migration only after Developer 2's migration is merged and rebased.

Procedure:

1. Rebase.
2. Run migration status.
3. Record affected table counts/status values.
4. Create migration against a disposable local PostgreSQL database.
5. Review every SQL statement.
6. Confirm `dsp_pms`.
7. Test normalization and constraints against a development-data copy.
8. Run tests/builds.
9. Merge migration separately.
10. Notify Developer 1 to rebase before creating the security migration.
11. Apply using `prisma migrate deploy`.
12. Recheck status, constraints, and counts.

Never use `prisma db push` against AWS RDS. Never mark a migration as applied unless the SQL executed.

---

## Handoff to Developer 1

Provide:

- Final Leave/Attendance/Self-service/Dashboard route list.
- Explicit read/manage/self permission requirements.
- Cross-tenant tests.
- Deprecated unsafe actor-ID routes.
- Routes temporarily restricted to `platform.admin`.

Developer 1 activates:

- `hr.leave.read/manage`.
- `hr.attendance.read/manage`.
- `hr.self.read/manage`.

---

## Definition of done

- Leave Policy is resolved deterministically.
- Branch timezone and seven-day working calendar are reviewed before activation.
- Yearly Leave Balances are generated idempotently without overwriting used/pending values.
- Requested days are server-calculated.
- Leave Balance remains correct under concurrency.
- Employees cannot approve their own Leave.
- Attendance uses Branch timezone and UTC timestamps.
- Duplicate attendance events are prevented.
- Employees access only their own `/me` records.
- Manager operations remain within tenant scope.
- Dashboard uses live data only.
- Developer 2 onboarding/assets summaries are integrated.
- UAT evidence covers all three developer workstreams.
- Migration is validated and applied without unrelated data loss.

## Explicitly deferred

- Biometric attendance devices.
- Timesheet/project-hour integration.
- Payroll attendance integration.
- Generic approval/workflow engine.
- Direct binary Leave attachments.
- Advanced leave accrual scheduler.
- Recruitment/Open Positions/Interviews.
- Projects, CRM, payroll, finance, procurement, and BIM.
