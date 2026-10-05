# Workforce Time Management — Development Work Order

- **Status:** APPROVED BASELINE
- **Version:** 1.0
- **Baseline date:** 2026-08-05
- **Product:** Group ERP
- **Database:** PostgreSQL, schema `dsp_pms`
- **Business source of truth:** `docs/hr/workforce-time-management-plan.md`

## Document purpose

This is the decision-complete engineering handoff for implementing Shift Rosters, Attendance policies and exceptions, regularization, Leave ledgering, Overtime, Comp-off, workforce calendars and monthly Attendance closing.

The work extends the existing NestJS, Prisma, PostgreSQL, Next.js, Tailwind and shadcn/Radix application. It must not replace the existing Leave, Attendance, Shift, Employee Shift, Holiday, Employee Workspace or project Work Schedule features.

This document describes future source and database changes. Creating this document does not itself authorize applying migrations to AWS RDS or changing production data.

---

# Migration Impact Report

## 1. Migration identity

- Migration name: `workforce_time_management_foundation`
- Migration type: additive with controlled backfill and index replacement.
- Target schema: `dsp_pms`.
- Public API compatibility: existing routes and response envelopes remain compatible.
- Historical recalculation: prohibited.
- Destructive automated testing against AWS RDS: prohibited.

## 2. Migration risk

Overall risk is **high** because the migration:

- Adds workforce transaction and ledger tables.
- Adds relations to Attendance and Approval Workflow.
- Replaces the current global `workflowCode` uniqueness rule.
- Backfills immutable Leave opening snapshots.
- Creates Company Comp-off Leave Types and global approval configuration.
- Adds partial unique indexes and SQL check constraints not fully represented by Prisma syntax.

The migration is structurally additive. It does not drop existing workforce records or convert existing Attendance status values.

## 3. Required pre-migration evidence

Before generating or applying SQL, capture:

- Current Git commit.
- Prisma migration status.
- Active database name and schema.
- PostgreSQL version.
- Existing migration count.
- Counts for:
  - Companies.
  - Branches.
  - Branch working days.
  - Shifts.
  - Employee Shift assignments.
  - Holidays.
  - Leave Types.
  - Leave balances.
  - Leave requests.
  - Attendance.
  - Approval workflows and steps.
- Distinct existing values for:
  - Holiday type.
  - Leave request status.
  - Attendance status.
  - Attendance source.
  - Attendance approval status.
- Duplicate or invalid records that would violate new indexes.
- Verified backup or logical-snapshot evidence before production-shaped application.

Stop if the active database or schema is not the intended disposable environment. Migration generation and integration testing must not target live AWS RDS.

## 4. Compatibility commitments

- Existing `WorkSchedule` and `WorkScheduleItem` remain project/task Work Plan data.
- Existing Attendance rows retain their original status and calculated values.
- Existing Leave Request routes and lifecycle remain compatible.
- Existing active Shift grace values are preserved.
- Existing global Approval Workflows remain available after scope-key backfill.
- New nullable Attendance snapshot fields do not break old rows.
- New Comp-off and workflow configuration is idempotent.
- No sample roster, Attendance, Overtime or Comp-off transaction is inserted.

---

# Objective

Deliver a production-oriented workforce time-management foundation that:

1. Creates an auditable Branch Shift Roster.
2. Calculates Attendance against historical schedule snapshots.
3. Detects and resolves Attendance exceptions.
4. Protects monthly Attendance periods from uncontrolled historical mutation.
5. Adds an immutable Leave balance ledger.
6. Calculates and approves Overtime safely.
7. Converts approved Overtime into expiring Comp-off credits.
8. Produces stable Payroll Pending inputs without calculating payroll.
9. Enforces Company Group, Company, Branch, manager-team and employee-self scope.
10. Operates safely across multiple backend instances.

---

# Architecture Decision

## 1. Domain boundaries

### 1.1 Work Plan

Keep the existing models and routes:

- `WorkSchedule`
- `WorkScheduleItem`
- Project task work sessions

The UI label becomes **Work Plan** where clarification is required.

### 1.2 Shift Roster

Add a separate workforce domain:

- Prisma models begin with `ShiftRoster`.
- Backend administrative APIs begin with `/shift-rosters`.
- Frontend HR route is `/hr/work-schedule`.
- The employee workspace presents **Today's Shift** separately from **Today's Work Plan**.

No Shift Roster code may write to project Work Schedule tables.

## 2. Time handling

- Persist event timestamps in UTC.
- Persist new business-date fields using PostgreSQL `date`.
- Resolve business date through the effective Branch timezone.
- Snapshot timezone, scheduled start/end, break, net minutes, day type and day portion.
- Historical classification reads snapshots, not today's mutable Shift configuration.
- Use a shared time service; do not calculate business dates independently in controllers or UI.

## 3. Transaction boundaries

The following must commit in one Prisma transaction:

- Roster publication and audit.
- Published roster override and audit.
- Attendance check-in/check-out, calculation, exceptions and audit.
- Regularization approval, Attendance correction, exception resolution, audit and outbox.
- Leave reservation/consumption/reversal, aggregate balance update, audit and outbox.
- Overtime approval, settlement record, Comp-off creation when applicable, audit and outbox.
- Comp-off reservation/consumption/release, Leave state change, ledger, audit and outbox.
- Period transition and audit.

Call `AuditService.log` with `{ tx }`. A failed audit or related database write rolls back the business mutation.

Outbox processing and Redis/cache invalidation happen after commit. Redis is never the source of truth.

## 4. Concurrency

Use conditional mutations, optimistic versions and PostgreSQL transaction advisory locks.

Recommended lock keys:

- `shift-roster:<branchId>`
- `attendance:<employeeId>:<businessDate>`
- `attendance-period:<branchId>:<year>:<month>`
- `leave-balance:<employeeId>:<leaveTypeId>:<year>`
- `overtime:<attendanceId>`
- `comp-off:<employeeId>`

Acquire locks in this order when multiple resources are needed:

1. Company/Branch period.
2. Employee.
3. Business entity.

Generate a signed 64-bit advisory key from the stable resource string. The lock must be transaction-scoped and released automatically at transaction completion.

Optimistic mutation requests include `expectedVersion` where a user can keep an editing screen open. Stale versions return `409 STALE_TRANSITION`.

## 5. Tenant isolation

- Use the existing request authorization snapshot and `OrganizationScopeService`.
- Administrative list filters can only narrow active scope.
- A non-global session without active organization context receives no records.
- Self-service derives Employee from the authenticated session; it never accepts an authoritative employee ID.
- Related Company, Branch, Employee, Shift, Leave Type and policy identifiers are resolved through scoped assertions.
- Out-of-scope identifiers return `404`.
- Platform-level access does not silently bypass tenant context for business mutations.

## 6. Approval resolution

Workflow precedence:

1. Active Company workflow.
2. Active global workflow.

Required workflow codes:

- `LEAVE_APPROVAL`
- `ATTENDANCE_REGULARIZATION`
- `OVERTIME_APPROVAL`

Default approver resolution:

1. Active reporting manager in tenant scope.
2. Eligible HR Manager.
3. Company Administrator or Organization Owner.

Self-approval is forbidden. Only the current eligible approver may act.

## 7. Policy resolution

Attendance and Overtime policies use:

1. Active effective Branch policy.
2. Active effective Company policy.
3. Immutable application defaults.

The effective policy is the latest policy whose date range includes the business date. Overlapping active policies at one scope are rejected under a scope-specific transaction lock.

## 8. Scheduled processing

