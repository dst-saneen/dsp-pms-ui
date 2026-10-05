# Workforce Time Management Plan

- **Status:** APPROVED BASELINE
- **Version:** 1.0
- **Baseline date:** 2026-08-05
- **Product:** Group ERP
- **Domain:** Human Resources
- **Engineering work order:** `docs/development/workforce-time-management-development-work-order.md`

## Document purpose

This document is the approved product and workflow baseline for workforce scheduling, attendance, holidays, leave, overtime, Comp-off and monthly attendance closing.

It records the decisions that engineering, QA and UAT must follow. It does not prove that a feature is already implemented. Current implementation status must always be verified from source code, migrations and tests.

## Change control

The decisions in this document are locked for version 1.0.

A future change must:

1. Be recorded in the decision register.
2. State the business reason.
3. Identify database, API, UI, permission, migration and historical-data impact.
4. Define whether the change applies only to future periods or also to unlocked history.
5. Receive product and engineering approval before implementation.

Client-adjustable policy values can be changed through configuration without rewriting this baseline. Statutory, payroll and country-specific rules require client confirmation before production activation.

---

## 1. Outcomes

The completed workforce module must allow:

- HR to define working calendars, shifts and employee schedules.
- Employees to view their schedule and record attendance.
- The system to classify attendance consistently using Branch-local business dates.
- Employees and HR to correct attendance through an auditable regularization flow.
- Employees to request leave using accurate balances and working-day calculations.
- Managers and HR to approve leave, regularization and overtime within tenant scope.
- Approved overtime to become either a Comp-off credit or a future payroll input.
- HR to review and lock monthly attendance before payroll processing.
- Employees, managers and HR to view privacy-safe workforce calendars.

Payroll calculation and advanced reporting are deliberately deferred until these workflows pass technical testing and business UAT.

---

## 2. Terminology and ownership

### 2.1 Work Plan

The existing `WorkSchedule` and `WorkScheduleItem` models belong to project and task planning.

- UI label: **Work Plan**
- Purpose: tasks, planned work, project assignments and employee work sessions.
- Existing APIs and data remain unchanged.

### 2.2 Shift Roster

The new workforce schedule is internally named **Shift Roster**.

- HR menu label may be **Work Schedule**.
- HR route must be separate from the existing project Work Plan route.
- Backend models and APIs use `ShiftRoster` and `/shift-rosters`.
- Purpose: expected workdays, shift times, weekly off-days, holidays and scheduled half-days.

The two concepts must never share tables or business rules.

### 2.3 Time and date rules

- Store timestamps in UTC.
- Resolve business dates using the employee's effective Branch timezone.
- Snapshot the applied timezone and scheduled times on the roster and Attendance.
- Do not reinterpret historical Attendance when a Branch timezone, Shift or policy later changes.
- Date-only business fields must not be calculated using the backend server timezone.

---

## 3. Activation prerequisites

A Branch must not activate advanced workforce processing until:

1. Its timezone is valid and reviewed.
2. Seven working-day records exist.
3. Working and non-working days are confirmed.
4. Active employees have valid Company and Branch assignments.
5. Required Shifts exist.
6. Effective Employee Shift assignments are valid.
7. Holiday applicability is reviewed.
8. Attendance and Overtime policies are reviewed.
9. Approval workflows have eligible approvers.
10. The first Shift Roster passes dry-run validation.

The application may use immutable system defaults while policies are being configured, but the production activation checklist must still be completed.

---

## 4. Work Schedule and Shift Roster

### 4.1 Roster period

- A roster belongs to one Company and one Branch.
- A roster covers no more than 62 calendar days.
- The normal UI defaults to one calendar month.
- Roster periods may cross a month boundary but must not overlap another published or locked roster for the same Branch.

### 4.2 Roster lifecycle

```text
DRAFT -> PUBLISHED -> LOCKED -> ARCHIVED
```

