# Optional / Floating Holidays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a company-level annual holiday limit, branch-specific mandatory and optional holiday calendars, and explicit employee group selection of auto-approved floating holidays without changing the normal leave approval workflow.

**Architecture:** Business Calendar remains the source of holiday dates. A small company/year holiday-policy record stores the annual maximum and the linked Optional Holiday leave type; a catalog service combines the published company and employee-branch calendars and calculates `optional allowance = company maximum - unique mandatory holidays on scheduled working days`. Employee choices are stored as auto-approved `LeaveRequest` rows linked to the selected calendar event, so attendance and workforce-calendar consumers can use the existing approved-leave path; no election table and no second approval engine are introduced.

**Tech Stack:** NestJS 11, Prisma 7/PostgreSQL, Jest 30, Next.js 16/React 19, TanStack Query, React Hook Form/Zod, Vitest.

**Spec:** [Optional / Floating Holidays product plan](../../product/optional-floating-holidays-plan.md), updated by the decisions recorded here.

**Implementation status:** Merged into `PMS-170926` at `4a8c5a2`; automated release gates passed. Manual workflow QA and UI polish remain a separate follow-up.

## Global Constraints

- The company holiday maximum is configured once per company and calendar year; it is not branch-specific.
- Published company and branch calendars supply the actual holiday dates for each employee location.
- Ordinary leave policies support a company default with branch/department/designation overrides. Optional-holiday allowance does not use `LeavePolicy.annualEntitlement`; it comes only from the company holiday maximum and the employee branch calendar.
- Optional-holiday usage is counted from active approved optional-holiday `LeaveRequest` rows. It is not duplicated in `EmployeeLeaveBalance`, which avoids keeping a derived balance synchronized with calendar amendments.
- A mandatory holiday closes the office through the existing `businessDayEffect`; an optional holiday always keeps the office open.
- Optional allowance is `maximumHolidayDays - mandatoryWorkingDayCount`, never less than zero.
- Count each mandatory calendar date once after composing company and branch calendars; a mandatory date on a week-off does not reduce the optional allowance.
- Only full-day optional holidays are supported. An optional event must be all-day and have `startDate === endDate`.
- `startDate` and `endDate` stay on Business Calendar because normal calendar events may span several dates. For an optional holiday they must be the same date. Each employee selection creates a one-day leave request with `fromDate === toDate`.
- Employees select several optional dates in one save operation and may swap future choices later.
- A date is editable while the branch-local business date is before the holiday date. For an October 10 holiday, it is editable through October 9 11:59:59 PM and locked from October 10 12:00:00 AM in the branch timezone.
- Locked selections cannot be added, removed, or swapped. A group update that tries to change a locked date fails atomically.
- Optional selections are immediately `APPROVED`, have no `ApprovalTransaction`, and never enter `LEAVE_APPROVAL`.
- The ordinary leave create, submit, manager/HR approval, rejection, and cancellation paths remain unchanged.
- Attendance never infers optional leave from missing punches. Without an approved selection, no punches means absence/attendance exception under the existing rules.
- No capacity limits, employee-target calendar events, half-day optional holidays, substitute-date automation, or separate election subsystem are added.

## Product Flow

```text
Company administrator
  -> creates one Optional Holiday leave type for the company
  -> sets the year and maximum total holidays

Calendar administrator
  -> publishes company mandatory holidays
  -> publishes branch/location mandatory and optional holiday dates

System, per employee branch
  -> composes company + branch dates
  -> removes duplicates
  -> lets Mandatory win if the same date has both classifications
  -> excludes week-offs from the mandatory count and optional catalog
  -> calculates Optional allowance = Company maximum - Mandatory count

Employee
  -> opens My Workspace
  -> selects several optional dates and saves once
  -> receives immediate confirmation; requests are already approved
  -> can swap future dates until each date's day-before cutoff

Attendance
  -> approved selection + no punches = LEAVE for that employee
  -> other employees still have a normal working day
  -> no selection + no punches = ABSENT / existing attendance exception
```

## File Structure

### New backend files

- `backend/prisma/migrations/20260923090000_optional_floating_holidays/migration.sql` — additive schema migration and leave-policy company-default constraints.
- `backend/src/modules/business-calendar/dto/company-holiday-policy.dto.ts` — company/year holiday policy request validation.
- `backend/src/modules/business-calendar/company-holiday-policy.service.ts` — policy read/upsert and company/leave-type validation.
- `backend/src/modules/business-calendar/company-holiday-policy.controller.ts` — administration API.
- `backend/src/modules/business-calendar/optional-holiday-catalog.service.ts` — published calendar composition, entitlement calculation, collision rules, and deadline state.
- `backend/src/modules/business-calendar/optional-holiday-catalog.service.spec.ts` — catalog and entitlement tests.
- `backend/src/modules/optional-holiday/dto/update-optional-holiday-selections.dto.ts` — group selection payload.
- `backend/src/modules/optional-holiday/optional-holiday-selection.service.ts` — atomic auto-approved create/swap/cancel logic.
- `backend/src/modules/optional-holiday/optional-holiday-selection.service.spec.ts` — transactional selection tests.
- `backend/src/modules/optional-holiday/optional-holiday-reminder.service.ts` — idempotent day-before reminder scan.
- `backend/src/modules/optional-holiday/optional-holiday-reminder.service.spec.ts` — timezone and deduplication tests.
- `backend/src/modules/optional-holiday/optional-holiday.controller.ts` — employee catalog and selection endpoints under `/me`.
- `backend/src/modules/optional-holiday/optional-holiday.module.ts` — module wiring.