Use `@nestjs/schedule` and database locks.

- Attendance finalizer: every 15 minutes.
- Outbox processor: every 60 seconds.
- Comp-off expiry evaluator: hourly, comparing each Branch business date.
- Process bounded batches.
- Use deterministic idempotency keys.
- Recover abandoned outbox processing locks after a configured timeout.
- Multiple backend instances must produce the same result as one instance.

Add validated configuration:

```env
WORKFORCE_JOBS_ENABLED=false
WORKFORCE_JOB_BATCH_SIZE=100
ATTENDANCE_FINALIZER_INTERVAL_MINUTES=15
WORKFORCE_OUTBOX_INTERVAL_SECONDS=60
COMP_OFF_EXPIRY_INTERVAL_MINUTES=60
```

Production rollout begins with jobs disabled. Enable them only after migration and policy verification.

## 9. Logging and privacy

Logs may contain:

- Request ID.
- Safe event code.
- Entity type and ID.
- Tenant IDs already allowed by the logging policy.
- Outcome and duration.

Logs must not contain:

- Leave reason.
- Regularization reason.
- Medical or document content.
- Employee private notes.
- Approval remarks.
- Outbox payload.
- Email or notification body.

---

# Dependencies

## 1. Existing application dependencies

Retain and reuse:

- NestJS 11.
- Prisma and PostgreSQL.
- Existing Prisma and PostgreSQL pool lifecycle.
- Organization scope and authorization services.
- Business Audit service.
- Approval Workflow and Approval Transaction modules.
- Leave, Attendance, Holiday, Shift and Employee Shift modules.
- Employee Workspace and self-service context.
- Next.js, React, Tailwind and shadcn/Radix shared components.
- Existing API success and error contracts.

## 2. New dependency

Add the NestJS 11-compatible `@nestjs/schedule` package and commit only the selected pnpm lockfile changes for this work order.

Use pnpm for installation and validation. Do not regenerate both npm and pnpm lockfiles in the same implementation change.

## 3. Implementation dependencies

Work can be parallelized after the database contract is merged:

- Roster and Attendance depend on shared enums, migrations and time utilities.
- Overtime depends on roster-aware Attendance calculation.
- Comp-off depends on approved Overtime and Leave ledgering.
- Period closing depends on Leave, Attendance exception and Overtime status queries.
- Frontend feature work can begin from locked TypeScript contracts and mocked adapters, but it must integrate only after protected backend routes exist.

---

# Database Contract

Prisma field names below use application camelCase. Models continue mapping to plural snake-case PostgreSQL tables.

## 1. New enums

```text
DayPortion
  FULL_DAY
  FIRST_HALF
  SECOND_HALF

LeaveTypeCategory
  STANDARD
  UNPAID
  COMP_OFF

ShiftRosterStatus
  DRAFT
  PUBLISHED
  LOCKED
  ARCHIVED

ShiftRosterDayType
  WORKING
  WEEK_OFF
  HOLIDAY
  SCHEDULED_HALF_DAY

ShiftRosterEntrySource
  GENERATED
  MANUAL_OVERRIDE

AttendanceExceptionType
  LATE
  EARLY_DEPARTURE
  MISSING_CHECK_IN
  MISSING_CHECK_OUT
  INSUFFICIENT_HOURS
  UNSCHEDULED_WORK
  SHIFT_MISMATCH

AttendanceExceptionStatus
  OPEN
  SUBMITTED
  APPROVED
  REJECTED
  RESOLVED

AttendanceRegularizationStatus
  SUBMITTED
  APPROVED
  REJECTED
  CANCELLED

AttendancePeriodStatus
  OPEN
  REVIEW
  LOCKED
  PAYROLL_PENDING
  CLOSED

LeaveBalanceTransactionType
  OPENING_SNAPSHOT
  ENTITLEMENT
  ACCRUAL
  CARRY_FORWARD
  RESERVATION
  CONSUMPTION
  REVERSAL
  ADJUSTMENT
  EXPIRY

OvertimeRoundingMode
  DOWN

OvertimeSettlementType
  COMP_OFF
  PAYROLL_PENDING

OvertimeRequestStatus
  CALCULATED
  SUBMITTED
  APPROVED
  REJECTED
  SETTLED
  CANCELLED

CompOffCreditStatus
  AVAILABLE
  RESERVED
  USED
  EXPIRED
  REVOKED

CompOffAllocationStatus
  RESERVED
  CONSUMED
  RELEASED

OutboxEventStatus
  PENDING
  PROCESSING
  PROCESSED
  FAILED
```

New internal enums do not change existing public string values without an explicit mapper.

## 2. Existing model changes

### 2.1 `BranchWorkingDay`

Add:

| Field | Type | Rule |
|---|---|---|
| `dayPortion` | `DayPortion` | Required, default `FULL_DAY`; ignored when `isWorkingDay=false` |

Retain unique `(branchId, dayOfWeek)`.

### 2.2 `Holiday`

Add:

| Field | Type | Rule |
|---|---|---|
| `dayPortion` | `DayPortion` | Required, default `FULL_DAY` |

Keep `holidayType` string-compatible for the existing API. Service validation permits only `PUBLIC`, `COMPANY`, and `OBSERVED`.

Add a normalized date/applicability lookup index covering Company, Branch, Holiday date and active state.

### 2.3 `LeaveType`

Add:

| Field | Type | Rule |
|---|---|---|
| `category` | `LeaveTypeCategory` | Required, default `STANDARD` |

Add a partial unique SQL index allowing at most one active `COMP_OFF` Leave Type per Company.

### 2.4 `Attendance`

Add nullable historical schedule fields:

| Field | Type | Rule |
|---|---|---|
| `shiftRosterEntryId` | `String?` | Optional one-to-one roster-entry reference |
| `scheduledStartAt` | `DateTime?` | UTC snapshot |
| `scheduledEndAt` | `DateTime?` | UTC snapshot |
| `scheduledBreakMinutes` | `Int?` | Non-negative |
| `scheduledNetMinutes` | `Int?` | Non-negative |
| `scheduleTimezone` | `String?` | IANA timezone snapshot |
| `scheduleDayType` | `ShiftRosterDayType?` | Historical expected day type |
| `schedulePortion` | `DayPortion?` | Historical expected day portion |
| `classificationReason` | `String?` | Stable safe reason code, not sensitive free text |
| `finalizedAt` | `DateTime?` | Automated/manual finalization timestamp |

Rules:

- Unique `shiftRosterEntryId` when present.
- Keep existing unique `(employeeId, attendanceDate)`.
- Keep existing status/source/approval API values compatible.
- Do not backfill or recalculate historical rows.

### 2.5 `Shift`

Change only the Prisma/database default for new `graceInMinutes` values:

```text
15 -> 30
```

Do not update existing Shift rows. Roster-aware Attendance uses the resolved Attendance policy; the Shift field remains compatible with existing screens and non-roster paths.

### 2.6 `ApprovalWorkflow`

Change:

| Field | Change |
|---|---|
| `workflowCode` | Remove global uniqueness; retain required value and index |
| `scopeKey` | Add required unique server-generated string |

Scope-key format:

```text
GLOBAL:<WORKFLOW_CODE>
COMPANY:<COMPANY_UUID>:<WORKFLOW_CODE>
```

Add an index on `(companyId, workflowCode, isActive)`.

The API never accepts an arbitrary `scopeKey`; the service derives it.

### 2.7 Inverse relations

Add Prisma inverse relation collections to Company, Branch, Employee, User, Leave Request, Leave Type, Attendance and Approval Transaction as required.

