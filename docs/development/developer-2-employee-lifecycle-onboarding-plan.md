# Developer 2 — Employee Lifecycle, Onboarding, Documents, and Assets

## Document purpose

This is the complete engineering handoff for Developer 2 in the **ERP Foundation Completion** programme.

Developer 2 starts immediately, works in parallel with Developer 3, and temporarily coordinates Prisma migration sequencing until Developer 1 joins. Developer 2 must use the current authentication and organization context without changing shared authentication, Role, Permission, User, or Session structures.

## Delivery outcome

An authorized HR user must be able to:

1. Create and manage an employee within their scope.
2. Publish a versioned onboarding template.
3. Start onboarding from the current published version.
4. Complete, skip, or reopen onboarding tasks according to business rules.
5. Track onboarding progress accurately.
6. Register and verify employee document metadata.
7. Assign an available asset to an employee.
8. Return, mark lost, or mark damaged an employee asset.
9. View live onboarding, document, and asset data from Employee Detail.

No user may access employee records outside their Company Group, Company, or Branch scope.

## Existing implementation to retain

The following already exist and should be completed rather than replaced:

- Employee CRUD, list, preview, and detail.
- Organization hierarchy and employee relationships.
- Onboarding template, version, department, task-group, and task models.
- Template-version draft, validation, publish, archive, and history backend endpoints.
- Employee onboarding and employee onboarding task models.
- Employee onboarding create/list/detail/complete endpoints.
- Task complete/reopen endpoints.
- Employee document category, type, record, verification, and expiry models/APIs.
- Asset category, type, asset, and employee-asset models/APIs.
- Business audit table and `AuditService`.
- `OrganizationScopeService`.
- Shared Next.js shell, React Query, forms, data tables, and drawers.

Known incomplete areas:

- Onboarding task snapshot is not tied to a template version.
- Generic workflow start/execution services throw “not implemented”.
- Frontend template publish/archive/clone methods throw “not implemented”.
- Several service queries use unscoped IDs.
- Progress totals are not consistently recalculated.
- Employee Detail contains placeholder module content.
- Asset assignment relies mainly on service checks and lacks a database concurrency constraint.

## Start condition

Before implementation:

1. Pull the latest integration branch.
2. Run Prisma validation and migration status.
3. Run current foundation tests and builds.
4. Record counts for onboarding, onboarding tasks, documents, assets, and employee assets.
5. Identify whether shared development contains active onboarding or asset assignments.
6. Reserve the next migration name.
7. Notify Developer 3 before merging the Prisma schema so Developer 3 can rebase before creating the next migration.

## Shared engineering rules

- Schema: `dsp_pms`.
- Do not change User authentication columns, statuses, password/session semantics, Role, Permission, AuthSession, or registration tables. Prisma-only inverse relation fields required for new domain foreign keys may be added to the `User` model, but they must not create or alter User database columns.
- Use the existing authenticated user and request organization context.
- New routes stay hidden/default-protected until Developer 1 activates tenant permissions.
- Domain services perform record-level tenant validation.
- Out-of-scope records return `404`.
- Invalid state transitions return `409` with a stable code.
- Controllers never trust `companyId`, assignee, verifier, or assigned-by authority from request data.
- Business audits record safe status/identifier summaries, not complete employee/document payloads.
- The unfinished generic workflow engine remains inactive.

---

## Work package D2-01 — Employee-domain scope layer

### Purpose

The global organization guard validates Company/Branch IDs explicitly present in a request. It cannot prove that an arbitrary Employee, Template, Document, or Asset ID belongs to the active tenant. Developer 2 must add record-level checks.

### Scope predicate

Create a reusable employee-domain scope builder that maps the request context into Prisma filters.

Global:

- Allowed only for Platform Super Administrator.

Company Group:

- Employee's company must belong to `activeCompanyGroupId`.

Company:

- Employee/company record must match `activeCompanyId`.

Branch:

- Employee/record must match `activeBranchId`.

### Service rules

- Do not load a business record with unrestricted `findUnique({ id })` and return it.
- Use a scope-constrained `findFirst` or load then call a shared scope assertion before any data is returned or changed.
- Child records inherit scope through their Employee, Company, Template, or Asset relation.
- Search, summary, count, export, and aggregate queries use the same scope predicate.
- Scope is applied before pagination, sorting, and counting.