- `DRAFT`: editable and regeneratable.
- `PUBLISHED`: visible to employees; corrections require an override reason.
- `LOCKED`: immutable operational history.
- `ARCHIVED`: retained history that is no longer the active schedule.

Invalid backward transitions return a conflict response. A locked roster is never silently unlocked or edited.

### 4.3 Generation inputs

Roster generation uses:

- Branch working days and day portions.
- Active Company Shifts.
- Effective Employee Shift assignments.
- Company and Branch Holidays.
- Employee joining date.
- Effective Company and Branch transfer dates.
- Employee separation date.
- Existing manual roster overrides.

### 4.4 Dry-run

Generation starts with `dryRun=true`.

Dry-run returns:

- Employees included and excluded.
- Missing or overlapping Employee Shift assignments.
- Invalid Shift times.
- Missing or unreviewed Branch calendar information.
- Holiday conflicts.
- Employee assignment conflicts.
- Entries that would be created, updated, retained or skipped.

Dry-run does not write roster records or audits.

### 4.5 Apply and regeneration

- Apply is allowed only to a Draft roster.
- Regeneration updates generated entries.
- Manual overrides are retained.
- The user sees a reconciliation summary before applying.
- Publication revalidates the complete period.
- Publication is atomic and protected by a Branch-scoped database lock.
- Exactly one concurrent publication may succeed.

### 4.6 Published corrections

A published entry can be changed only through an override containing:

- Previous schedule snapshot.
- New schedule snapshot.
- Mandatory reason.
- Acting user.
- Timestamp.

Locked entries cannot be overridden.

### 4.7 Deferred scheduling features

The following remain outside version 1:

- Rotating roster templates.
- Employee shift-swap requests.
- Open-shift bidding.
- Automated optimization.
- Biometric-device scheduling.

---

## 5. Holiday calendar

### 5.1 Holiday types

Supported types:

- `PUBLIC`
- `COMPANY`
- `OBSERVED`

Supported portions:

- `FULL_DAY`
- `FIRST_HALF`
- `SECOND_HALF`

### 5.2 Applicability

- A Company Holiday applies to every Branch in that Company unless Branch-specific behavior is configured later.
- A Branch Holiday applies only to that Branch.
- Inactive Holidays are ignored.
- A Branch-specific Holiday takes precedence when resolving the Branch calendar.

### 5.3 Changes and history

- Authorized HR users manage Holidays directly.
- A separate Holiday approval workflow is not required in version 1.
- Changes affect open future or current periods immediately.
- Locked Attendance periods and locked rosters are never recalculated automatically.
- Any authorized historical correction requires reopening the relevant period and leaves an audit trail.

### 5.4 Deferred holiday features

- Optional employee-selected holidays.
- Imported government calendars.
- Country-specific statutory packs.
- Automatic holiday substitution rules.

---

## 6. Attendance

### 6.1 Schedule resolution

For an employee and business date, the system resolves:

1. Published or locked Shift Roster entry.
2. Its snapshotted Shift times, break, timezone, day type and day portion.
3. Approved Leave that overlaps the date.
4. Applicable Holiday.
5. Resolved Attendance policy.

Check-in without a published roster is permitted for operational continuity but creates an `UNSCHEDULED_WORK` exception.

### 6.2 Late rule

The approved default late grace is **30 minutes**.

| Check-in boundary | Classification |
|---|---|
| Before scheduled start | On Time |
| Scheduled start through +30:00 | On Time |
| Later than +30:00 | Late |

When an employee is Late, `lateMinutes` records the full elapsed difference from scheduled start, not only the minutes beyond the grace period.

Example for a 09:00 start:

- 09:29:59: On Time.
- 09:30:00: On Time.
- 09:30:01: Late.
- A 09:31 whole-minute result records 31 late minutes under the minute-based calculation.

### 6.3 Early departure

- Compare check-out with the roster's scheduled end.
- Apply the configured early-departure grace.
- Record the full early difference after the grace boundary is crossed.
- An approved half-day arrangement first reduces the expected schedule.