Inverse relations do not add columns unless the new model owns a foreign key.

## 3. New models

### 3.1 `ShiftRoster` -> `shift_rosters`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `companyId` | UUID string | Required, restrict delete |
| `branchId` | UUID string | Required, restrict delete |
| `periodStart` | Date | Required |
| `periodEnd` | Date | Required |
| `version` | Int | Default 1, positive |
| `status` | `ShiftRosterStatus` | Default `DRAFT` |
| `createdByUserId` | UUID string | Required |
| `publishedByUserId` | UUID string? | Required when published |
| `publishedAt` | DateTime? | Required when published |
| `lockedByUserId` | UUID string? | Required when locked |
| `lockedAt` | DateTime? | Required when locked |
| `archivedByUserId` | UUID string? | Required when archived |
| `archivedAt` | DateTime? | Required when archived |
| `createdAt` | DateTime | Default now |
| `updatedAt` | DateTime | Updated automatically |

Constraints and indexes:

- `periodStart <= periodEnd`.
- Inclusive range is at most 62 days.
- Unique `(branchId, periodStart, periodEnd, version)`.
- Index `(companyId, branchId, status)`.
- Index `(branchId, periodStart, periodEnd)`.
- Overlapping Published/Locked ranges are rejected transactionally under the Branch advisory lock.

### 3.2 `ShiftRosterEntry` -> `shift_roster_entries`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `shiftRosterId` | UUID string | Required |
| `companyId` | UUID string | Required tenant snapshot |
| `branchId` | UUID string | Required tenant snapshot |
| `employeeId` | UUID string | Required |
| `workDate` | Date | Required Branch business date |
| `shiftId` | UUID string? | Optional for non-working entries |
| `scheduledStartAt` | DateTime? | Required for working entry |
| `scheduledEndAt` | DateTime? | Required for working entry |
| `breakMinutes` | Int | Default 0, non-negative |
| `scheduledNetMinutes` | Int | Default 0, non-negative |
| `timezone` | String | Required IANA snapshot |
| `dayType` | `ShiftRosterDayType` | Required |
| `dayPortion` | `DayPortion` | Default `FULL_DAY` |
| `source` | `ShiftRosterEntrySource` | Default `GENERATED` |
| `generationKey` | String | Deterministic generation identity |
| `createdAt` | DateTime | Default now |
| `updatedAt` | DateTime | Updated automatically |

Constraints and indexes:

- Unique `(shiftRosterId, employeeId, workDate)`.
- Unique `generationKey` within the roster.
- Working entries require start/end and `end > start`.
- Index `(employeeId, workDate)`.
- Index `(branchId, workDate, dayType)`.
- Index `(shiftRosterId, source)`.

### 3.3 `ShiftRosterOverride` -> `shift_roster_overrides`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `shiftRosterEntryId` | UUID string | Required |
| `companyId` | UUID string | Required |
| `branchId` | UUID string | Required |
| `employeeId` | UUID string | Required |
| `previousSnapshot` | JSON | Required, sanitized schedule fields only |
| `newSnapshot` | JSON | Required, sanitized schedule fields only |
| `reason` | String | Required |
| `changedByUserId` | UUID string | Required |
| `createdAt` | DateTime | Default now |

Rules:

- No `updatedAt`; records are immutable.
- Corrections create another row.
- Service rejects update/delete.
- Index entry/date and actor/date.

### 3.4 `AttendancePolicy` -> `attendance_policies`

| Field | Type | Default |
|---|---|---|
| `id` | UUID string | Primary key |
| `companyId` | UUID string | Required |
| `branchId` | UUID string? | Company-level when null |
| `effectiveFrom` | Date | Required |
| `effectiveTo` | Date? | Open-ended when null |
| `lateGraceMinutes` | Int | 30 |
| `earlyDepartureGraceMinutes` | Int | 15 |
| `fullDayThresholdPercent` | Int | 90 |
| `halfDayThresholdPercent` | Int | 50 |
| `regularizationWindowDays` | Int | 3 |
| `leaveBackdateWindowDays` | Int | 3 |
| `finalizationDelayMinutes` | Int | 180 |
| `maxOpenShiftMinutes` | Int | 1440 |
| `latePenaltyEnabled` | Boolean | false |
| `automaticLeaveDeductionEnabled` | Boolean | false |
| `isActive` | Boolean | true |
| lifecycle actor/timestamps | UUID/DateTime | Required where applicable |

Constraints:

- Effective end is null or not before start.
- Thresholds are between 0 and 100.
- Half-day threshold is lower than full-day threshold.
- Minute/day settings are non-negative.
- Partial unique index for Company scope and effective start.
- Partial unique index for Branch scope and effective start.
- Active effective ranges cannot overlap within one scope.

### 3.5 `AttendanceException` -> `attendance_exceptions`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `companyId` | UUID string | Required |
| `branchId` | UUID string | Required |
| `employeeId` | UUID string | Required |
| `attendanceId` | UUID string? | Optional |
| `shiftRosterEntryId` | UUID string? | Optional |
| `businessDate` | Date | Required |
| `type` | `AttendanceExceptionType` | Required |
| `status` | `AttendanceExceptionStatus` | Default `OPEN` |
| `dedupeKey` | String | Required unique |
| `details` | JSON? | Safe calculation codes/numbers only |
| `detectedAt` | DateTime | Required |
| `resolvedByUserId` | UUID string? | Required when resolved |
| `resolvedAt` | DateTime? | Required when resolved |
| `resolutionCode` | String? | Safe stable code |
| `createdAt` | DateTime | Default now |
| `updatedAt` | DateTime | Updated automatically |

Indexes:

- `(employeeId, businessDate, status)`.
- `(branchId, businessDate, type, status)`.
- `(attendanceId, type)`.

### 3.6 `AttendanceRegularization` -> `attendance_regularizations`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| tenant and employee references | UUID strings | Required |
| `attendanceId` | UUID string | Required |
| `attendanceExceptionId` | UUID string? | Optional |
| `proposedCheckInAt` | DateTime? | At least one proposed value required |
| `proposedCheckOutAt` | DateTime? | At least one proposed value required |
| `reason` | String | Required, sensitive |
| `status` | `AttendanceRegularizationStatus` | Default `SUBMITTED` |
| `approvalTransactionId` | UUID string? | Unique |
| `requestedByUserId` | UUID string | Required |
| `submittedAt` | DateTime | Required |
| `reviewedByUserId` | UUID string? | Required on decision |
| `reviewedAt` | DateTime? | Required on decision |
| `reviewerRemarks` | String? | Sensitive |
| timestamps | DateTime | Standard |

Add a partial unique index allowing one `SUBMITTED` regularization per Attendance.

### 3.7 `AttendancePeriod` -> `attendance_periods`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `companyId` | UUID string | Required |
| `branchId` | UUID string | Required |
| `periodYear` | Int | Required |
| `periodMonth` | Int | 1 through 12 |
| `periodStart` | Date | Required |
| `periodEnd` | Date | Required |
| `status` | `AttendancePeriodStatus` | Default `OPEN` |
| `version` | Int | Default 1 |
| review/lock/payroll/close actor and timestamp fields | UUID/DateTime? | Required by state |
| `reopenedByUserId` | UUID string? | Required when reopened |
| `reopenedAt` | DateTime? | Required when reopened |
| `reopenReason` | String? | Required when reopened |
| timestamps | DateTime | Standard |

Constraints:

- Unique `(branchId, periodYear, periodMonth)`.
- Month 1–12.
- Start not after end.
- Version positive.
- Index `(companyId, branchId, status)`.