### New frontend files

- `frontend/features/optional-holiday/types.ts` — catalog, policy, and selection response types.
- `frontend/features/optional-holiday/service.ts` — admin policy and employee endpoint client.
- `frontend/features/optional-holiday/hooks.ts` — query/mutation hooks and cache invalidation.
- `frontend/features/optional-holiday/optional-holiday-policy-card.tsx` — company/year maximum setup.
- `frontend/features/optional-holiday/optional-holiday-selection-card.tsx` — employee summary, multi-select, save, and locked states.
- `frontend/features/optional-holiday/optional-holiday-selection-card.test.tsx` — group selection and cutoff UI tests.
- `frontend/features/optional-holiday/index.ts` — feature exports.

### Existing files changed

- `backend/prisma/schema.prisma`
- `backend/src/app.module.ts`
- `backend/src/modules/business-calendar/business-calendar.module.ts`
- `backend/src/modules/business-calendar/business-calendar-event.service.ts`
- `backend/src/modules/business-calendar/business-calendar-event.service.spec.ts`
- `backend/src/modules/business-calendar/business-calendar-publish.service.ts`
- `backend/src/modules/business-calendar/business-calendar-publish.service.spec.ts`
- `backend/src/modules/business-calendar/business-calendar-runtime.util.spec.ts`
- `backend/src/modules/business-calendar/dto/business-calendar-version.dto.ts`
- `backend/src/modules/leave-type/leave-type.service.ts`
- `backend/src/modules/leave-type/leave-type.service.spec.ts`
- `backend/src/modules/leave-policy/dto/create-leave-policy.dto.ts`
- `backend/src/modules/leave-policy/leave-policy.service.ts`
- `backend/src/modules/leave-policy/leave-policy.service.spec.ts`
- `backend/src/modules/leave-policy/leave-policy-resolver.service.ts`
- `backend/src/modules/leave-policy/leave-policy-resolver.service.spec.ts`
- `backend/src/modules/leave-policy/leave-policy-specificity.ts`
- `backend/src/modules/leave-policy/leave-policy-specificity.spec.ts`
- `backend/src/modules/leave-request/leave-request.service.ts`
- `backend/src/modules/leave-request/leave-request.service.spec.ts`
- `backend/src/modules/attendance/attendance.service.ts`
- `backend/src/modules/attendance/attendance.service.spec.ts`
- `backend/src/modules/attendance/attendance-finalizer.service.ts`
- `backend/src/modules/workforce-calendar/workforce-calendar.service.spec.ts`
- `backend/src/modules/notification/notification-event.catalog.ts`
- `backend/src/modules/notification/notification-href.ts`
- `backend/src/modules/workforce-jobs/workforce-jobs.module.ts`
- `backend/src/modules/workforce-jobs/workforce-jobs.scheduler.ts`
- `backend/src/modules/workforce-jobs/workforce-jobs.scheduler.spec.ts`
- `frontend/config/api.ts`
- `frontend/features/business-calendar/types.ts`
- `frontend/features/business-calendar/version-workspace.tsx`
- `frontend/features/business-calendar/version-workspace.test.ts`
- `frontend/features/business-calendar/events-views.tsx`
- `frontend/features/business-calendar/business-calendar-workspace.tsx`
- `frontend/features/holiday/types.ts`
- `frontend/features/holiday/holiday-workspace.tsx`
- `frontend/features/leave-type/types/leave-type.ts`
- `frontend/features/leave-type/validation/leave-type-schema.ts`
- `frontend/features/leave-type/forms/leave-type-form.tsx`
- `frontend/features/leave-policy/types/leave-policy.ts`
- `frontend/features/leave-policy/validation/leave-policy-schema.ts`
- `frontend/features/leave-policy/forms/leave-policy-form.tsx`
- `frontend/features/leave-policy/components/leave-policy-columns.tsx`
- `frontend/features/my-workspace/components/my-workspace.tsx`
- `frontend/features/my-workspace/services/me-service.ts`
- `frontend/features/my-workspace/hooks/use-my-workspace.ts`
- `frontend/features/my-workspace/types.ts`
- `docs/product/optional-floating-holidays-plan.md`
- `docs/product/company-workflow-guide/05-calendar-and-work-schedule.md`
- `docs/product/company-workflow-guide/10-leave-overtime.md`

## Review Focus

