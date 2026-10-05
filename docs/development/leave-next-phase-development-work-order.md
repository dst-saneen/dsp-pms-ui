# Leave Next Phase and Release-Blocker Remediation — Detailed Development Work Order

| Field | Value |
|---|---|
| Status | APPROVED DEVELOPMENT WORK ORDER |
| Version | 1.0 |
| Baseline date | 2026-08-11 |
| Repository | `C:\DataScape\HRMS\ERP` |
| Target schema | `dsp_pms` |
| Delivery rule | Stabilize and secure the current baseline before implementing the Leave next phase |
| Change control | Any change to the locked business rules must be documented and approved before implementation |

## 1. Objective and Delivery Boundary

The objective is to deliver a production-oriented Leave workflow that supports:

- Designation-based Leave entitlement configuration.
- Sequential Manager then HR approval.
- Manager and HR approval queues.
- Personal and authorized employee calendars.
- Business Calendar integration using the authoritative runtime.
- Transactional Leave balance reservation and consumption.
- Immutable ledger history, business audits and tenant isolation.
- Existing API envelope and current business workflow compatibility.

Delivery is split into two mandatory blocks:

1. **Block A — Stabilize the current codebase and close confirmed release blockers.**
2. **Block B — Implement the Leave next phase only after Block A passes all gates.**

Leave work must not begin until the current developer handoff has been reviewed and the confirmed blockers are closed.

### Current implementation baseline

- The other developer's completed work already exists in the current checked-out codebase.
- No stash application, branch merge or conflict-resolution activity is part of this work order.
- Begin with a read-only review of the current implementation and record the exact branch and commit used for the review.
- Any unrelated local stash remains outside this work order and must not be applied, dropped or modified.

### Out of scope

- Payroll calculations, deductions and statutory formulas.
- Country-specific Leave entitlement rules not already approved.
- Sandwich Leave.
- Automatic salary or Leave deductions for late attendance.
- Replacement of the existing approval engine.
- Government holiday provider integration.
- Optional holidays.
- Approval delegation and escalation.
- Email notifications for Leave workflow events.
- Unrelated UI redesign.

## 2. Mandatory Engineering Principles

- All reads and writes are limited by the authenticated Company Group, Company and Branch scope.
- Client-supplied filters can narrow scope but can never widen it.
- Out-of-scope identifiers return `404`, not tenant-existence details.
- Every business mutation, approval transition, ledger entry, audit entry and outbox event is committed in one database transaction.
- Redis is never the source of truth for Leave, approvals or balances.
- Existing approved history is not recalculated automatically.
- Existing public routes and `{ "success": true, "data": ... }` response envelopes remain compatible.
- No sensitive Leave reason, attachment, medical information or employee content enters application logs.
- No destructive test is run against AWS RDS or the shared development schema.
- Sample data is restricted to disposable test databases and test fixtures.

---

# Block A — Current Baseline Stabilization

## 3. Work Package A1 — Security and Tenant-Isolation Closure

### A1.1 UAT runner credential and target protection

- Remove all fixed privileged passwords from repository scripts.
- Require secrets through runtime environment variables such as:
  - `UAT_RUNNER_PASSWORD`
  - `UAT_INVITE_PASSWORD`
- Before any mutating UAT action, query the actual connected PostgreSQL target and require:
  - `current_database() = 'dsp_erp_uat'`
  - `current_schema() = 'dsp_pms'`
- Abort before mutation when the expected database or schema does not match.
- Never log passwords, session tokens, OTPs or connection strings.
- Rotate any previously exposed UAT credentials and revoke the affected durable sessions as a controlled environment operation.
- Keep credential rotation evidence outside the source repository.

### A1.2 Employee Shift tenant scope

- Scope create, list and detail operations by the active authorization context.
- Verify the Employee is visible inside the active Company Group, Company and Branch scope.
- Verify the Shift belongs to the same effective Company as the Employee.
- Reject foreign Employee and Shift identifiers with `404`.
- A non-global session without organization context must return no records.
- Add update/end lifecycle and audit coverage if those operations are exposed.
- Tests must cover Company Group, Company and Branch separation.

### A1.3 Reporting-manager approval permissions

- Approval endpoints for Leave, attendance regularization and overtime must accept the correct domain permission **or** `hr.team.approve`.
- Use an explicit any-permission guard; do not weaken all-permission behavior globally.
- Controller authorization does not replace service-level current-step ownership checks.
- A Project Manager may act only for a reporting employee in the authorized tenant scope.
- Self-approval remains forbidden.
- Concurrent or repeated actions return `409`.