### 3.8 `LeaveBalanceTransaction` -> `leave_balance_transactions`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `companyId` | UUID string | Required |
| `branchId` | UUID string? | Historical scope |
| `employeeId` | UUID string | Required |
| `leaveTypeId` | UUID string | Required |
| `leaveBalanceId` | UUID string | Required |
| `leaveRequestId` | UUID string? | Optional |
| `transactionType` | `LeaveBalanceTransactionType` | Required |
| `entitlementDelta` | Decimal(5,2) | Default 0 |
| `usedDelta` | Decimal(5,2) | Default 0 |
| `pendingDelta` | Decimal(5,2) | Default 0 |
| `balanceDelta` | Decimal(5,2) | Default 0 |
| `entitlementAfter` | Decimal(5,2) | Required |
| `usedAfter` | Decimal(5,2) | Required |
| `pendingAfter` | Decimal(5,2) | Required |
| `balanceAfter` | Decimal(5,2) | Required |
| `effectiveDate` | Date | Required |
| `referenceType` | String | Required stable type |
| `referenceId` | String | Required |
| `idempotencyKey` | String | Unique |
| `reason` | String? | Required for manual adjustment/reversal |
| `createdByUserId` | UUID string? | Null only for migration/system |
| `createdAt` | DateTime | Default now |

Rules:

- Immutable: no update or delete API.
- Add a database trigger preventing update/delete; corrections use reversal rows.
- Index balance/date, employee/type/date and reference.
- Aggregate `EmployeeLeaveBalance` is updated in the same transaction.

### 3.9 `OvertimePolicy` -> `overtime_policies`

| Field | Type | Default |
|---|---|---|
| tenant scope and effective dates | UUID/Date | Required |
| `minimumEligibleMinutes` | Int | 30 |
| `roundingMinutes` | Int | 15 |
| `roundingMode` | `OvertimeRoundingMode` | `DOWN` |
| `includeEarlyArrival` | Boolean | false |
| `requireScheduledMinutesFulfilled` | Boolean | true |
| `allowCompOff` | Boolean | true |
| `allowPayrollPending` | Boolean | true |
| `compOffHalfDayMinutes` | Int | 240 |
| `compOffFullDayMinutes` | Int | 480 |
| `maxCompOffDaysPerSource` | Decimal(5,2) | 1.00 |
| `compOffExpiryDays` | Int | 90 |
| `maxDailyMinutes` | Int? | No default cap |
| `maxMonthlyMinutes` | Int? | No default cap |
| `requiresApproval` | Boolean | true |
| `isActive` | Boolean | true |
| lifecycle actor/timestamps | UUID/DateTime | Standard |

Use the same effective-range and scope uniqueness rules as Attendance Policy.

### 3.10 `OvertimeRequest` -> `overtime_requests`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| tenant and employee references | UUID strings | Required |
| `attendanceId` | UUID string | Required |
| `overtimePolicyId` | UUID string? | Applied policy reference |
| `businessDate` | Date | Required |
| `rawMinutes` | Int | Non-negative |
| `eligibleMinutes` | Int | Non-negative |
| `requestedMinutes` | Int | Non-negative |
| `approvedMinutes` | Int? | Required on approval |
| `requestedSettlement` | `OvertimeSettlementType` | Required on submission |
| `approvedSettlement` | `OvertimeSettlementType?` | Required on approval |
| `status` | `OvertimeRequestStatus` | Default `CALCULATED` |
| `calculationSnapshot` | JSON | Safe policy and minute values |
| `reason` | String? | Sensitive employee text |
| `approvalTransactionId` | UUID string? | Unique |
| lifecycle actors/timestamps | UUID/DateTime? | Required by state |
| timestamps | DateTime | Standard |

Constraints:

- Minute values are non-negative.
- Approved minutes do not exceed eligible minutes.
- Comp-off approval does not exceed 480 minutes.
- Partial unique index permits one active request per Attendance for `CALCULATED`, `SUBMITTED`, `APPROVED`, or `SETTLED`.
- Index employee/date/status and Branch/status/date.

### 3.11 `CompOffCredit` -> `comp_off_credits`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| tenant and employee references | UUID strings | Required |
| `overtimeRequestId` | UUID string | Required unique |
| `leaveTypeId` | UUID string | Required Comp-off type |
| `sourceDate` | Date | Required |
| `earnedDays` | Decimal(5,2) | 0.5 or 1.0 |
| `availableDays` | Decimal(5,2) | Non-negative |
| `reservedDays` | Decimal(5,2) | Non-negative |
| `usedDays` | Decimal(5,2) | Non-negative |
| `expiresOn` | Date | Required |
| `status` | `CompOffCreditStatus` | Required |
| revoke actor/time/reason | UUID/DateTime/String? | Required for revoke |
| timestamps | DateTime | Standard |

Database check:

```text
availableDays + reservedDays + usedDays <= earnedDays
earnedDays > 0 and earnedDays <= 1
```

Index employee/status/expiry for FIFO selection.

### 3.12 `CompOffAllocation` -> `comp_off_allocations`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| tenant and employee references | UUID strings | Required |
| `compOffCreditId` | UUID string | Required |
| `leaveRequestId` | UUID string | Required |
| `allocatedDays` | Decimal(5,2) | Positive |
| `status` | `CompOffAllocationStatus` | Default `RESERVED` |
| reserved/consumed/released timestamps | DateTime? | Required by state |
| timestamps | DateTime | Standard |

Constraints:

- Unique `(compOffCreditId, leaveRequestId)`.
- Positive allocation.
- Credit and Leave Request must belong to the same employee and tenant.
- Index Leave Request/status and credit/status.

### 3.13 `UserNotification` -> `user_notifications`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| `userId` | UUID string | Required |
| `companyGroupId` | UUID string? | Tenant context |
| `companyId` | UUID string? | Tenant context |
| `branchId` | UUID string? | Tenant context |
| `eventCode` | String | Safe stable code |
| `entityType` | String? | Safe reference |
| `entityId` | String? | Safe reference |
| `title` | String | Sanitized |
| `message` | String | Sanitized; no sensitive reason/content |
| `dedupeKey` | String | Unique |
| `readAt` | DateTime? | Unread when null |
| `expiresAt` | DateTime? | Optional |
| `createdAt` | DateTime | Default now |

Indexes:

- `(userId, readAt, createdAt)`.
- `(companyId, eventCode, createdAt)`.

### 3.14 `OutboxEvent` -> `outbox_events`

| Field | Type | Rule |
|---|---|---|
| `id` | UUID string | Primary key |
| tenant references | UUID strings? | Context |
| `aggregateType` | String | Required |
| `aggregateId` | String | Required |
| `eventType` | String | Required |
| `payload` | JSON | Sanitized event data |
| `dedupeKey` | String | Unique |
| `status` | `OutboxEventStatus` | Default `PENDING` |
| `attempts` | Int | Default 0 |
| `availableAt` | DateTime | Default now |
| `lockedAt` | DateTime? | Processing lease |
| `processedAt` | DateTime? | Completion |
| `lastErrorCode` | String? | Safe error code only |
| `createdAt` | DateTime | Default now |
| `updatedAt` | DateTime | Updated automatically |

Indexes:

- `(status, availableAt)`.
- `(aggregateType, aggregateId, createdAt)`.

The outbox payload must not contain Leave reasons, regularization reasons, attachments or private employee content.

## 4. Referential behavior