### 6.4 Worked-time calculation

Net worked minutes are calculated server-side from valid check-in and check-out timestamps less applicable breaks.

- Client-supplied worked hours are never authoritative.
- Overnight shifts may cross midnight.
- An open attendance session cannot exceed 24 hours.
- Missing check-out is not replaced with scheduled end time.
- Invalid negative or reversed time ranges are rejected.

### 6.5 Day classification

Use adjusted scheduled net minutes after accounting for:

- Scheduled half-day.
- Approved half-day Leave.
- Half-day Holiday.
- Approved Comp-off Leave.

| Worked percentage of adjusted schedule | Attendance result |
|---|---|
| At least 90% | `PRESENT` |
| At least 50% and below 90% | `HALF_DAY` |
| Below 50% | `ABSENT` |

An employee who works the complete remaining portion of an approved half-day Leave can be `PRESENT` for the adjusted expected work. The workforce calendar shows the combined Leave and Attendance state.

### 6.6 Exceptions

The system creates explicit exceptions for:

- `LATE`
- `EARLY_DEPARTURE`
- `MISSING_CHECK_IN`
- `MISSING_CHECK_OUT`
- `INSUFFICIENT_HOURS`
- `UNSCHEDULED_WORK`
- `SHIFT_MISMATCH`

Exception creation is idempotent. Scheduled processing must not create duplicates when a job is retried.

### 6.7 Attendance finalization

- Finalization becomes eligible 180 minutes after scheduled end.
- The finalizer runs repeatedly in bounded batches.
- It creates idempotent daily results for Leave, Holiday, Week Off or Absent cases.
- It creates missing-punch exceptions where applicable.
- It never fabricates check-in or check-out timestamps.
- A row already finalized by another instance is skipped safely.

### 6.8 Attendance policy precedence

1. Effective Branch policy.
2. Effective Company policy.
3. Immutable system default.

The selected policy is snapshotted or traceable for historical explanation.

---

## 7. Attendance regularization

### 7.1 Employee flow

1. Employee opens an Attendance exception.
2. Employee enters proposed check-in and/or check-out.
3. Employee provides a mandatory reason.
4. The system validates the three-calendar-day submission window.
5. The request is submitted to the resolved approver.
6. Approval corrects Attendance and resolves related exceptions atomically.
7. Rejection retains the original Attendance and records the reviewer decision.

### 7.2 HR flow

- HR can correct older open-period Attendance.
- A reason is mandatory.
- HR cannot mutate a locked period without reopening it.
- Direct HR correction and approval both create a business audit.

### 7.3 Approval safeguards

- Self-approval is forbidden.
- Only the current eligible approver can act.
- Repeated or concurrent actions return `409`.
- Approval, Attendance update, exception resolution, audit and notification commit in one transaction.

---

## 8. Leave

### 8.1 Lifecycle

```text
DRAFT -> SUBMITTED -> APPROVED
                   -> REJECTED

DRAFT/SUBMITTED/APPROVED -> CANCELLED
```

Transition permissions and balance effects depend on the current state. Invalid or stale transitions return `409`.

### 8.2 Day calculation

Leave days are calculated server-side using:

- Employee Branch timezone.
- Branch working days.
- Applicable Holidays.
- Requested full-day or half-day portion.

The client cannot submit an authoritative requested-day total.

### 8.3 Rules

- Full-day Attendance and full-day Leave cannot overlap.
- Half-day Leave may coexist with Attendance for the remaining portion.
- Employee backdating is limited to three calendar days.
- HR can process older dates with a mandatory reason.
- Cross-year requests are rejected and must be split.
- Sandwich Leave is disabled.
- Negative balance is disabled unless an active existing policy explicitly allows it.
- No automatic Leave deduction is performed for late arrival or absence in version 1.

### 8.4 Balance ledger

The existing aggregate balance remains available for efficient reads, but every balance change also creates an immutable ledger transaction.