- Branch-local midnight must control locking; UTC midnight must not lock an India, US, or DST-observing branch early or late. Covered in Task 4 and Task 5 tests.
- Company/branch duplicates and a mandatory/optional collision on one date must consume only one mandatory day and must not expose that date for selection. Covered in Task 4 tests.
- Repeating the same `PUT` must not create duplicate leave requests or duplicate notifications. Covered in Task 5 and Task 7 tests.
- A failed group swap must leave all prior selections unchanged and create no partial requests. Covered in Task 5 tests with a serializable transaction.
- An approved optional selection must suppress absence handling only for that employee; colleagues remain scheduled to work. Covered in Task 8 tests.

---

### Task 1: Add the data model and safe migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260923090000_optional_floating_holidays/migration.sql`

**Interfaces:**
- Produces: `LeaveTypeCategory.OPTIONAL_HOLIDAY`, `BusinessCalendarEvent.isOptionalHoliday`, `CompanyHolidayPolicy`, `LeaveRequest.optionalHolidayEventId`, and nullable `LeavePolicy.branchId`.
- Preserves: all existing event rows as mandatory/non-optional through `isOptionalHoliday = false`.

- [ ] **Step 1: Add the Prisma contract**

Add these shapes and corresponding relation arrays on `Company`, `LeaveType`, and `BusinessCalendarEvent`:

```prisma
enum LeaveTypeCategory {
  STANDARD
  UNPAID
  COMP_OFF
  OPTIONAL_HOLIDAY
}

model CompanyHolidayPolicy {
  id                         String @id @default(uuid())
  companyId                  String
  year                       Int
  maximumHolidayDays         Int
  optionalHolidayLeaveTypeId String
  isActive                   Boolean @default(true)

  company                  Company   @relation(fields: [companyId], references: [id], onDelete: Restrict)
  optionalHolidayLeaveType LeaveType @relation(fields: [optionalHolidayLeaveTypeId], references: [id], onDelete: Restrict)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, year])
  @@index([optionalHolidayLeaveTypeId])
  @@map("company_holiday_policies")
}
```

Add `isOptionalHoliday Boolean @default(false)` to `BusinessCalendarEvent`. Add nullable `optionalHolidayEventId` plus relation `optionalHolidayEvent` to `LeaveRequest`, with an index on `[employeeId, optionalHolidayEventId, status]`. Change `LeavePolicy.branchId` to `String?` and its `branch` relation to `Branch?`.

- [ ] **Step 2: Write the SQL migration explicitly**

The migration must:

1. Extend `LeaveTypeCategory` with `OPTIONAL_HOLIDAY`.
2. Add `isOptionalHoliday BOOLEAN NOT NULL DEFAULT false`.
3. Create `company_holiday_policies` with `CHECK (year BETWEEN 2000 AND 2100)` and `CHECK (maximumHolidayDays BETWEEN 1 AND 366)`.
4. Add the optional-event foreign key to `leave_requests` with `ON DELETE RESTRICT`.
5. Make `leave_policies.branchId` nullable.
6. Add a check that company-default leave policies have no department or designation:

```sql
CHECK (
  "branchId" IS NOT NULL
  OR ("departmentId" IS NULL AND "designationId" IS NULL)
)
```

7. Add a partial unique index for one active company default per leave type:

```sql
CREATE UNIQUE INDEX "leave_policies_active_company_default_uidx"
ON "leave_policies" ("companyId", "leaveTypeId")
WHERE "isActive" = true
  AND "branchId" IS NULL
  AND "departmentId" IS NULL
  AND "designationId" IS NULL;
```

8. Prevent duplicate active selection of the same event while retaining cancellation history:

```sql
CREATE UNIQUE INDEX "leave_requests_active_optional_event_uidx"
ON "leave_requests" ("employeeId", "optionalHolidayEventId")
WHERE "optionalHolidayEventId" IS NOT NULL
  AND "isActive" = true
  AND "status" <> 'CANCELLED';
```

- [ ] **Step 3: Validate schema and generated client**

Run from `backend`:

```bash
pnpm run prisma:validate
pnpm run prisma:generate
```

Expected: both commands exit zero; existing rows require no backfill because the new event flag defaults to false.

- [ ] **Step 4: Commit the schema unit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260923090000_optional_floating_holidays/migration.sql
git commit -m "feat: add optional holiday data model"
```

### Task 2: Support company-default leave policies with branch overrides

**Files:**
- Modify: `backend/src/modules/leave-policy/dto/create-leave-policy.dto.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy.service.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy.service.spec.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy-resolver.service.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy-resolver.service.spec.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy-specificity.ts`
- Modify: `backend/src/modules/leave-policy/leave-policy-specificity.spec.ts`
- Modify: `frontend/features/leave-policy/types/leave-policy.ts`
- Modify: `frontend/features/leave-policy/validation/leave-policy-schema.ts`
- Modify: `frontend/features/leave-policy/forms/leave-policy-form.tsx`
- Modify: `frontend/features/leave-policy/components/leave-policy-columns.tsx`

**Interfaces:**
- Produces: resolution order `branch department+designation > branch designation > branch department > branch default > company default`.
- Constraint: company-default rows have `branchId = null`, `departmentId = null`, and `designationId = null`.

- [ ] **Step 1: Write resolver tests first**

Add cases proving:

```ts
expect(resolve(branchSpecificAndCompanyDefault).tier).toBe('BRANCH_DEFAULT');
expect(resolve(companyDefaultOnly).tier).toBe('COMPANY_DEFAULT');
```

Also test that two company defaults produce `LEAVE_POLICY_CONFIGURATION_CONFLICT`, and that a branch policy for another branch is ignored.

- [ ] **Step 2: Run the focused tests and verify failure**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/leave-policy/leave-policy-specificity.spec.ts src/modules/leave-policy/leave-policy-resolver.service.spec.ts
```