- Use `ON DELETE RESTRICT` for workforce historical records.
- Do not cascade-delete published rosters, Attendance history, exceptions, regularizations, period history, Leave ledger, Overtime, Comp-off or approval data.
- Master records referenced by history are deactivated rather than deleted.
- Notification and outbox retention cleanup is an explicit maintenance operation, not a business-entity cascade.

## 5. Raw SQL constraints and partial indexes

The generated Prisma migration must be manually extended and reviewed for:

- Roster 62-day range check.
- Policy percentage and effective-date checks.
- Attendance schedule minute checks.
- Attendance period month and date checks.
- Overtime minute and Comp-off cap checks.
- Comp-off balance equation.
- Partial unique Company and Branch policy indexes.
- Partial unique submitted regularization index.
- Partial unique active Overtime request index.
- Partial unique active Company Comp-off Leave Type index.
- Immutable Leave ledger update/delete trigger.

All custom names must be stable and documented in the migration review.

## 6. Migration backfill

Execute within the reviewed migration transaction where PostgreSQL permits.

### 6.1 Portion defaults

- Existing Branch working days -> `FULL_DAY`.
- Existing Holidays -> `FULL_DAY`.

### 6.2 Leave categories

- Existing Leave Types -> `STANDARD`.
- Existing `COMP_OFF` code:
  - Preserve name, paid status, approval and half-day settings.
  - Set category to `COMP_OFF`.
- Company without a `COMP_OFF` code:
  - Create one active paid Leave Type.
  - Code `COMP_OFF`.
  - Name `Comp-off`.
  - Approval required.
  - Half-day allowed.
  - Carry-forward disabled.

Do not create Leave balances or credits during migration.

### 6.3 Shift default

- Change the default for new `graceInMinutes` to 30.
- Do not update existing Shift rows.

### 6.4 Approval workflow scope

- Global workflow -> `GLOBAL:<CODE>`.
- Company workflow -> `COMPANY:<companyId>:<CODE>`.
- Abort on duplicate computed keys.
- Drop old global `workflowCode` unique constraint only after successful backfill.
- Add required scoped indexes.

Create a missing global workflow definition for:

- Leave Approval.
- Attendance Regularization.
- Overtime Approval.

Do not replace an existing active Company workflow. Default first step uses reporting-manager resolution with HR/administrator fallback in the resolver.

### 6.5 Leave opening snapshots

For every existing active Employee Leave Balance, insert:

- Type `OPENING_SNAPSHOT`.
- Deltas equal to the current aggregate values from a zero ledger baseline.
- After-values equal to the current aggregate values.
- Effective date equal to the migration baseline date.
- Reference type `MIGRATION_BASELINE`.
- Reference ID equal to the balance ID.
- Idempotency key `OPENING:<balanceId>:V1`.
- System actor.

Preserve existing aggregate values even when legacy data requires later reconciliation. Do not silently correct historical balances in this migration.

### 6.6 Historical Attendance

- Leave new schedule fields null.
- Do not derive a roster entry.
- Do not recalculate status, late, early, worked or Overtime values.

## 7. Post-migration verification

Verify:

- All new tables and enum types exist in `dsp_pms`.
- All foreign keys target `dsp_pms`.
- Existing counts are unchanged except documented Comp-off/workflow configuration and opening snapshots.
- Opening snapshot count equals the pre-migration active Leave-balance count.
- Every active Company has exactly one active Comp-off Leave Type.
- Every Approval Workflow has one unique scope key.
- No historical Attendance row changed.
- All check constraints, partial indexes and the ledger trigger exist.
- Prisma migration status is fully applied.

---

# Backend Interfaces

## 1. Response compatibility

Successful responses remain:

```json
{
  "success": true,
  "data": {}
}
```

Errors retain existing fields and include stable `code` and `requestId`.

Out-of-scope resources return `404`. Invalid lifecycle or stale concurrency returns `409`.