### Apply to

- Employee onboarding.
- Onboarding template/version/workspace.
- Onboarding template task.
- Employee onboarding task.
- Document categories/types/records.
- Employee asset assignments.

### Required tests

- Company Group user can access companies inside the group.
- Company user cannot access another company in the same group.
- Branch user cannot access another branch in the same company.
- Different Company Group always returns not found.
- Search/count/summary cannot leak unauthorized totals.

---

## Work package D2-02 — Database migration: onboarding, documents, and asset integrity

### Migration name

Create:

`employee_onboarding_snapshot_and_asset_integrity`

This migration must be merged before Developer 3 creates the leave/attendance migration.

### `EmployeeOnboarding`

Add:

- `templateVersionId UUID`

Relationship:

- Foreign key to `OnboardingTemplateVersion`.

Indexes:

- `(companyId, status)`
- `(employeeId, status)`
- `templateVersionId`

Concurrency:

- Add a partial unique index allowing only one `IN_PROGRESS` onboarding per employee.

### Existing-data backfill

Before making `templateVersionId` required:

1. Count all onboarding records.
2. Find the current published version for each onboarding's template.
3. Link the onboarding to that version.
4. If a template has no version, create a frozen version representing the template/tasks used by the onboarding.
5. Verify every onboarding has one valid version.
6. Verify the version belongs to the same template.
7. Make `templateVersionId` required.

Do not perform this backfill at application startup.

### `EmployeeOnboardingTask`

Add:

- `sourceTemplateTaskId UUID NULL`
- `dependsOnTaskId UUID NULL`
- `allowSkip BOOLEAN NOT NULL DEFAULT false`
- `allowReopen BOOLEAN NOT NULL DEFAULT true`
- `assignedDepartmentId UUID NULL`
- `assignedDesignationId UUID NULL`

Relations:

- Source task → Onboarding Template Task.
- Dependency → Employee Onboarding Task.
- Assigned department → Department.
- Assigned designation → Designation.
- `assignedToUserId` → User.

Indexes:

- `(onboardingId, status)`
- `(assignedToUserId, status, dueDate)`
- `sourceTemplateTaskId`
- `dependsOnTaskId`

### `EmployeeDocument`

Add:

- `verifiedByUserId UUID NULL`

Relationship:

- Verifier → User.

Indexes:

- `(employeeId, verificationStatus)`
- `(expiryDate, verificationStatus)`

Compatibility:

- Keep the current `verifiedBy` string for one compatibility cycle.
- New code writes `verifiedByUserId`.
- Backfill only values that safely map to an existing User.

Add a PostgreSQL check restricting `verificationStatus` to:

- `PENDING`
- `VERIFIED`
- `REJECTED`
- `EXPIRED`

### `EmployeeAsset`

Add:

- Partial unique index on `assetId` where status is `ASSIGNED` and `returnedDate` is null.

Indexes:

- `(employeeId, status)`
- `(assetId, status)`

Add PostgreSQL checks restricting Employee Asset status to:

- `ASSIGNED`
- `RETURNED`
- `LOST`
- `DAMAGED`

Validate existing Asset master statuses against:

- `AVAILABLE`
- `ASSIGNED`
- `REPAIR`
- `DISPOSED`
- `LOST`

Report and normalize unknown legacy values before enabling constraints.

### Migration preflight queries

Detect and resolve:

- Employees with multiple active onboardings.
- Onboardings with missing employee/template/company.
- Templates without versions.
- Onboarding tasks with invalid dependencies.
- Assets with multiple active assignments.
- Active assignments whose Asset is not `ASSIGNED`.
- Assigned Assets without an active assignment.
- Cross-company employee/document-type relationships.
- Cross-company employee/asset relationships.

### Migration acceptance

- Applies to empty and populated development databases.
- Backfill leaves zero orphan/null required records.
- No unrelated row counts change.
- Existing employee and asset pages still load.

---

## Work package D2-03 — Template version lifecycle

### Supported lifecycle