Ledger events include:

- Opening Snapshot.
- Entitlement.
- Accrual.
- Carry Forward.
- Reservation.
- Consumption.
- Reversal.
- Adjustment.
- Expiry.

Rules:

- Submission reserves balance.
- Approval consumes the reservation.
- Rejection or cancellation releases it.
- Approved cancellation creates a reversal.
- Manual adjustment requires an authorized actor and reason.
- Corrections never edit or delete earlier ledger rows.
- The ledger and aggregate balance must reconcile after every transaction.

---

## 9. Overtime

### 9.1 Eligibility

Default rules:

- Minimum eligible time: 30 minutes.
- Round down to completed 15-minute units.
- Early arrival is excluded.
- Normal-day overtime starts only after scheduled net work is fulfilled.
- Late-arrival makeup time is not overtime.
- Net work on a Holiday or weekly off-day is eligible.

Boundary examples:

| Eligible raw minutes | Approved calculation before manager adjustment |
|---|---|
| 29 | 0 |
| 30 | 30 |
| 44 | 30 |
| 45 | 45 |

### 9.2 Request lifecycle

```text
CALCULATED -> SUBMITTED -> APPROVED -> SETTLED
                       -> REJECTED

CALCULATED/SUBMITTED -> CANCELLED
```

- One active Overtime request is permitted per Attendance row.
- Employee requests `COMP_OFF` or `PAYROLL_PENDING`.
- Approver confirms approved minutes and settlement.
- Approved values and the applied policy are snapshotted.

### 9.3 Settlement

For `COMP_OFF`:

- Approved Comp-off minutes are capped at 480 per source date.
- The approver must reduce approved Comp-off minutes or select Payroll Pending when the eligible amount exceeds the cap.
- Version 1 does not silently discard minutes.
- Version 1 does not split one request between Comp-off and Payroll Pending.

For `PAYROLL_PENDING`:

- Preserve approved minutes as an auditable future payroll input.
- Do not calculate currency, rates, multipliers or deductions.

---

## 10. Comp-off

### 10.1 Credit conversion

- 240 approved minutes = 0.5 day.
- 480 approved minutes = 1 day.
- Maximum = 1 day from one source date.
- Credit expiry = 90 days.

### 10.2 Credit lifecycle

```text
AVAILABLE -> RESERVED -> USED
          -> EXPIRED
          -> REVOKED

RESERVED -> AVAILABLE when released before expiry
```

### 10.3 Consumption

- Use credits in earliest-expiry-first order.
- Leave submission reserves sufficient credit.
- Leave approval consumes reservations.
- Leave rejection or cancellation releases reservations.
- Approved Leave cancellation restores credit only if the source credit has not expired.
- Concurrency protection prevents the same credit being reserved twice.

### 10.4 Restrictions

- No negative Comp-off balance.
- No manual credit creation.
- HR can revoke unused credit only with a mandatory reason.
- A revoked, expired or fully used credit cannot be allocated.

---

## 11. Approval resolution

### 11.1 Workflow precedence

1. Active Company workflow for the workflow code.
2. Active global workflow for the workflow code.

Required workflow codes:

- `LEAVE_APPROVAL`
- `ATTENDANCE_REGULARIZATION`
- `OVERTIME_APPROVAL`

### 11.2 Default approver chain

1. Active reporting manager inside the employee's tenant scope.
2. Eligible HR Manager when the reporting manager is missing or ineligible.
3. Company Administrator or Organization Owner when no eligible HR Manager exists.

### 11.3 Approval rules

- An approver cannot approve their own request.
- Only the current workflow step can act.
- The approver must still be active and in scope when acting.
- Project Managers can act only for authorized reporting employees.
- Client-provided approver IDs do not override workflow resolution.
- Concurrent or repeated actions return a stable `409` conflict.

---

## 12. Attendance period closing

### 12.1 Lifecycle

```text
OPEN -> REVIEW -> LOCKED -> PAYROLL_PENDING -> CLOSED
```