Expected: failures because `COMPANY_DEFAULT` and nullable branch matching do not exist yet.

- [ ] **Step 3: Implement the hierarchy**

Extend `LeavePolicyMatchTier` and scoring with `COMPANY_DEFAULT: 0`. Query policies with `branchId: { in: [null, employeeBranchId] }`; score company defaults below every branch tier. Validate create/update so dimensions are rejected when `branchId` is null, while branch relation validation runs only when a branch is supplied.

- [ ] **Step 4: Update the policy form**

Make Branch optional and label an empty value as `All branches (company default)`. Hide and clear Department and Designation when company default is selected. Display `Company default` in the table when `branchId` is null.

- [ ] **Step 5: Run backend and frontend checks**

```bash
cd backend && pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/leave-policy/leave-policy-specificity.spec.ts src/modules/leave-policy/leave-policy-resolver.service.spec.ts src/modules/leave-policy/leave-policy.service.spec.ts
cd ../frontend && pnpm run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 6: Commit the leave-policy unit**

```bash
git add backend/src/modules/leave-policy frontend/features/leave-policy
git commit -m "feat: add company default leave policies"
```

### Task 3: Add holiday classification and company holiday policy setup

**Files:**
- Create: `backend/src/modules/business-calendar/dto/company-holiday-policy.dto.ts`
- Create: `backend/src/modules/business-calendar/company-holiday-policy.service.ts`
- Create: `backend/src/modules/business-calendar/company-holiday-policy.controller.ts`
- Modify: `backend/src/modules/business-calendar/business-calendar.module.ts`
- Modify: `backend/src/modules/business-calendar/dto/business-calendar-version.dto.ts`
- Modify: `backend/src/modules/business-calendar/business-calendar-event.service.ts`
- Modify: `backend/src/modules/business-calendar/business-calendar-event.service.spec.ts`
- Modify: `backend/src/modules/leave-type/leave-type.service.ts`
- Modify: `backend/src/modules/leave-type/leave-type.service.spec.ts`
- Modify: `frontend/features/business-calendar/types.ts`
- Modify: `frontend/features/business-calendar/version-workspace.tsx`
- Modify: `frontend/features/business-calendar/version-workspace.test.ts`
- Modify: `frontend/features/business-calendar/events-views.tsx`
- Modify: `frontend/features/business-calendar/business-calendar-workspace.tsx`
- Modify: `frontend/features/holiday/types.ts`
- Modify: `frontend/features/holiday/holiday-workspace.tsx`
- Modify: `frontend/features/leave-type/types/leave-type.ts`
- Modify: `frontend/features/leave-type/validation/leave-type-schema.ts`
- Modify: `frontend/features/leave-type/forms/leave-type-form.tsx`
- Create: `frontend/features/optional-holiday/optional-holiday-policy-card.tsx`

**Interfaces:**
- Produces: `GET /company-holiday-policies?companyId=<id>&year=<year>` and `PUT /company-holiday-policies/:companyId/:year`.
- PUT body: `{ maximumHolidayDays: number, optionalHolidayLeaveTypeId: string }`.
- Event DTOs accept `isOptionalHoliday?: boolean`.

- [ ] **Step 1: Write event validation tests**

Cover these exact rules:

```text
Optional accepted: HOLIDAY + allDay + one date + effect NONE + paidHoliday false + company/branch target.
Optional rejected: non-HOLIDAY event type.
Optional rejected: startDate != endDate.
Optional rejected: timed or half-day event.
Optional rejected: NON_WORKING_DAY or paidHoliday true.
Optional rejected: DEPARTMENT, EMPLOYEE, or PROJECT target.
Existing event without flag: accepted as isOptionalHoliday false.
```

- [ ] **Step 2: Run the event tests and verify failure**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/business-calendar/business-calendar-event.service.spec.ts
```

- [ ] **Step 3: Implement event normalization and persistence**

Add `isOptionalHoliday` to create/update DTOs, event create/update data, checksum inputs, publish comparison bundles, API responses, and frontend types. Validate against `eventType.eventTypeCode === 'HOLIDAY'`. Do not change runtime precedence: `businessDayEffect: NONE` already keeps the office open.

- [ ] **Step 4: Add company holiday policy API tests and implementation**