### A1.4 Role-administration audit integrity

- Add actor-attributed business audits to role-catalog and role-assignment mutations.
- Commit the role mutation and audit row in the same Prisma transaction.
- When a role or assignment change alters access:
  1. Apply the database mutation.
  2. Increment the affected user's `securityVersion` when required.
  3. Revoke durable PostgreSQL sessions when required.
  4. Write the business audit.
  5. Commit.
  6. Invalidate affected Redis session keys after commit.
- Any audit failure must roll back the role or assignment mutation.
- Audit metadata must contain safe identifiers and changed fields, never passwords or tokens.

### A1 acceptance criteria

- No privileged credential literal remains in tracked source.
- UAT mutations cannot run against `dsp_erp_dev`, production or an unexpected schema.
- Employee Shift operations cannot cross tenant boundaries.
- `hr.team.approve` works only for eligible reporting-team approvals.
- Every applicable role mutation has transactional audit evidence.
- Focused security and rollback tests pass.

## 4. Work Package A2 — Business Calendar Runtime Stabilization

### Objective

Make Business Calendar the authoritative business-day source for Leave while preserving the approved office inheritance and branch override model.

### Required runtime behavior

- Resolve the effective Calendar Profile and published Calendar Version for the employee's office and date.
- A Company calendar is the base calendar.
- Each Branch/office inherits Company rules and may apply approved regional overrides.
- A Company without Branches uses its Company calendar directly.
- Branch timezone is authoritative for business-date calculations and display for that Branch.
- Only Holiday-type events affect business-day calculation.
- Meetings, celebrations, training and other informational events can be displayed but do not change the business-day result.
- Return a deterministic classification containing:
  - Business date.
  - Working/non-working result.
  - Day portion.
  - Reason code and safe display reason.
  - Applied profile/version identifiers for internal diagnostics.
  - Source level: Company or Branch override.

### Runtime modes

- **ACTIVE**: Business Calendar runtime is authoritative for supported operations.
- **SHADOW**: Evaluate and compare without changing the existing business result.
- **LEGACY**: Continue the existing Holiday and working-week calculation.
- Mode may be configured per office during rollout.
- Mixed-mode tenants must be supported so one office can pilot ACTIVE while another remains SHADOW or LEGACY.

### Performance requirements

- Provide a range/batch business-day resolver.
- Leave duration calculation must request a date range once; it must not call a per-day preview endpoint in a loop.
- Effective versions and safe lookup data may be cached, but cached values must be invalidated after publishing or correcting a calendar.
- Runtime resolution remains database-authoritative.

### Tests

- Company-only calendar.
- Branch inheritance.
- Branch-added regional holiday.
- Branch working-day override.
- Full-day, first-half and second-half events.
- Version effective-date boundaries.
- Published-calendar correction.
- Timezone date boundary.
- ACTIVE, SHADOW and LEGACY behavior.
- Multi-tenant isolation.
- Batch parity with single-date preview.

## 5. Work Package A3 — Quality Gate Rehabilitation

### Required repairs

- Repair stale Leave test mocks and relation fixtures so they match the current Prisma model.
- Remove misleading scaffold assertions that only test `toBeDefined`.
- Ensure the default backend test command includes source specifications and foundation/security specifications.
- Fix all lint errors and warnings in changed backend and frontend files.
- Ensure stale Next.js generated types cannot break a clean production build.
- Remove trailing whitespace and generated artifacts from the worktree.

### Block A quality commands

Backend:

```powershell
cd backend
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run lint:check
npm.cmd run build
npm.cmd test
```

Frontend:

```powershell
cd frontend
npm.cmd run lint
pnpm.cmd exec tsc --noEmit
npm.cmd run build
```

Repository:

```powershell
git diff --check
git status --short
```

### Block A exit gate

Block B may begin only when:

- The current developer handoff has been reviewed and its implementation status is documented.
- Confirmed security/tenant blockers are closed.
- Business Calendar runtime tests pass.
- Backend and frontend builds pass.
- Lint has zero errors and zero warnings in the agreed gate.
- The complete applicable automated test suite passes.
- The worktree contains no accidental generated or secret-bearing files.

---

# Block B — Leave Next Phase