```text
DRAFT -> PUBLISHED -> ARCHIVED
ARCHIVED -> clone to a new DRAFT
PUBLISHED -> clone to a new DRAFT
```

### Draft

- Only Draft can be edited.
- Creating a draft from another version performs a complete deep clone:
  - Version metadata.
  - Scopes.
  - Departments.
  - Task groups.
  - Tasks.
  - Task dependencies.
- New IDs are generated and dependency links point to the cloned tasks.

### Validation

Publishing validation confirms:

- Template is active.
- At least one applicable scope exists.
- At least one active department/task group exists.
- Required task names/sequences are valid.
- Task dependency belongs to the same version.
- No dependency cycle exists.
- Assigned department/designation/employee belongs to the template company.
- Referenced Document/Asset types belong to the template company.
- Unsupported executable work types are rejected or explicitly treated as manual checklist tasks.

For this release, automated runtime support is limited to:

- `CHECKLIST`
- `DOCUMENT`
- `ASSET`

Other work types must not silently execute through the unfinished generic engine.

### Publish transaction

1. Lock/load the draft version.
2. Re-run validation.
3. Find current published version.
4. Set old current version to archived/not current.
5. Set selected version to published/current.
6. Record publisher from request context.
7. Set publish/effective timestamps.
8. Commit.
9. Write safe audit.

### Archive

- Current published version cannot be manually archived.
- Non-current version may be archived.
- Archived version is read-only.

### Frontend

Replace existing frontend “not implemented” errors with the real:

- Draft.
- Validate.
- Publish.
- Archive.
- History APIs.

---

## Work package D2-04 — Start onboarding transaction

### Request contract

`POST /employee-onboarding`

Input:

```text
employeeId
templateId
startDate
remarks?
```

Remove `companyId` from the public DTO. Derive Company from Employee.

### Transaction flow

1. Scope-load active Employee.
2. Load active Template in Employee's Company.
3. Load its current published version.
4. Reject missing published version with `ONBOARDING_TEMPLATE_NOT_PUBLISHED`.
5. Check no active onboarding exists.
6. Create onboarding with version ID and initial totals.
7. Load version tasks in deterministic department/group/sequence order.
8. Create employee-task snapshots.
9. Build a source-task to employee-task ID map.
10. Recreate dependency links using the new IDs.
11. Calculate due date from start date and `dueDays`.
12. Resolve assignee.
13. Store total tasks, completed tasks, and progress.
14. Commit.
15. Audit creation.

Any failure rolls back onboarding and all tasks.

### Assignee resolution

Use the following precedence:

1. Explicit assigned employee's linked user.
2. `EMPLOYEE` owner → onboarding employee's linked user.
3. `MANAGER` owner → reporting manager's linked user.
4. Explicit assigned designation/department → unresolved owner queue.
5. HR/IT/Finance/Admin owner → unresolved owner queue.

Do not guess a user when multiple employees match a department/designation.

### Error codes

- `EMPLOYEE_NOT_FOUND`
- `ONBOARDING_TEMPLATE_NOT_FOUND`
- `ONBOARDING_TEMPLATE_NOT_PUBLISHED`
- `ACTIVE_ONBOARDING_EXISTS`
- `ONBOARDING_SNAPSHOT_FAILED`

---

## Work package D2-05 — Onboarding task state machine

### Add actions

- Start.
- Complete.
- Skip.
- Reopen.

Existing complete/reopen routes may be retained. Add only missing routes and keep naming consistent.

### Request bodies

Start:

```text
remarks?
```

Complete:

```text
remarks?
```

Skip:

```text
reason
```

Reopen:

```text
reason
```

### Valid transitions

```text
PENDING -> IN_PROGRESS
PENDING -> COMPLETED
IN_PROGRESS -> COMPLETED
PENDING/IN_PROGRESS -> SKIPPED
COMPLETED/SKIPPED -> PENDING
PENDING/IN_PROGRESS/WAITING_APPROVAL -> CANCELLED
```

### Rules