Validate that the linked leave type belongs to the same company, is active, and has category `OPTIONAL_HOLIDAY`. Reject another active optional-holiday policy for the same company/year through the database unique key. Use `calendar.business.manage` for reads/writes.

- [ ] **Step 5: Constrain the Optional Holiday leave type**

Allow `OPTIONAL_HOLIDAY` in backend and frontend category unions. Normalize this category to `isPaid = true`, `requiresApproval = false`, `allowHalfDay = false`, and `carryForwardAllowed = false`. Keep `requiresApproval` behavior for every other leave type unchanged.

- [ ] **Step 6: Implement the admin UI**

In the Business Calendar workspace, show a compact `Annual holiday policy` card after company selection. Inputs are Year, Maximum holidays, and Optional Holiday leave type. In the event editor, show `Optional / Floating holiday` only for HOLIDAY events; when selected, fix the event to all-day, one date, `NONE`, and unpaid-at-calendar-level. In event lists and the Holidays directory, show `Mandatory` or `Optional / Floating` badges.

- [ ] **Step 7: Run the focused checks**

```bash
cd backend && pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/business-calendar/business-calendar-event.service.spec.ts src/modules/leave-type/leave-type.service.spec.ts
cd ../frontend && pnpm exec vitest run features/business-calendar/version-workspace.test.ts
```

- [ ] **Step 8: Commit the setup unit**

```bash
git add backend/src/modules/business-calendar backend/src/modules/leave-type frontend/features/business-calendar frontend/features/holiday frontend/features/leave-type frontend/features/optional-holiday
git commit -m "feat: configure mandatory and optional holidays"
```

### Task 4: Build the employee catalog and entitlement calculation

**Files:**
- Create: `backend/src/modules/business-calendar/optional-holiday-catalog.service.ts`
- Create: `backend/src/modules/business-calendar/optional-holiday-catalog.service.spec.ts`
- Modify: `backend/src/modules/business-calendar/business-calendar.module.ts`

**Interfaces:**
- Produces:

```ts
type OptionalHolidayCatalog = {
  year: number;
  timezone: string;
  maximumHolidayDays: number;
  mandatoryWorkingDayCount: number;
  optionalAllowance: number;
  selectedCount: number;
  remainingCount: number;
  holidays: Array<{
    eventId: string;
    date: string;
    name: string;
    calendarScope: 'COMPANY' | 'BRANCH';
    selected: boolean;
    locked: boolean;
    editableUntil: string;
  }>;
};
```

- Consumes: published company and employee-branch calendar versions effective during the requested year.

- [ ] **Step 1: Write catalog tests before the service**

Test the example `maximum 10 - mandatory 5 = optional 5`. Add cases for company/branch duplicate dates, mandatory winning over optional, a mandatory holiday on Sunday not reducing allowance, optional date on a week-off being omitted, wrong-company events being omitted, and an October 10 date changing from editable to locked at branch-local midnight.

- [ ] **Step 2: Run and verify the missing-service failure**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/business-calendar/optional-holiday-catalog.service.spec.ts
```

- [ ] **Step 3: Implement published-calendar composition**

Load active company and branch calendars, then all published versions overlapping January 1 through December 31. Include an event only inside both its event range and its version effective range. Expand multi-day mandatory events into individual dates. Optional events are already guaranteed to contain one date.

For every date:

1. Merge company and branch occurrences by `YYYY-MM-DD`.
2. If any occurrence is a full-day mandatory HOLIDAY with non-working effect, classify the date mandatory.
3. Otherwise, if an optional occurrence exists, classify it optional.
4. Inspect the effective company/branch working-week layer before event effects; count a mandatory date only when that base date was scheduled working.
5. Return an optional date only when the final runtime result remains a full working day.

If mandatory count exceeds the company maximum, throw `HOLIDAY_POLICY_MAX_BELOW_MANDATORY` and block employee selection until HR corrects setup.

- [ ] **Step 4: Implement cutoff without storing a timestamp**

Use the branch IANA timezone to derive today's `YYYY-MM-DD`. Define:

```ts
locked = branchBusinessDate >= holidayDate;
editableUntil = `${dayBefore(holidayDate)}T23:59:59` in the branch timezone;
```

Comparing local date keys avoids UTC and daylight-saving errors.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/business-calendar/optional-holiday-catalog.service.spec.ts src/modules/business-calendar/business-calendar-runtime.util.spec.ts
git add backend/src/modules/business-calendar
git commit -m "feat: calculate optional holiday catalogs"
```

### Task 5: Add atomic group selection and auto-approved leave records

**Files:**
- Create: `backend/src/modules/optional-holiday/dto/update-optional-holiday-selections.dto.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday-selection.service.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday-selection.service.spec.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday.controller.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/modules/leave-request/leave-request.service.ts`
- Modify: `backend/src/modules/leave-request/leave-request.service.spec.ts`

**Interfaces:**
- Produces: `GET /me/optional-holidays?year=2027`.
- Produces: `PUT /me/optional-holiday-selections/2027` with `{ "eventIds": ["..."] }`.
- PUT represents the employee's desired set for the whole year and is idempotent.