## 6. Locked Leave Business Decisions

### 7.1 Terminology

“Role-wise Leave” means **employee Designation-based Leave entitlement**. It does not mean application RBAC role.

### 7.2 Leave Policy precedence

For an Employee, resolve the most specific enabled policy in this order:

1. Branch + Department + Designation.
2. Branch + Designation.
3. Branch + Department.
4. Branch default.

Rules:

- All related records must belong to the same effective Company and authorized Branch.
- An inactive or out-of-scope related record is not eligible.
- A more specific disabled row does not silently enable Leave.
- Duplicate active rules at the same scope are prohibited.
- Resolution must be deterministic and testable.

### 7.3 Approval chain

Default Leave approval is sequential:

1. Reporting Manager.
2. HR approver.

Fallback rules:

- If the reporting manager is missing, inactive, out of scope or otherwise ineligible, the Manager step is recorded as skipped.
- HR approval remains mandatory after Manager approval.
- The same actor cannot complete both Manager and HR steps for the same transaction.
- If no eligible HR approver can be resolved, submission fails without reserving a balance.
- Self-approval is forbidden.
- Only the current pending approver can act.
- Existing transactions retain their approval-step snapshot even when reporting relationships or role assignments later change.

### 7.4 Balance effects

| Action | Pending balance | Used balance | Available balance |
|---|---:|---:|---:|
| Save Draft | No change | No change | No change |
| Submit | Reserve requested days | No change | Reduced by reservation |
| Manager approve | Reservation retained | No change | No additional change |
| HR final approve | Reservation consumed | Increased | Remains reduced |
| Reject before final approval | Reservation released | No change | Restored |
| Cancel before final approval | Reservation released | No change | Restored |
| Cancel approved Leave | Follow existing approved-cancellation rules and create reversal entries | Reversed only when authorized | Restored only by transaction |

Every balance change must create an immutable Leave balance transaction with a unique idempotency key.

### 7.5 Calendar privacy

- Employee: own Leave details only.
- Reporting Manager: authorized reporting-team details needed for approval and capacity planning.
- HR/Company Administrator/Organization Owner: details within active scope.
- Colleague/general availability view: status only; no reason, attachment, private note or approval comment.

## 7. Database and Migration Work Order

### Migration

- Migration name: `leave_policy_matrix_and_manager_hr_approval`.
- Target PostgreSQL schema: `dsp_pms`.
- Use one reviewed additive migration after the current migration chain.
- Do not edit or rename an already applied migration.

### Schema strategy

The approved design requires no new application tables or columns unless implementation inspection proves a required relation is absent. The primary database work is constraints, indexes, workflow configuration and safe backfill.

### Mandatory pre-migration dry-run report

Report without mutation:

- Duplicate active Leave policies at each supported nullable scope.
- Invalid cross-company Branch, Department, Designation or Leave Type references.
- Existing active Leave approval workflows by Global and Company scope.
- Company workflows that differ from the known one-step baseline.
- Pending or in-progress Leave approval transactions.
- Active HR Manager, Company Administrator and Organization Owner role assignments by tenant scope.
- Employees with missing or inactive managers.

### Constraint and index changes

Add partial unique indexes for active Leave policies so nullable dimensions cannot create duplicate logical rules. At minimum, protect:

- Branch default.
- Branch + Department.
- Branch + Designation.
- Branch + Department + Designation.

Add or verify an efficient index for pending approval work by:

- Approver user.
- Approval status.
- Current step/order.
- Company/Branch scope.
- Creation/submission time.

### Workflow configuration

- Global Leave workflow:
  - Step 1: Reporting Manager.
  - Step 2: HR role.
- Known uncustomized one-step Company Leave workflows may be upgraded through reviewed, idempotent migration logic.
- Customized Company workflows must not be overwritten automatically.
- Produce a report listing each customized workflow requiring owner review.
- Existing approval transactions are not rewritten; they keep their snapshot.

### Migration verification

- Apply to an empty disposable PostgreSQL database.
- Apply to a production-shaped disposable snapshot.
- Verify all objects are under `dsp_pms`.
- Verify no existing Leave request, approval result or balance changes.
- Verify repeated deployment does not create duplicate workflow steps or indexes.
- Review generated SQL before any shared-environment deployment.

## 8. Leave Policy Backend Work

### 9.1 Resolver enhancement

Extend the policy resolver with these specificity scores:

| Scope | Specificity |
|---|---:|
| Branch default | 1 |
| Branch + Department | 2 |
| Branch + Designation | 3 |
| Branch + Department + Designation | 4 |

The resolver must:

- Use Employee Company, Branch, Department and Designation snapshots valid for the Leave dates.
- Enforce active tenant relationships.
- Return the selected policy and a safe resolution reason for diagnostics.
- Return a stable domain error when no policy applies.

### 9.2 Read matrix API

Add:

```http
GET /leave-policies/matrix
```

Authorized query scope:

- Company is derived from the active authorization snapshot unless a Global administrator supplies an allowed Company.
- Branch is required for matrix editing.
- Optional Department filter must remain within the same Company/Branch relationship.

Response shape:

```json
{
  "success": true,
  "data": {
    "scope": {
      "companyId": "uuid",
      "branchId": "uuid",
      "departmentId": "uuid-or-null"
    },
    "snapshotToken": "opaque-token",
    "leaveTypes": [],
    "designations": [],
    "cells": [],
    "existingBalanceCount": 0
  }
}
```

The snapshot token must detect stale matrix updates without exposing database internals.

### 9.3 Save matrix API

Add:

```http
PUT /leave-policies/matrix
```

Request shape:

```json
{
  "scope": {
    "companyId": "uuid",
    "branchId": "uuid",
    "departmentId": "uuid-or-null"
  },
  "snapshotToken": "opaque-token",
  "reason": "Annual entitlement configuration",
  "cells": [
    {
      "designationId": "uuid",
      "leaveTypeId": "uuid",
      "enabled": true,
      "annualEntitlement": 18
    }
  ]
}
```

Validation and mutation rules:

- Maximum 1,000 cells per request.
- Every identifier is checked in the effective tenant scope.
- An enabled cell requires entitlement greater than zero and no more than 366 days.
- Disabled or omitted cells soft-disable the corresponding matrix-managed policy; history is not deleted.
- Preserve advanced values already configured on existing policies unless the request explicitly owns those fields.
- Use a serializable transaction or an appropriate PostgreSQL advisory lock for one matrix scope.
- Reject a stale snapshot with `409 STALE_POLICY_MATRIX`.
- Write all policy mutations and one summarized business audit in the same transaction.
- Return created, updated, disabled and unchanged counts.

### 9.4 Existing balances

- Saving the policy matrix never changes existing Employee balances.
- Provide a read-only impact preview showing Employees who lack a balance or whose current balance differs from the new entitlement.
- A separate explicit generation action may create missing balances.
- Existing balances can change only through immutable ledger adjustments with a reason and actor.
- Never silently rewrite used, pending or historical totals.

## 9. Sequential Leave Approval Backend Work

### 10.1 Approval resolver inputs

Resolve approvers from:

- Effective Company and Branch.
- Requesting Employee.
- Active reporting manager.
- Active scoped role assignments.
- Existing approvers already assigned to another step.

### 10.2 Manager eligibility

The reporting manager must be:

- An active Employee/User relationship where required by the current identity model.
- Inside the same Company Group and effective Company.
- Authorized for the Employee's Branch/team.
- Granted `hr.team.approve` or the approved Leave permission.
- Different from the requester.

If ineligible, create a safe skipped Manager step and proceed to HR resolution.

### 10.3 HR fallback order

Resolve the first eligible actor in this order:

1. Branch-scoped HR Manager.
2. Company-scoped HR Manager.
3. Company Group-scoped HR Manager.
4. Company Administrator.
5. Organization Owner.

Rules:

- Global Super Administrator access does not automatically make that user the tenant's operational HR approver.
- Exclude the requester and any actor already assigned to the Manager step.
- Use stable ordering when multiple eligible users exist.
- If no eligible actor exists, submission fails atomically.

### 10.4 Submission transaction

One transaction must:

1. Lock and re-read the Leave request.
2. Verify it is in a submittable state.
3. Resolve the applicable policy and business-day duration.
4. Validate available balance.
5. Resolve Manager and HR approvers.
6. Create the approval transaction snapshot and steps.
7. Mark an ineligible Manager step as skipped when applicable.
8. Make the first actionable step pending.
9. Reserve the balance.
10. Write the immutable balance ledger entry.
11. Update the Leave request state.
12. Write the business audit.
13. Write the sanitized outbox event.
14. Commit.

Any failure rolls back every step, including the balance reservation.