- Completed onboarding cannot be changed.
- Completed task completion is idempotent.
- Dependency must be `COMPLETED`.
- Mandatory task cannot be skipped.
- Skip requires `allowSkip`.
- Reopen requires `allowReopen`.
- Completion records actor and timestamp.
- Reopen clears completion actor/timestamp and increments attempt count.
- Task state update uses a conditional database update.
- Concurrent state change returns `409 TASK_STATE_CHANGED`.

### Progress recalculation

After every task mutation:

1. Count total active tasks.
2. Count completed tasks.
3. Calculate integer percentage.
4. Update onboarding totals/progress.
5. If all mandatory tasks are complete, allow explicit onboarding completion.

Do not automatically complete onboarding if business confirmation is required. The existing completion endpoint remains the final confirmation.

### Onboarding completion

- Reject when any mandatory task is incomplete.
- Set status and completion date.
- Employee onboarding snapshot remains read-only.
- Audit safe completion summary.

### Cancellation

The existing delete/cancel behavior must:

- Scope-check onboarding.
- Reject already completed/cancelled onboarding.
- Mark onboarding cancelled.
- Cancel all unfinished tasks in the same transaction.
- Preserve completed-task history.

---

## Work package D2-06 — Employee documents

### Category/type integrity

- Category belongs to Company.
- Document Type belongs to Category and the same Company.
- Codes/names remain unique per existing constraints.
- In-use Category/Type is deactivated rather than physically deleted where deletion would break history.

### Create document

Input:

- Employee ID.
- Document Type ID.
- Title.
- Optional number.
- Issue/expiry dates.
- Lifetime flag.
- Safe storage metadata/reference.
- Remarks.

Server checks:

- Employee and type belong to the same authorized Company.
- Required document number is present.
- Expiry-required type has expiry unless lifetime is allowed and selected.
- Lifetime document has no expiry.
- Issue date is not after expiry.
- File size/mime metadata is within configured policy if supplied.

### Verification lifecycle

```text
PENDING -> VERIFIED
PENDING -> REJECTED
REJECTED/VERIFIED -> PENDING (reset by authorized manager)
```

Rules:

- Actor comes from request context.
- Verification timestamp is server-generated.
- Reject requires a safe reason.
- Repeated same-state request is idempotent or returns a stable conflict.
- Expiry does not erase verification history.

### Queries

- Lists and summaries are scope-filtered.
- Expiry search is scope-filtered.
- Employee Detail uses the same API, not a separate unguarded query.
- No sensitive storage references appear in logs.

### Storage boundary

This plan supports document metadata plus a private storage reference. It does not add direct binary upload, S3 credentials, public URLs, or file streaming.

---

## Work package D2-07 — Employee asset assignment

### Assign request

Input:

```text
employeeId
assetId
assignedDate
remarks?
```

Do not accept `assignedById` from the frontend. Derive actor from request context and map to Employee only if needed by the existing model.

### Assignment transaction

1. Scope-load employee.
2. Scope-load asset.
3. Confirm compatible Company/Branch.
4. Confirm asset is active and `AVAILABLE`.
5. Create assignment.
6. Change asset status to `ASSIGNED`.
7. Commit.
8. Audit safe identifiers/status.

The database partial unique index is the final concurrency protection.

### Return request

Input:

```text
outcome = RETURNED | LOST | DAMAGED
returnedDate
remarks?
```

Transaction:

1. Scope-load active assignment.
2. Reject duplicate return.
3. Store return actor/date/outcome.
4. `RETURNED` makes Asset `AVAILABLE`.
5. `LOST` makes Asset `LOST`.
6. `DAMAGED` makes Asset `REPAIR`.
7. Commit and audit.

### Error codes

- `ASSET_NOT_AVAILABLE`
- `ASSET_ALREADY_ASSIGNED`
- `ASSET_ASSIGNMENT_NOT_FOUND`
- `ASSET_ALREADY_RETURNED`
- `EMPLOYEE_ASSET_COMPANY_MISMATCH`

---

## Work package D2-08 — Frontend implementation

### Onboarding templates

- Dashboard/list.
- Create/edit Draft.
- Version history.
- Validation results.
- Publish confirmation.
- Archive action.
- Clone action.

### Employee onboarding

- Start-onboarding right-side drawer.
- Search/select Employee and published Template.
- Onboarding list with status/progress.
- Onboarding detail grouped by department/task group.
- Start, complete, skip, reopen controls.
- Unassigned owner queues.
- Completion and cancellation confirmation.