- [ ] **Step 1: Write transactional service tests**

Add tests for:

1. Selecting five valid IDs creates five one-day `APPROVED` leave requests.
2. Created rows have `optionalHolidayEventId`, `requestedDays = 1`, `approvedDays = 1`, `approvedAt`, `submittedAt`, and `approvalTransactionId = null`.
3. Repeating the same set creates nothing.
4. Replacing one future ID cancels the removed request and creates the addition.
5. Adding or removing a locked date rejects the entire update.
6. Six desired dates against allowance five rejects the entire update.
7. Wrong year, wrong company/branch, unpublished event, duplicate date, and non-catalog ID are rejected.
8. An overlapping submitted/approved normal leave blocks selection.
9. Concurrent saves cannot exceed allowance or create duplicate active selections.

- [ ] **Step 2: Run and verify failure**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/optional-holiday/optional-holiday-selection.service.spec.ts
```

- [ ] **Step 3: Implement the serializable reconciliation**

Inside one `Serializable` Prisma transaction:

1. Resolve the actor to one active employee and load the catalog in the same transaction.
2. Load existing active optional-holiday leave requests for employee/year.
3. Compare existing event IDs with the desired unique IDs.
4. Reject if the symmetric difference contains a locked date.
5. Reject if desired count exceeds `optionalAllowance`.
6. Run the same overlap check used by normal leave for every addition.
7. Mark removed future requests `CANCELLED`, set cancellation fields, and audit `OPTIONAL_HOLIDAY_SELECTION_REMOVED`.
8. Create additions directly as `APPROVED`, with one date, one day, `approvedByUserId = null`, no approval transaction, and audit `OPTIONAL_HOLIDAY_AUTO_APPROVED`.
9. Return the refreshed catalog.

Use the partial unique index from Task 1 to prevent duplicate active employee/event selections while permitting historical cancelled rows. Also reject two different catalog events representing the same date in service validation. Catch `P2002` and return `OPTIONAL_HOLIDAY_SELECTION_CONFLICT`.

- [ ] **Step 4: Prevent bypass through ordinary leave application**

Exclude `OPTIONAL_HOLIDAY` from the normal employee leave-type picker. In generic leave request create/update, reject that category with `OPTIONAL_HOLIDAY_USE_SELECTION` so it cannot enter the normal workflow. Do not change workflow resolution for STANDARD, UNPAID, or COMP_OFF requests.

- [ ] **Step 5: Run selection and normal-flow regression tests**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/optional-holiday/optional-holiday-selection.service.spec.ts src/modules/leave-request/leave-request.service.spec.ts
```

Expected: optional selection has no approval transaction; an ordinary submitted leave still creates the existing `LEAVE_APPROVAL` transaction.

- [ ] **Step 6: Commit the selection unit**

```bash
git add backend/src/modules/optional-holiday backend/src/modules/leave-request backend/src/app.module.ts
git commit -m "feat: add employee floating holiday selection"
```

### Task 6: Add the employee group-selection experience

**Files:**
- Create: `frontend/features/optional-holiday/types.ts`
- Create: `frontend/features/optional-holiday/service.ts`
- Create: `frontend/features/optional-holiday/hooks.ts`
- Create: `frontend/features/optional-holiday/optional-holiday-selection-card.tsx`
- Create: `frontend/features/optional-holiday/optional-holiday-selection-card.test.tsx`
- Create: `frontend/features/optional-holiday/index.ts`
- Modify: `frontend/config/api.ts`
- Modify: `frontend/features/my-workspace/components/my-workspace.tsx`
- Modify: `frontend/features/my-workspace/services/me-service.ts`
- Modify: `frontend/features/my-workspace/hooks/use-my-workspace.ts`
- Modify: `frontend/features/my-workspace/types.ts`

**Interfaces:**
- Consumes: Task 5 GET/PUT endpoints.
- Produces: one My Workspace card with annual summary and one multi-select save action.

- [ ] **Step 1: Write UI tests first**

Test that the card renders `Maximum 10`, `Mandatory 5`, `You can choose 5`, and `Remaining 5`; lets the employee select several dates before one Save; sends the complete desired event-ID set; disables locked dates with the exact cutoff copy; supports swapping an unlocked selected date; and leaves local state unchanged after a failed PUT.

- [ ] **Step 2: Run and verify failure**

```bash
pnpm exec vitest run features/optional-holiday/optional-holiday-selection-card.test.tsx
```

- [ ] **Step 3: Implement API client and hooks**

Add:

```ts
getOptionalHolidays(year: number): Promise<OptionalHolidayCatalog>
updateOptionalHolidaySelections(year: number, eventIds: string[]): Promise<OptionalHolidayCatalog>
```

On a successful PUT, replace the catalog cache and invalidate My Workspace leave/calendar queries.

- [ ] **Step 4: Implement the card**

Show all eligible dates with `Mandatory` never present as a checkbox. Selected locked dates remain visible and checked but disabled. Use one `Save selections` button. Copy beneath the button: `You can change a date until the end of the previous day. Missing attendance does not select a holiday automatically.`