### 10.5 Approval and rejection transitions

- Manager approval completes only the Manager step and activates the HR step.
- Manager approval does not consume the reserved balance.
- HR approval is final and converts the reservation into consumption.
- Rejection at either actionable step releases the reservation.
- Cancellation follows the existing state rules and creates compensating ledger entries where needed.
- Every transition uses a status predicate/version check; a repeated or concurrent action returns `409 STALE_TRANSITION`.
- Audit and outbox writes are transactional with the transition.

### 10.6 Approval queues

- “My Approvals” returns only steps currently actionable by the signed-in user.
- Manager queue is restricted to authorized reporting employees.
- HR queue may show all current HR steps inside the active Company/Branch scope.
- A queue filter cannot widen authorization scope.
- Detail retrieval repeats authorization and current-step checks; list visibility alone is insufficient.

### 10.7 Compatible approval progress

Leave detail may add optional progress information without breaking current consumers:

```json
{
  "approvalProgress": {
    "currentStage": "HR_REVIEW",
    "steps": [
      {
        "stage": "MANAGER_REVIEW",
        "status": "APPROVED",
        "actedAt": "ISO-8601"
      },
      {
        "stage": "HR_REVIEW",
        "status": "PENDING",
        "actedAt": null
      }
    ]
  }
}
```

Public responses must not expose internal role-assignment, workflow-step or tenant identifiers.

### Stable error codes

- `LEAVE_POLICY_NOT_FOUND`
- `LEAVE_BALANCE_INSUFFICIENT`
- `LEAVE_APPROVER_NOT_AVAILABLE`
- `APPROVER_NOT_ELIGIBLE`
- `SELF_APPROVAL_FORBIDDEN`
- `STALE_POLICY_MATRIX`
- `STALE_TRANSITION`
- `BUSINESS_CALENDAR_UNAVAILABLE`

## 10. Calendar Backend Work

### Employee selector

Add:

```http
GET /workforce-calendar/employee-options
```

Return only authorized employees and safe selector fields:

- Employee ID.
- Employee code.
- Display name.
- Designation name.
- Department name.
- Branch name.
- Active status where necessary for filtering.

Authorization:

- Employee can select only self.
- Project Manager can select authorized reporting employees.
- HR/Company Administrator/Organization Owner can select employees inside active Company/Branch scope.
- Foreign identifiers return `404`.

### Calendar event contract

Extend the existing workforce-calendar event contract only with optional compatible fields such as:

- `leaveTypeId`
- `leaveTypeName`
- `leaveStatus`
- `dayPortion`
- `holidayName`
- `approvalStage`

Do not return private Leave reasons or attachments in colleague/general calendar modes.

### Business Calendar consumption

- ACTIVE offices use Business Calendar runtime for working-day and holiday results.
- SHADOW offices compute comparison diagnostics without changing the current Leave result.
- LEGACY offices continue the current calculation.
- Raw Business Event rows are never interpreted directly by Leave services.
- Calendar changes do not recalculate already approved Leave automatically.
- For open requests, an impact preview must be available before applying a published-calendar correction that changes duration.

## 11. Frontend Delivery

Use the existing shared shell, Warm Coral + Teal foundation, shadcn/Radix primitives and the shared FormSheet/right-side drawer pattern. Do not introduce a new component library.

### Work Package B1 — Leave Entitlement Matrix

Add a Company/Branch-scoped HR page with:

- Branch selector restricted to active authorization scope.
- Optional Department filter.
- Designations as rows.
- Leave Types as columns.
- Enabled control and entitlement value per cell.
- Search and compact filtering for large matrices.
- Sticky row/column headers where appropriate.
- Loading skeleton, empty, error and retry states.
- Unsaved-change warning.
- Explicit Save action with reason.
- Stale-update conflict handling and Reload action.
- Existing-balance impact summary after save.

The page configures policy only; it must not imply that balances were automatically changed.

### Work Package B2 — Approval Workspace

Add separate functional views or filters for:

- Manager Review.
- HR Review.
- Completed by Me.

Each approval drawer/detail view shows:

- Employee identity and organization summary.
- Leave Type, dates, portion and calculated business days.
- Non-sensitive reason according to permission.
- Current approval stage.
- Previous step result.
- Balance before and after the pending action.
- Approve and Reject only when the signed-in user is the current eligible approver.
- Mandatory comment for rejection.
- Confirmation dialog for final HR approval.