## 2. Shift Roster routes

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/shift-rosters` | Scoped roster list |
| `POST` | `/shift-rosters` | Create Draft roster shell |
| `GET` | `/shift-rosters/:id` | Roster and entries |
| `PATCH` | `/shift-rosters/:id` | Update Draft metadata |
| `POST` | `/shift-rosters/generate` | Dry-run/apply generation |
| `POST` | `/shift-rosters/:id/publish` | Publish expected version |
| `POST` | `/shift-rosters/:id/lock` | Lock published roster |
| `POST` | `/shift-rosters/:id/archive` | Archive eligible roster |
| `POST` | `/shift-rosters/:id/overrides` | Correct published entry |

Generate request:

```json
{
  "branchId": "uuid",
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "shiftRosterId": "optional-draft-uuid",
  "dryRun": true
}
```

`dryRun` defaults to `true`.

Publish, lock and override requests include `expectedVersion`.

## 3. Attendance policy routes

- `GET /attendance-policies`
- `POST /attendance-policies`
- `GET /attendance-policies/:id`
- `PATCH /attendance-policies/:id`
- `DELETE /attendance-policies/:id` performs safe deactivation when unused.

The backend rejects overlapping active ranges.

## 4. Attendance exception and regularization routes

- `GET /attendance/exceptions`
- `GET /attendance/exceptions/:id`
- `GET /attendance/regularizations`
- `POST /attendance/regularizations`
- `GET /attendance/regularizations/:id`
- `POST /attendance/regularizations/:id/approve`
- `POST /attendance/regularizations/:id/reject`
- `POST /attendance/regularizations/:id/cancel`

Regularization request:

```json
{
  "attendanceId": "uuid",
  "attendanceExceptionId": "optional-uuid",
  "proposedCheckInAt": "optional-ISO-8601",
  "proposedCheckOutAt": "optional-ISO-8601",
  "reason": "required"
}
```

Administrative APIs may accept a scoped employee reference where necessary. `/me` APIs never do.

## 5. Attendance period routes

- `GET /attendance-periods`
- `POST /attendance-periods`
- `GET /attendance-periods/:id`
- `POST /attendance-periods/:id/review`
- `POST /attendance-periods/:id/lock`
- `POST /attendance-periods/:id/reopen`
- `POST /attendance-periods/:id/mark-payroll-pending`
- `POST /attendance-periods/:id/close`

Every transition includes `expectedVersion`. Reopen includes a mandatory reason.

## 6. Overtime routes

- `GET /overtime-policies`
- `POST /overtime-policies`
- `GET /overtime-policies/:id`
- `PATCH /overtime-policies/:id`
- `GET /overtime-requests`
- `GET /overtime-requests/:id`
- `POST /overtime-requests/:id/approve`
- `POST /overtime-requests/:id/reject`

Approval request:

```json
{
  "approvedMinutes": 480,
  "approvedSettlement": "COMP_OFF",
  "remarks": "optional",
  "expectedVersion": 1
}
```

The backend recalculates eligibility before approval.

## 7. Comp-off routes

- `GET /comp-off-credits`
- `GET /comp-off-credits/:id`
- `POST /comp-off-credits/:id/revoke`

Revoke requires a reason and is allowed only for unused/unreserved credit.

Credit reservation and consumption occur through the existing Leave workflow; clients do not create allocations directly.

## 8. Workforce calendar

`GET /workforce-calendar`

Filters:

- Date range.
- Branch.
- Department.
- Employee when permission permits.
- State.

The service returns privacy-filtered calendar days based on requester role and scope.

## 9. Self-service routes

- `GET /me/shift-roster`
- `GET /me/workforce-calendar`
- `GET /me/attendance/exceptions`
- `POST /me/attendance/regularizations`
- `GET /me/attendance/regularizations`
- `GET /me/overtime`
- `POST /me/overtime/:id/submit`
- `POST /me/overtime/:id/cancel`
- `GET /me/comp-off`

Overtime submission:

```json
{
  "requestedSettlement": "COMP_OFF",
  "requestedMinutes": 480,
  "reason": "optional"
}
```

The backend caps requested minutes at recalculated eligible minutes.

## 10. Stable error codes

Add:

- `ROSTER_PERIOD_TOO_LONG`
- `ROSTER_VALIDATION_FAILED`
- `ROSTER_OVERLAP`
- `ROSTER_LOCKED`
- `ROSTER_VERSION_MISMATCH`
- `SHIFT_ASSIGNMENT_REQUIRED`
- `BRANCH_CALENDAR_NOT_REVIEWED`
- `ATTENDANCE_PERIOD_LOCKED`
- `ATTENDANCE_EXCEPTION_NOT_OPEN`
- `REGULARIZATION_WINDOW_EXPIRED`
- `APPROVER_NOT_ELIGIBLE`
- `SELF_APPROVAL_FORBIDDEN`
- `OVERTIME_NOT_ELIGIBLE`
- `OVERTIME_SETTLEMENT_INVALID`
- `COMP_OFF_LIMIT_EXCEEDED`
- `COMP_OFF_BALANCE_INSUFFICIENT`
- `COMP_OFF_CREDIT_EXPIRED`
- `STALE_TRANSITION`

Do not expose foreign tenant existence through error differences.

---

# Permissions

Add permission catalog entries:

```text
hr.schedule.read
hr.schedule.manage
hr.schedule.publish
hr.holidays.read
hr.holidays.manage
hr.attendance.regularize
hr.attendance.lock
hr.overtime.read
hr.overtime.manage
hr.overtime.approve
hr.comp-off.read
hr.comp-off.manage
hr.calendar.read
hr.team.read
hr.team.approve
```

## Default role mapping

| Role | New access |
|---|---|
| Organization Owner | All listed permissions inside tenant context |
| Company Administrator | All listed permissions inside assigned Company scope |
| HR Manager | All workforce permissions inside assigned scope |
| Project Manager | `hr.team.read`, `hr.team.approve`, scoped calendar/read access |
| Employee | Self-service routes through existing self permissions |

Rules:

- Permission bootstrap is idempotent.
- Custom roles receive no automatic grant.
- Route policy tests must prove every new administrative route has an explicit permission.
- Navigation visibility is not a security boundary.

---

# Work Packages

## WP-00 — Baseline and contract

1. Pull and record the integration commit.
2. Run current backend and frontend quality gates.
3. Capture database preflight evidence.
4. Confirm Branch timezone and working-calendar readiness.
5. Freeze TypeScript constants, DTO contracts and error codes.
6. Create the implementation branch.

Acceptance:

- Clean baseline recorded.
- No unrelated dirty files.
- Database target is disposable.

## WP-01 — Prisma migration and policy foundation

1. Add enums and model relations.
2. Generate create-only migration against disposable PostgreSQL.
3. Add reviewed SQL checks, partial indexes and immutable-ledger trigger.
4. Implement backfill.
5. Add Attendance and Overtime policy resolvers.
6. Add migration verification tests/scripts.

Acceptance:

- Empty and production-shaped disposable migrations pass.
- Historical Attendance is unchanged.
- Backfill reconciles to captured counts.

## WP-02 — Scope, permissions and approval resolution

1. Add permission catalog entries and tenant-role mappings.
2. Extend organization-scoped assertions for new models.
3. Add workflow `scopeKey` generation.
4. Implement Company-to-global resolution.
5. Implement reporting-manager, HR and administrator fallback.
6. Enforce no self-approval and current-step ownership.

Acceptance:

- Route matrix passes.
- Cross-tenant IDs return `404`.
- Repeated approval returns `409`.

## WP-03 — Shift Roster

1. Add roster repository/service/controller.
2. Implement 62-day validation.
3. Build generation resolver from calendar, Shift and employee lifecycle data.
4. Add dry-run reconciliation result.
5. Preserve manual overrides during regeneration.
6. Add publish, override, lock and archive transitions.
7. Add Branch advisory lock and optimistic version handling.
8. Write transactional audits and outbox events.

Acceptance:

- One concurrent publish wins.
- No published overlap.
- Locked roster is immutable.

## WP-04 — Roster-aware Attendance

1. Add shared Branch-time service.
2. Resolve and snapshot roster at check-in.
3. Recalculate check-out against adjusted scheduled minutes.
4. Implement 30-minute late boundary.
5. Implement 90%/50% day thresholds.
6. Create idempotent exceptions.
7. Implement finalizer.
8. Add regularization lifecycle.
9. Add Attendance periods and blockers.
10. Preserve existing API compatibility.

Acceptance:

- Boundary, overnight, unscheduled and missing-punch tests pass.
- Audit failure rolls back Attendance mutation.
- Locked periods reject modification.

## WP-05 — Leave ledger

1. Add immutable transaction writer.
2. Update balance generation to write ledger events.
3. Update submit to reserve.
4. Update approve to consume.
5. Update reject/cancel to release or reverse.
6. Add adjustment and expiry entries where applicable.
7. Reconcile aggregate balance after every mutation.
8. Integrate half-day schedule adjustment.
9. Preserve existing Leave response fields.

Acceptance:

- Ledger equals aggregate balance.
- Concurrent approval cannot consume twice.
- Audit failure rolls back balance and request.

## WP-06 — Overtime and Comp-off

1. Add Overtime policy resolver.
2. Calculate raw and eligible minutes from Attendance snapshots.
3. Exclude early arrival and makeup time.
4. Add employee submission and cancellation.
5. Add approval/rejection with fresh eligibility validation.
6. Create Comp-off credit transactionally.
7. Add FIFO reservation, consumption and release.
8. Add hourly expiry evaluator.
9. Add revoke workflow.
10. Preserve Payroll Pending data without monetary calculation.

Acceptance:

- 29/30/44/45-minute boundaries pass.
- One concurrent approval/credit creation wins.
- FIFO, expiry and cancellation behavior reconcile.

## WP-07 — Notifications, outbox and scheduled jobs

1. Add persistent notification service.
2. Add transactional outbox writer.
3. Add bounded multi-instance-safe processor.
4. Replace the Employee Workspace notification stub with scoped persisted reads.
5. Add read/unread behavior.
6. Add job health metrics and safe logs.
7. Add environment validation.

Acceptance:

- Retried jobs do not duplicate notifications.
- Sensitive fields are absent from logs and payloads.
- Workers can be disabled safely.

## WP-08 — Calendar and self-service

1. Add privacy-aware calendar assembler.
2. Add self-service roster, calendar, exception, regularization, Overtime and Comp-off endpoints.
3. Derive Employee exclusively from authenticated session.
4. Add reporting-team scope for Project Managers.
5. Update Employee Workspace response without breaking existing fields.

Acceptance:

- Employee cannot access another employee.
- Project Manager sees only authorized reporting employees.
- HR sees only active tenant scope.

## WP-09 — Frontend

1. Add Work Schedule roster page.
2. Add dry-run, override, publish and lock sheets/dialogs.
3. Expand Attendance into Daily, Exceptions and Period Closing.
4. Add Overtime and Comp-off workspaces.
5. Add Holiday and Leave Calendar screens.
6. Complete shared calendar components.
7. Update My Workspace with Today's Shift and Today's Work Plan.
8. Add loading, error, empty and unavailable states.
9. Add permission-controlled navigation.

Acceptance:

- No fake actions or data.
- All forms use right-side sheets where appropriate.
- Responsive and keyboard tests pass.

## WP-10 — Integration, UAT and release

1. Run complete automated quality gates.
2. Run disposable-database tenant/concurrency integration tests.
3. Execute manual workflow UAT.
4. Capture migration and backup evidence.
5. Deploy with jobs disabled.
6. Configure and verify policies.
7. Enable jobs.
8. Complete technical and business sign-off.

---

# Frontend Contract

## 1. Routes

Add:

```text
/hr/work-schedule
/hr/attendance
/hr/attendance/exceptions
/hr/attendance/periods
/hr/overtime
/hr/leave/calendar
/hr/leave/holidays
/hr/leave/comp-off
```

Retain:

```text
/my-workspace
/hr/leave
/hr/leave/types
/hr/leave/policies
/hr/leave/balances
/administration/shifts
```

## 2. Shared UI patterns

- Existing Warm Coral + Teal foundation.
- `WorkspaceShell` for page hierarchy.
- FormSheet/right-side drawer for create/edit/review.
- Confirmation dialog for publish, lock, reject, revoke and reopen.
- Shared DataTable for list screens.
- Shared status badges with semantic tones.
- Month/week/list calendar with keyboard navigation.
- Skeleton, retry, empty and blocked states.

## 3. Roster UI

Display:

- Branch and date filters.
- Roster status and version.
- Month calendar.
- Employee rows or grouped view.
- Validation counts.
- Missing Shift warnings.
- Dry-run comparison.
- Published override history.

Hide publish and lock actions without permission.

## 4. Attendance UI

Daily view displays:

- Employee.
- Scheduled start/end.
- Actual check-in/out.
- Worked minutes.
- Late and early minutes.
- Status.
- Exception count.

Exception review uses a right-side sheet with privacy-safe details and the regularization workflow.

Period Closing displays blockers before allowing transition.

## 5. My Workspace

Display separately:

- Today's Shift.
- Today's Work Plan.
- Check-in/check-out state.
- Personal Attendance exceptions.
- Leave balances and requests.
- Overtime eligibility and requests.
- Comp-off available/reserved/expiring balance.
- Personal calendar.

Do not add Message, Email, Chat, Upgrade or other non-functional actions.

---

# Files to Create

The implementation should create coherent feature folders rather than scattered helpers.

## Backend

- `src/modules/shift-roster/`
- `src/modules/attendance-policy/`
- `src/modules/attendance-exception/`
- `src/modules/attendance-regularization/`
- `src/modules/attendance-period/`
- `src/modules/leave-balance-ledger/`
- `src/modules/overtime-policy/`
- `src/modules/overtime-request/`
- `src/modules/comp-off/`
- `src/modules/workforce-calendar/`
- `src/modules/notification/`
- `src/modules/outbox/`
- `src/modules/workforce-jobs/`
- Shared workforce time, locking, idempotency and policy-resolution utilities.
- Focused unit and integration specifications for every new service.

## Frontend

- `features/shift-roster/`
- `features/attendance-exception/`
- `features/attendance-period/`
- `features/overtime/`
- `features/comp-off/`
- `features/workforce-calendar/`
- Route pages listed in the Frontend Contract.

## Database

- One Prisma migration directory ending in `_workforce_time_management_foundation`.
- Disposable-database migration verification fixture/script if the repository's test architecture requires it.

---

# Files to Modify

Expected high-impact modifications:

- `backend/prisma/schema.prisma`
- Backend `package.json` and pnpm lockfile for `@nestjs/schedule`.
- Backend application module.
- Typed environment validation and `.env.example`.
- Existing Attendance service/controller/module and tests.
- Existing Leave Request, Leave Balance, Leave Policy and Leave Type services/tests.
- Existing Holiday, Shift and Employee Shift services/tests.
- Existing Approval Workflow/Transaction services and tests.
- Existing Organization Scope and permission catalog/bootstrap.
- Existing self-service and Employee Workspace modules.
- Frontend navigation metadata.
- Existing Attendance, Leave and My Workspace features.
- Shared calendar component files.
- Security route matrix and production UAT documentation after implementation.

Do not modify:

- Existing project `WorkSchedule` schema or business behavior.
- Authentication/session semantics.
- Company Group -> Company -> Branch relationships.
- Public registration.
- Payroll calculation tables or services for monetary processing.

---

# Commands

Command examples use PowerShell and pnpm.

## 1. Baseline

```powershell
cd C:\DataScape\HRMS\ERP
git status --short
git rev-parse HEAD