- [ ] **Step 5: Run UI checks and commit**

```bash
pnpm exec vitest run features/optional-holiday/optional-holiday-selection-card.test.tsx
pnpm run typecheck
git add frontend/config/api.ts frontend/features/optional-holiday frontend/features/my-workspace
git commit -m "feat: add floating holiday group selection UI"
```

### Task 7: Add focused reminders using the existing notification system

**Files:**
- Modify: `backend/src/modules/business-calendar/business-calendar-publish.service.ts`
- Modify: `backend/src/modules/business-calendar/business-calendar-publish.service.spec.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday-reminder.service.ts`
- Create: `backend/src/modules/optional-holiday/optional-holiday-reminder.service.spec.ts`
- Modify: `backend/src/modules/optional-holiday/optional-holiday-selection.service.ts`
- Modify: `backend/src/modules/notification/notification-event.catalog.ts`
- Modify: `backend/src/modules/notification/notification-href.ts`
- Modify: `backend/src/modules/workforce-jobs/workforce-jobs.module.ts`
- Modify: `backend/src/modules/workforce-jobs/workforce-jobs.scheduler.ts`
- Modify: `backend/src/modules/workforce-jobs/workforce-jobs.scheduler.spec.ts`

**Interfaces:**
- Produces notification codes `OPTIONAL_HOLIDAY_SELECTION_OPENED`, `OPTIONAL_HOLIDAY_SELECTION_UPDATED`, and `OPTIONAL_HOLIDAY_TOMORROW`.
- Reuses `OutboxWriterService`, `OutboxProcessorService`, `UserNotificationService`, and the existing hourly workforce scheduler.

- [ ] **Step 1: Write notification and reminder tests**

Prove that publishing a version containing optional dates notifies active users in the affected company/branch; saving a changed selection creates one confirmation; and the hourly scan sends one reminder when the selected holiday is tomorrow in the employee's branch timezone. Re-running the scan must queue zero duplicates because the dedupe key contains event code, leave-request ID, branch business date, and user ID.

- [ ] **Step 2: Implement notification copy and links**

Use `/my-workspace` for all three codes. Copy:

```text
Selection opened: "Optional holiday dates are available. Choose your dates in My Workspace."
Selection updated: "Your optional holiday selections were saved and auto-approved."
Tomorrow: "You are on approved Optional Holiday tomorrow. No check-in is required."
```

- [ ] **Step 3: Emit publish and save events**

On publish, emit only when the version contains optional dates and a company holiday policy exists for the event year. Company calendars target all active company employees; branch calendars target active employees in that branch. On selection save, emit only when the desired set changed.

- [ ] **Step 4: Add the hourly selected-day reminder**

Scan only active `APPROVED` requests linked to optional events. Calculate tomorrow per branch timezone, bound batches, and use outbox recipient IDs. Add `runOptionalHolidayReminders()` beside the existing hourly reminder jobs with an overlap guard.

- [ ] **Step 5: Keep reminders intentionally small**

Do not send daily notifications for every unselected candidate date. The publish notification and persistent My Workspace card cover incomplete selection; the scheduled message is only for a date the employee actually selected.

- [ ] **Step 6: Run and commit**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/optional-holiday/optional-holiday-reminder.service.spec.ts src/modules/business-calendar/business-calendar-publish.service.spec.ts src/modules/workforce-jobs/workforce-jobs.scheduler.spec.ts src/modules/notification/user-notification.service.spec.ts
git add backend/src/modules/business-calendar backend/src/modules/optional-holiday backend/src/modules/notification backend/src/modules/workforce-jobs
git commit -m "feat: remind employees about optional holidays"
```

### Task 8: Make attendance and calendar consumers respect explicit selection

**Files:**
- Modify: `backend/src/modules/attendance/attendance.service.ts`
- Modify: `backend/src/modules/attendance/attendance.service.spec.ts`
- Modify: `backend/src/modules/attendance/attendance-finalizer.service.ts`
- Modify: `backend/src/modules/workforce-calendar/workforce-calendar.service.spec.ts`
- Modify: `frontend/features/my-workspace/components/my-workspace.tsx`

**Interfaces:**
- Consumes: approved one-day optional-holiday `LeaveRequest` rows.
- Preserves: office runtime day remains WORKING because optional calendar events have effect `NONE`.

- [ ] **Step 1: Write attendance tests first**

Add these cases:

```text
Employee A selected the date and has no punches -> final status LEAVE, no missing-check-in exception.
Employee B did not select the same optional date and has no punches -> final status ABSENT, existing exception created.
Employee C did not select and punches normally -> PRESENT.
Optional event alone, without a LeaveRequest -> does not produce LEAVE.
```

Add a self-service check-in test that an approved full-day leave is rejected with `ATTENDANCE_APPROVED_LEAVE_EXISTS`; HR attendance correction remains the recovery path for an exceptional same-day change.

- [ ] **Step 2: Run and verify the tests fail**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/attendance/attendance.service.spec.ts src/modules/workforce-calendar/workforce-calendar.service.spec.ts
```