Do not render disabled fake actions for unauthorized actors.

### Work Package B3 — Personal Leave Calendar

Provide Employee self-service calendar with:

- Own Leave requests and status.
- Business holidays.
- Working/non-working day indicators.
- Shift/attendance overlays only where already supported by the workforce calendar.
- Month and accessible list view.
- Link to the existing Apply Leave flow.
- No colleague private data.

### Work Package B4 — Authorized Employee Calendar

Provide Manager/HR calendar with:

- Authorized Employee selector.
- Branch and Department filters that only narrow scope.
- Month and list view.
- Leave status and type according to permission.
- Business holidays and Branch timezone display.
- Privacy-safe colleague availability.

### Work Package B5 — Holiday Navigation Consolidation

- Link Leave calendar and Holiday views to the Business Calendar source of truth.
- Do not maintain a second editable Holiday source in the Leave module.
- Existing legacy Holiday pages may remain available only while an office is in LEGACY mode.
- Clearly label source/mode during the transition.

### Frontend acceptance criteria

- Existing Apply Leave and Leave detail flows remain compatible.
- Manager and HR see different queues according to the current step.
- No employee can select or inspect an out-of-scope employee.
- Empty, loading, error, stale and success states are complete.
- Keyboard focus is visible and restored after drawer/dialog closure.
- No body-level horizontal overflow at supported widths.
- No fake actions, counts, trends or business data.

## 12. Automated Backend Testing

### Policy and matrix tests

- Exact precedence across all four policy levels.
- Foreign Branch, Department, Designation and Leave Type rejection.
- Duplicate logical-policy prevention with nullable dimensions.
- Disabled and omitted cell behavior.
- Stale snapshot rejection.
- Concurrent matrix save has one winner.
- Matrix save does not change existing balances.
- Audit failure rolls back every matrix mutation.

### Approval resolver tests

- Eligible reporting manager then HR Manager.
- Missing manager produces skipped Manager step.
- Inactive/out-of-scope manager is skipped.
- HR fallback at Branch, Company and Company Group scope.
- Company Administrator and Organization Owner fallback.
- Same actor cannot fill both steps.
- Self-approval forbidden.
- No approver causes complete submission rollback.
- Existing transaction snapshot remains unchanged after role/manager changes.

### Leave transition tests

- Draft has no balance effect.
- Submission reserves once.
- Manager approval retains reservation.
- HR approval consumes once.
- Manager or HR rejection releases once.
- Cancellation creates correct reversal.
- Two concurrent approvals produce exactly one successful transition.
- Audit/outbox/ledger failure rolls back the transition.

### Business Calendar tests

- Leave excludes Company and inherited Branch holidays.
- Branch regional override changes only that Branch.
- Half-day Holiday adjusts requested duration.
- Version effective-date boundary.
- ACTIVE, SHADOW and LEGACY modes.
- Range evaluation parity.
- Published correction does not mutate approved Leave history.

### Security tests

Test list, detail, submit, approve, reject, matrix read/save and calendar access across:

- Different Company Groups.
- Different Companies in one group.
- Different Branches.
- Reporting manager team boundary.
- Employee self-service boundary.

## 13. Disposable-Database Integration Testing

Use a disposable non-AWS PostgreSQL database with `dsp_pms` schema and at least:

- Two Company Groups.
- Two Companies in one group.
- Two Branches with different timezones.
- HR Manager, Company Administrator, Organization Owner and two Project Managers.
- Reporting and non-reporting Employees.
- Designations and Departments with overlapping names across tenants.
- Leave Types, policies, balances and Business Calendars.

Integration scenarios:

1. Configure designation entitlements for Branch A.
2. Prove Branch B and Tenant B are unchanged.
3. Submit Employee A Leave and verify reservation.
4. Manager A approves and HR becomes current.
5. Manager B cannot access or act.
6. HR approves and reservation is consumed.
7. Repeat approval returns `409` with no duplicate ledger entry.
8. Reject another request at Manager and HR stages and verify release.
9. Apply Leave across a Branch-only regional Holiday.
10. Confirm another Branch calculates a different duration.
11. Correct a published calendar and verify approved history is unchanged.
12. Force an audit failure and prove complete rollback.

Never run these destructive scenarios against AWS RDS or `dsp_erp_dev.dsp_pms`.

## 14. Frontend and Browser Testing