### 12.2 Lock blockers

A period cannot be locked while it contains:

- Open missing-punch exceptions.
- Submitted Attendance regularizations.
- Pending Leave actions affecting the period.
- Submitted Overtime requests.

The review screen must show blocker counts and navigable records.

### 12.3 Reopen

- Only an authorized HR user can reopen a locked or Payroll Pending period.
- A reason is mandatory.
- Reopening creates an audit entry and notification.
- Corrected records must be reviewed and locked again.

### 12.4 Payroll boundary

`PAYROLL_PENDING` is the stable future payroll handoff.

Payroll and advanced reports will be implemented only after:

1. Attendance, Leave, Overtime and Comp-off pass UAT.
2. Statutory rules are confirmed.
3. Payroll cut-off, rates and reporting requirements are approved.

---

## 13. Employee lifecycle effects

### 13.1 Joining

- Roster generation starts on the employee's joining/effective assignment date.
- Earlier days are excluded.

### 13.2 Transfer

- Future roster entries follow the effective Company/Branch assignment.
- Published entries on or after the transfer date require explicit reconciliation.
- Historical entries remain attached to their snapshotted Company, Branch and timezone.

### 13.3 Separation

- Roster generation stops after the effective separation date.
- Open attendance sessions and pending requests must be resolved during clearance.
- Historical workforce data remains available according to permission and retention rules.

---

## 14. Workforce calendar and privacy

### 14.1 Employee

Employees can see:

- Own Shift Roster.
- Own Attendance states.
- Own approved and pending Leave.
- Own Holidays.
- Own Overtime and Comp-off status.

### 14.2 Project Manager

Project Managers can see authorized reporting employees only.

They can see operational availability but not:

- Private Leave reasons.
- Attachments.
- Medical information.
- Attendance correction narratives unrelated to approval.

### 14.3 HR

HR calendar access is limited to the active Company and Branch authorization scope.

### 14.4 Colleague availability

Where colleague availability is exposed, show only privacy-safe states such as:

- Available.
- On Leave.
- Holiday.
- Week Off.
- Scheduled.

Do not expose reasons or sensitive details.

---

## 15. Roles and capability matrix

| Capability | Organization Owner | Company Administrator | HR Manager | Project Manager | Employee |
|---|---:|---:|---:|---:|---:|
| Configure policies | Yes | Yes | Yes | No | No |
| Manage Holidays | Yes | Yes | Yes | No | No |
| Generate roster | Yes | Yes | Yes | No | No |
| Publish/lock roster | Yes | Yes | Yes | No | No |
| View scoped team roster | Yes | Yes | Yes | Reporting team | Own |
| Correct Attendance | Yes | Yes | Yes | Approval only | Request only |
| Approve regularization | Yes | Yes | Yes | Reporting team | No |
| Manage Leave configuration | Yes | Yes | Yes | No | No |
| Request Leave | If employee-linked | If employee-linked | If employee-linked | If employee-linked | Own |
| Approve Leave | According to workflow | According to workflow | According to workflow | Reporting team | No |
| Review Overtime | Yes | Yes | Yes | Reporting team | Own request |
| Manage Comp-off | Yes | Yes | Yes | No | Own balance |
| Lock Attendance period | Yes | Yes | Yes | No | No |

Custom roles receive no new permissions automatically. Permissions must be assigned explicitly.

---

## 16. User experience

Use the existing Warm Coral + Teal design foundation and shared right-side FormSheet pattern.

### 16.1 HR navigation

- Work Schedule
- Attendance
  - Daily
  - Exceptions
  - Period Closing
- Overtime
- Leave
  - Requests
  - Calendar
  - Types
  - Policies
  - Balances
  - Holidays
  - Comp-off

Navigation is visible only when both the route and permission are available.

### 16.2 Work Schedule