### Employee Detail

Activate only real tabs:

- Overview.
- Employment.
- Documents.
- Onboarding.
- Leave when Developer 3 integrates.
- Assets.

Remove placeholder text for completed modules.

### Documents

- Category/type management.
- Document register.
- Create/edit drawer.
- Verification/rejection/reset.
- Expiry indicators.

### Assets

- Assignment history.
- Assign Asset drawer.
- Return/lost/damaged action.
- Status and empty states.

### UI requirements

- Existing shared components.
- Keyboard operation.
- Focus restoration after drawer/dialog close.
- No body overflow.
- Loading skeleton.
- Empty state.
- Retryable error.
- Permission denied.
- Conflict messages using stable backend codes.

---

## Work package D2-09 — Tests

### Onboarding

- Published-version immutability.
- Deep-clone dependency remapping.
- Publish concurrency.
- Concurrent onboarding start.
- Snapshot rollback.
- Dependency blocking.
- Mandatory skip rejection.
- Reopen policy.
- Concurrent completion.
- Progress accuracy.
- Completion blocking.
- Cancellation behavior.

### Documents

- Cross-tenant Employee/Type mismatch.
- Required document number.
- Lifetime/expiry validation.
- Verification permissions.
- Rejection/reset.
- Expiry summaries.
- Sensitive-field log redaction.

### Assets

- Cross-tenant assignment.
- Cross-company assignment.
- Concurrent assignment.
- Return idempotency.
- Lost/damaged status.
- Asset and assignment transaction rollback.

### Browser checks

- Template creation through publish.
- Employee onboarding start through completion.
- Document create/verify.
- Asset assign/return.
- Employee Detail live tabs.
- Responsive behavior at 1440px, 1024px, 768px, and 390px.

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

## Migration coordination and deployment

Developer 2 temporarily owns the migration ledger.

Procedure:

1. Rebase onto latest integration branch.
2. Record migration status and table counts.
3. Create migration against a disposable local PostgreSQL database.
4. Review every SQL statement.
5. Confirm all objects target `dsp_pms`.
6. Test migration and backfill against a development-data copy.
7. Run tests and builds.
8. Merge the migration separately.
9. Notify Developer 3 to rebase.
10. Apply to shared development with `prisma migrate deploy`.
11. Verify status, counts, foreign keys, and indexes.

Never use `prisma db push` on AWS RDS. Never mark a migration as applied unless its SQL ran.

---

## Handoff to Developer 3

Provide typed summary services or contracts for:

- Active onboarding count.
- Pending onboarding task count.
- Employee onboarding progress.
- Assigned employee assets.

These summaries must accept the same organization-scope predicate used by all domain queries.

Developer 3 may build dashboard widgets against mocks before these contracts are live, then replace the mocks during integration.

## Handoff to Developer 1

Provide:

- Complete route list.
- Read/manage behavior for each endpoint.
- Recommended permission mapping.
- Tenant-scope tests.
- Any endpoint temporarily accessible only through `platform.admin`.

Developer 1 activates:

- `hr.onboarding.read/manage`
- `hr.documents.read/manage`
- `assets.assignments.read/manage`

---

## Definition of done

- Every Employee/Onboarding/Document/Asset query is tenant-safe.
- New onboarding uses a published immutable version.
- Active onboarding tasks are snapshots.
- Dependencies and task transitions are enforced.
- Progress remains correct under concurrent requests.
- Document verification records the authenticated user.
- The same Asset cannot be assigned twice.
- Employee Detail contains real Documents, Onboarding, and Assets data.
- Dashboard summary contracts are available to Developer 3.
- Routes, permission needs, and cross-tenant evidence are handed to Developer 1.
- Migration is validated and applied without unrelated data changes.

## Explicitly deferred

- Generic cross-domain workflow runtime.
- Automatic execution of unsupported work types.
- Binary document upload and storage.
- Antivirus/file-content scanning.
- Offboarding and employee separation workflow.
- Procurement-driven asset acquisition.
- Projects, CRM, payroll, finance, and BIM.