cd backend
pnpm.cmd install --frozen-lockfile
pnpm.cmd exec prisma validate
pnpm.cmd run lint:check
pnpm.cmd run build
pnpm.cmd test

cd ..\frontend
pnpm.cmd install --frozen-lockfile
pnpm.cmd lint
pnpm.cmd exec tsc --noEmit
pnpm.cmd build
```

## 2. Create-only migration

Use a disposable local PostgreSQL database configured with schema `dsp_pms`.

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma migrate dev --create-only --name workforce_time_management_foundation
```

Review and extend the generated SQL before applying it anywhere.

## 3. Disposable migration validation

```powershell
pnpm.cmd exec prisma migrate reset
pnpm.cmd exec prisma migrate status
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
```

`migrate reset` is permitted only against the disposable database whose identity has been verified.

## 4. Final quality gates

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd exec prisma validate
pnpm.cmd exec prisma generate
pnpm.cmd run lint:check
pnpm.cmd run build
pnpm.cmd test

cd ..\frontend
pnpm.cmd lint
pnpm.cmd exec tsc --noEmit
pnpm.cmd build

cd ..
git diff --check
git status --short
```

## 5. Controlled deployment

After backup, approval and environment verification:

```powershell
cd C:\DataScape\HRMS\ERP\backend
pnpm.cmd exec prisma migrate status
pnpm.cmd exec prisma migrate deploy
pnpm.cmd exec prisma migrate status
```

Do not use `migrate dev`, `migrate reset` or destructive test suites against AWS RDS.

---

# Validation

## 1. Unit tests

### Roster

- Maximum period: 62 days accepted; 63 rejected.
- Dry-run performs no writes.
- Apply creates only Draft entries.
- Regeneration preserves manual overrides.
- Holiday and weekly-off resolution.
- Employee joining, transfer and separation boundaries.
- Overnight Shift timestamps.
- Concurrent publish: one winner.
- Locked roster cannot change.

### Attendance

- Check-in at 29:59, 30:00 and 30:01 after start.
- Full Day at exactly 90%.
- Half Day at exactly 50%.
- Below 50% is Absent.
- Approved half-day Leave adjusts expected minutes.
- Early arrival is not Overtime.
- Late makeup time is not Overtime.
- Missing check-out remains null.
- Job retry does not duplicate Attendance or exceptions.
- Locked period rejects mutation.

### Leave ledger

- Opening Snapshot matches legacy aggregate.
- Submit reserves exactly once.
- Approval consumes reservation exactly once.
- Rejection/cancellation releases.
- Approved cancellation reverses.
- Adjustment requires reason.
- Ledger trigger blocks update/delete.
- Aggregate and ledger reconcile.
- Audit failure rolls back request and balance.

### Overtime

- 29 -> 0.
- 30 -> 30.
- 44 -> 30.
- 45 -> 45.
- Holiday/week-off calculation.
- Normal-day scheduled-minutes prerequisite.
- Comp-off approval maximum 480.
- Payroll Pending retains approved minutes.
- Concurrent approval has one winner.

### Comp-off

- 240 -> 0.5 day.
- 480 -> 1 day.
- Greater than 480 cannot settle as Comp-off.
- FIFO by earliest expiry.
- Concurrent reservation cannot overdraw.
- Rejection/cancellation releases.
- Approved cancellation restores only unexpired credit.
- Expiry is Branch-date aware and idempotent.
- Revoke requires unused credit and reason.

### Approval

- Company workflow precedes global.
- Reporting manager resolves.
- HR fallback resolves.
- Administrator/owner fallback resolves.
- Self-approval rejected.
- Inactive/out-of-scope approver rejected.
- Repeated decision returns `409`.

## 2. Integration tests

Run only against disposable PostgreSQL.

Create:

- Two Company Groups.
- At least two Companies.
- Multiple Branches.
- Employees and managers in each scope.
- Shifts, working days and Holidays.
- Company and Branch policies.

Test list, detail, create, update, approval and closing for:

- Company Group isolation.
- Company isolation.
- Branch isolation.
- Reporting-team isolation.
- Employee self isolation.
- Client filter narrowing.
- Missing organization context.

Test database concurrency with separate connections for:

- Roster publication.
- Attendance finalization.
- Regularization approval.
- Leave approval.
- Overtime approval.
- Comp-off reservation.
- Attendance period lock.

## 3. Migration tests

- Empty database migration.
- Production-shaped disposable snapshot migration.
- Scope-key duplicate guard.
- Comp-off Leave Type idempotency.
- Opening Snapshot idempotency.
- Historical Attendance checksum before/after.
- Partial index enforcement.
- Check-constraint enforcement.
- Ledger immutability trigger.

## 4. API contract tests

- Existing success envelope unchanged.
- Existing error fields remain.
- New error codes and request IDs present.
- Out-of-scope returns `404`.
- Stale transition returns `409`.
- Self-service ignores/rejects client employee IDs.
- Sensitive text absent from logs and error responses.

## 5. Frontend tests

Verify at:

- 1440px.
- 1024px.
- 768px.
- 390px.

Test:

- Work Schedule month view.
- Dry-run and apply.
- Override, publish and lock.
- Attendance Daily and Exceptions.
- Regularization review.
- Period blocker navigation.
- Leave Calendar and Holidays.
- Overtime approval.
- Comp-off balance and expiry.
- My Workspace.
- Loading, error, empty and unavailable states.
- Keyboard navigation and focus restoration.
- Screen-reader labels.
- No body-level horizontal overflow.

## 6. Operational validation

- Jobs disabled at startup when configured false.
- Multi-instance job execution is idempotent.
- Job batch size is respected.
- Failed outbox events retry without duplicate notification.
- Health/readiness reflects required database availability.
- Logs remain structured in production.
- No sensitive workforce content appears in stdout.

## 7. UAT workflows

UAT must complete:

1. Configure Branch calendar.
2. Configure Shifts and employee assignments.
3. Dry-run and publish a roster.
4. Employee check-in and check-out.
5. Late, early and missing-punch scenarios.
6. Employee regularization and manager approval.
7. Full-day and half-day Leave.
8. Leave rejection and cancellation.
9. Holiday and weekly-off work.
10. Overtime submission and approval.
11. Comp-off generation, reservation and use.
12. Attendance period review, blocker resolution and lock.
13. Payroll Pending handoff verification.
14. Tenant, manager-team and self-service isolation.

Production approval requires technical sign-off and separate business UAT sign-off.

---

# Rollout

## 1. Pre-deployment

1. Merge only after all quality gates pass.
2. Capture reviewed migration SQL.
3. Capture database backup evidence.
4. Confirm target database and `dsp_pms`.
5. Confirm Branch timezone and calendar readiness.
6. Set `WORKFORCE_JOBS_ENABLED=false`.
7. Stop conflicting migration/deployment activity.

## 2. Deployment

1. Apply the reviewed migration.
2. Verify migration status.
3. Verify backfill counts and indexes.
4. Deploy backend with workers disabled.
5. Deploy frontend with permission-controlled navigation.
6. Verify Company/Branch policies.
7. Verify global and Company approval workflows.
8. Configure and dry-run the first roster.
9. Publish a controlled pilot roster.
10. Enable workforce jobs.

## 3. Post-deployment smoke

- Roster list, dry-run and publish.
- Employee Shift display.
- Check-in/check-out.
- Attendance exception.
- Regularization approval.
- Leave balance reconciliation.
- Overtime calculation.
- Comp-off credit.
- Workforce calendar privacy.
- Period review blockers.
- Request-ID and audit correlation.
- Job idempotency and safe logging.

## 4. Initial rollout boundary

Activate one reviewed Company/Branch pilot first.

Do not activate payroll calculation. Keep approved Overtime in `PAYROLL_PENDING` until the later payroll work order is approved.

---

# Rollback

## 1. Before business data exists

If the migration is applied but no new workforce transactions exist:

- Disable workers.
- Roll back application deployment.
- Use a separately reviewed down script only after verifying new tables are empty.
- Restore the previous Approval Workflow constraint only when scope data permits.

## 2. After business data exists

Do not drop:

- Roster history.
- Attendance snapshots or exceptions.
- Leave ledger.
- Overtime requests.
- Comp-off credits or allocations.
- Approval, audit, notification or outbox history.

Instead:

1. Disable workforce jobs.
2. Hide new navigation.
3. Roll back compatible application code.
4. Preserve database records.
5. Issue a forward-fix migration.

Restore from backup only for migration corruption or an unrecoverable deployment failure.

## 3. Rollback verification

- Existing Login and authorization operate.
- Existing Leave and Attendance routes remain available.
- Existing Work Plan is unchanged.
- No ledger or audit history is lost.
- Job processes are stopped.
- Incident and recovery evidence is recorded.

---

# Closure Report

The implementation owner must complete this section in the delivery pull request or release record.

## 1. Required evidence

- Final Git commit.
- Migration directory and checksum.
- Reviewed migration SQL.
- Prisma validation output.
- Migration status output.
- Empty-database migration result.
- Production-shaped disposable migration result.
- Pre/post count reconciliation.
- Backend lint, build and complete Jest output.
- Frontend lint, TypeScript and clean build output.
- Tenant-isolation integration result.
- Concurrency test result.
- Responsive/accessibility evidence.
- Backup evidence.
- Technical sign-off.
- Business UAT sign-off.

## 2. Closure checklist

- [ ] Work Plan schema and behavior are unchanged.
- [ ] Shift Roster is implemented separately.
- [ ] All objects exist under `dsp_pms`.
- [ ] Existing Attendance history is unchanged.
- [ ] Leave ledger reconciles with aggregate balances.
- [ ] Approval Workflow scope resolution passes.
- [ ] Tenant isolation passes.
- [ ] Concurrency tests pass.
- [ ] Scheduled workers are idempotent.
- [ ] Logs contain no sensitive workforce content.
- [ ] Backend quality gates pass.
- [ ] Frontend quality gates pass.
- [ ] Manual UAT passes.
- [ ] Payroll remains deferred.

## 3. Deferred follow-up work

- Payroll calculation and payslips.
- Advanced workforce and statutory reporting.
- Country-specific statutory packages.
- Rotating roster templates.
- Shift swaps.
- Biometric/GPS/geofenced Attendance.
- Optional Holidays.
- Approval delegation and escalation.
- Workforce email notifications.
- Government Holiday imports.

## Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 1.0 | 2026-08-05 | APPROVED BASELINE | Initial detailed workforce engineering work order |