- Month-first roster calendar.
- Company and Branch context.
- Date-period selector.
- Dry-run generation drawer.
- Validation summary.
- Draft/published/locked status.
- Employee/day override drawer.
- Publish and lock confirmations.

### 16.3 Attendance

- Scheduled versus actual time.
- Late, early, missing-punch and insufficient-hours indicators.
- Exception and regularization drawers.
- Period review and blockers.

### 16.4 My Workspace

Keep separate:

- **Today's Shift:** expected attendance schedule.
- **Today's Work Plan:** project/task assignments.

Include:

- Check-in/check-out.
- Leave balances and requests.
- Attendance exceptions.
- Overtime requests.
- Comp-off credits.
- Personal workforce calendar.

Do not add fake charts, trends, messages or actions.

---

## 17. Client-adjustable settings

The client may configure:

- Working and half-working days.
- Shift start, end and break.
- Late and early grace.
- Full-day and half-day thresholds.
- Regularization and backdate windows.
- Overtime minimum and rounding.
- Overtime caps.
- Comp-off conversion, maximum and expiry.
- Approval routing.
- Holiday dates, types, portions and Branch applicability.

Changes apply prospectively unless an authorized user explicitly reopens an affected period.

---

## 18. Decisions required before production

The following are intentionally not assumed:

- Country-specific Leave entitlement.
- Statutory public-holiday list.
- Statutory Overtime rates and legal limits.
- Payroll deductions for absence, late arrival or unpaid Leave.
- Payroll cut-off dates.
- Payroll export format.
- Government reporting formats.

These decisions are not blockers for building and testing the workforce foundation, but they are blockers for production payroll activation.

---

## 19. Deferred scope

- Payroll calculations and payslips.
- Advanced workforce and statutory reporting.
- Rotating Shift templates.
- Shift swaps.
- Biometric, GPS and geofenced Attendance.
- Optional Holidays.
- Approval delegation and escalation.
- Workforce email notifications.
- Government Holiday imports.
- Automatic attendance penalties.

---

## 20. Business acceptance

The baseline is accepted only when:

1. Work Plan and Shift Roster remain technically and visually distinct.
2. A roster can be dry-run, created, published, corrected and locked.
3. The 30-minute late boundary and 90%/50% day thresholds pass boundary testing.
4. Missing punches produce exceptions without invented timestamps.
5. Leave balances reconcile with the immutable ledger.
6. Overtime excludes early arrival and makeup time.
7. Comp-off conversion, reservation, expiry and FIFO usage work correctly.
8. Monthly closing blocks unresolved records.
9. Company Group, Company, Branch, manager-team and employee-self isolation pass.
10. Historical locked results remain stable after policy changes.
11. All critical mutations have transactional business audits.
12. Business UAT signs off before payroll work begins.

---

## 21. Locked decision register

| Decision | Approved baseline |
|---|---|
| Schedule model | New Shift Roster; existing WorkSchedule remains Work Plan |
| Roster period | Maximum 62 days; UI defaults to one month |
| Late grace | 30 minutes |
| Exactly +30:00 | On Time |
| Full Day | At least 90% of adjusted scheduled net minutes |
| Half Day | At least 50% and below 90% |
| Regularization window | Three calendar days |
| Finalization delay | 180 minutes after scheduled end |
| Maximum open shift | 24 hours |
| Overtime minimum | 30 minutes |
| Overtime rounding | Down to completed 15-minute units |
| Early arrival | Not Overtime |
| Comp-off conversion | 240 minutes = 0.5 day; 480 minutes = 1 day |
| Comp-off maximum | 1 day per source date |
| Comp-off expiry | 90 days |
| Comp-off consumption | Earliest expiry first |
| Leave sandwich rule | Disabled |
| Automatic Leave deduction | Disabled |
| Payroll | Deferred until workforce UAT passes |

## Revision history

| Version | Date | Status | Summary |
|---|---|---|---|
| 1.0 | 2026-08-05 | APPROVED BASELINE | Initial locked workforce time-management decisions |