- [ ] **Step 3: Implement explicit-leave attendance resolution**

Before finalizing a no-punch working attendance as absent, query an active `APPROVED` full-day leave covering the business date. If found, set status `LEAVE`, reason `FINALIZED_APPROVED_LEAVE`, and do not create missing-punch exceptions. Do not inspect optional calendar events directly; the leave request is the employee-specific truth.

- [ ] **Step 4: Add check-in guard and workspace copy**

Reject self-service check-in when approved full-day leave covers today. My Workspace should say `You are on approved leave today; check-in is not required.` This applies to all approved full-day leave consistently, not only floating holidays.

- [ ] **Step 5: Confirm workforce-calendar behavior**

Add a regression assertion that an approved optional leave with no approval transaction still maps to `ON_LEAVE` and shows the Optional Holiday leave type for that employee, while a colleague on the same date remains `AVAILABLE` or `SCHEDULED`.

- [ ] **Step 6: Run and commit**

```bash
pnpm exec jest --config ./test/jest-all.json --runInBand src/modules/attendance/attendance.service.spec.ts src/modules/workforce-calendar/workforce-calendar.service.spec.ts
git add backend/src/modules/attendance backend/src/modules/workforce-calendar frontend/features/my-workspace
git commit -m "fix: resolve approved leave in attendance"
```

### Task 9: Documentation, complete verification, and UAT

**Files:**
- Modify: `docs/product/optional-floating-holidays-plan.md`
- Modify: `docs/product/company-workflow-guide/05-calendar-and-work-schedule.md`
- Modify: `docs/product/company-workflow-guide/10-leave-overtime.md`

**Interfaces:**
- Produces: administrator setup order, employee flow, cutoff explanation, and recovery instructions.

- [ ] **Step 1: Update product documentation**

Replace the older one-by-one apply/approval description with the final flow in this plan. Document the setup order:

1. Create Optional Holiday leave type.
2. Set company/year maximum.
3. Publish company and branch calendars.
4. Employees make group selections.

Document that missing the cutoff leaves that date as a normal workday; the employee must use ordinary/emergency leave or HR attendance correction. Unused optional allowance remains available for later eligible dates and is never auto-selected.

- [ ] **Step 2: Run backend release checks**

```bash
cd backend
pnpm run prisma:validate
pnpm run typecheck
pnpm run typecheck:test
pnpm run lint:check
pnpm run test
pnpm run build
```

Expected: every command exits zero.

- [ ] **Step 3: Run frontend release checks**

```bash
cd frontend
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Expected: every command exits zero.

- [ ] **Step 4: Run the concrete UAT example**

Configure a year with 20 unique calendar holidays, company maximum 10, and five mandatory holidays that fall on working days. Confirm the employee card shows five selectable days from the remaining 15. Select five in one save, swap one before its cutoff, and confirm all five requests are approved without approval transactions. On one selected date confirm the selecting employee is on leave, another employee is working, and the office runtime is still working.

- [ ] **Step 5: Run cutoff and negative-path UAT**

For an October 10 optional date in `Asia/Kolkata`, confirm editing works through October 9 11:59:59 PM and fails from October 10 12:00:00 AM. Confirm no selection plus no punch becomes absence, selecting more than allowance fails without partial changes, and a mandatory holiday on a week-off does not reduce optional allowance.

- [ ] **Step 6: Refresh the repository graph and inspect the diff**

```bash
graphify update .
git status --short
git diff --check
```

Expected: the graph update succeeds, only intended files are changed, and `git diff --check` reports no whitespace errors.

- [ ] **Step 7: Commit documentation**

```bash
git add docs/product/optional-floating-holidays-plan.md docs/product/company-workflow-guide/05-calendar-and-work-schedule.md docs/product/company-workflow-guide/10-leave-overtime.md graphify-out
git commit -m "docs: document optional holiday workflow"
```

## Acceptance Checklist

- [x] Company/year maximum can be configured once and is not duplicated per branch.
- [x] Standard leave policies resolve company default first, then the most-specific matching branch override.
- [x] Mandatory calendar dates close the office; optional dates do not.
- [x] Company and branch dates compose correctly and duplicate dates count once.
- [x] Maximum 10 and five mandatory working-day holidays produces five optional selections.
- [x] Mandatory dates on week-offs do not reduce optional allowance.
- [x] Optional events and employee leave requests are single-day; normal calendar range events retain `startDate` and `endDate`.
- [x] Employee can save several choices together and swap future dates.
- [x] Optional choices are auto-approved and create no approval transaction.
- [x] Normal leave still follows the existing approval workflow.
- [x] Day-before cutoff uses branch timezone and locked dates cannot be changed.
- [x] Selection publish/update/tomorrow reminders use the existing notification and scheduler infrastructure.
- [x] Selected employee is on leave; colleagues and office remain working.
- [x] Missing punches never select leave automatically.
- [x] No new election table, capacity subsystem, or alternate approval engine exists.