Use Chromium browser automation for supported, non-destructive workflows and manual persona verification for authorization-sensitive actions.

Required workflows:

- HR opens and saves the entitlement matrix.
- Stale matrix conflict and reload.
- Employee submits Leave.
- Manager sees only reporting-team request and approves.
- HR sees the second-stage request and approves.
- Unauthorized user cannot discover another tenant's request by URL.
- Personal calendar.
- Manager employee selector and calendar.
- HR Company/Branch calendar.
- Business Calendar Holiday visibility.

Verify at:

- 1440px.
- 1024px.
- 768px.
- 390px.

Accessibility checks:

- Keyboard navigation.
- Visible focus.
- Focus containment and restoration for drawers/dialogs.
- Accessible names for selectors, matrix controls and approval actions.
- Screen-reader announcement of errors and success.
- WCAG AA text/control contrast.
- Reduced-motion behavior.

## 15. Complete Quality Gates

Backend:

```powershell
cd backend
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run lint:check
npm.cmd run build
npm.cmd test
corepack pnpm run test
npm.cmd run test:e2e
```

Frontend:

```powershell
cd frontend
npm.cmd run lint
pnpm.cmd exec tsc --noEmit
npm.cmd run build
pnpm.cmd exec playwright test
```

Repository:

```powershell
git diff --check
git status --short
```

Acceptance:

- All applicable commands pass.
- Zero lint warnings in the release gate.
- No unresolved conflict marker.
- No secret-bearing or generated file is tracked.
- Migration is validated on both empty and production-shaped disposable databases.
- Two-tenant and persona workflow evidence is attached to the release record.
- Passing builds/tests are recorded as technical evidence, not treated as business production approval.

## 16. Rollout Procedure

### Pre-deployment

1. Complete Block A and Block B technical review.
2. Capture database backup evidence.
3. Review generated migration SQL.
4. Confirm active HR/administrator assignments for each pilot tenant.
5. Review missing/ineligible reporting managers.
6. Review customized Company Leave workflows that were not auto-upgraded.
7. Configure Business Calendar mode per pilot office.
8. Confirm Branch timezones and published Calendar Versions.
9. Record expected row counts and migration/backfill results.

### Deployment

1. Deploy the reviewed migration through the standard Prisma deployment process.
2. Deploy backend code with mixed Business Calendar modes supported.
3. Verify health/readiness and migration status.
4. Deploy frontend code.
5. Run smoke tests before enabling pilot access.
6. Enable ACTIVE Business Calendar only for approved pilot offices.

### Pilot verification

1. Configure one Branch entitlement matrix.
2. Generate only explicitly requested missing balances.
3. Submit one Leave request with an eligible Manager.
4. Complete Manager then HR approval.
5. Verify balance ledger, audit and outbox evidence.
6. Verify personal and authorized employee calendars.
7. Verify Branch regional Holiday behavior.
8. Complete HR, Manager and Employee UAT sign-off.

## 17. Rollback Strategy

### Before new Leave transactions use the two-step workflow

- Disable the new frontend navigation and feature flags.
- Return pilot offices to SHADOW or LEGACY Business Calendar mode.
- Roll back application code to the prior reviewed release.
- Reverse only empty additive database objects using reviewed SQL when safe.

### After new two-step approval or ledger records exist

- Do not drop workflow, approval or ledger history.
- Disable new entry points and preserve all records.
- Roll back application code only when compatible with stored records.
- Otherwise deploy a forward-fix migration/application patch.
- Restore from backup only for migration corruption or unrecoverable deployment failure.

## 18. Closure Deliverables

The implementation is not complete until the release record contains:

- Reviewed current-code baseline and developer handoff findings.
- Security/tenant-blocker closure evidence.
- Migration impact report and reviewed SQL.
- Empty and production-shaped disposable migration results.
- Automated test reports.
- Two-tenant security evidence.
- Browser and responsive verification evidence.
- Business Calendar ACTIVE/SHADOW comparison evidence.
- Manager, HR and Employee UAT sign-off.
- Backup evidence and rollback rehearsal notes.
- Known limitations and deferred-scope list.
- Technical closure report.

## 19. Final Release Position

Completion of this work order makes the Leave next phase eligible for a controlled release-candidate and business UAT decision. It does not by itself certify the full ERP as production-ready. Deployment automation, durable observability, alerting, backup-restore drills and any remaining module-level release blockers must still satisfy the wider ERP production-readiness gate.
