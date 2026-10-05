# Onboarding V2 — Database and API Implementation Plan

**Document status:** Approved implementation contract  
**Prepared:** 2026-08-18  
**Reviewed code baseline:** 563f4d4b86e45e1ad3c5303ff0ecac3919d0f0c0  
**Implementation status:** Documentation only; this document does not prove code, migration, deployment, or UAT completion  
**Companion UI plan:** [Onboarding UI Implementation Plan](./onboarding-ui-implementation-plan.md)  
**Product boundary:** [Onboarding Department Flow](../product/onboarding-department-flow-gap-explained.md)  
**Asset dependency:** [Asset Management DB/API Implementation Plan](./asset-management-db-api-implementation-plan.md)  
**Recruitment backend review:** [Recruitment to Onboarding API Code Review](./recruitment-to-onboarding-api-code-review.md)  
**Recruitment frontend review:** [Recruitment to Onboarding UI Code Review](./recruitment-to-onboarding-ui-code-review.md)

## 1. Authority and outcome

This document is the source of truth for the Onboarding V2 database schema, permissions, public API, internal commands, state transitions, concurrency, idempotency, notifications, migrations, testing, and rollout gates.

The frontend must consume server responses and server-calculated allowedActions. It must not reproduce authorization, task-transition, progress, dependency, or Asset-eligibility rules locally.

The required production outcome is:

1. A published designation/Branch template assigns support work to Departments, never named people.
2. Starting Onboarding creates immutable task snapshots.
3. Employee and Manager tasks resolve from the hire record.
4. Department tasks enter an unassigned Department queue.
5. Permission plus the actor's active Employee Department determines Department visibility.
6. A permitted Department assigner assigns work to an active member of that Department.
7. Only the assigned User executes normal work.
8. Asset tasks create authoritative Asset custody or licence allocation in the same transaction as task completion.
9. HR monitors globally, while a separate audited override permission handles exceptional intervention.
10. Final completion revalidates every mandatory task transactionally and starts Probation where applicable.

## 2. Locked scope and deferred behavior

### 2.1 Included

- Designation and Branch-specific template resolution.
- Draft, validation, publish, clone, archive, and history lifecycle.
- Department, Employee, and Manager execution owners.
- Checklist execution.
- Physical/card Asset assignment and software licence allocation through Asset V2.
- Department and personal task queues.
- Assignment, reassignment, unassignment, start, complete, skip, reopen, waive, cancel, and final completion.
- Server allowedActions and blocked reasons.
- Optimistic concurrency and idempotent commands.
- Safe audit, action evidence, notifications, reminders, and operational metrics.
- Recruitment conversion and Probation integration.
- Additive migration, controlled reconciliation, feature-gated rollout, and real PostgreSQL testing.

### 2.2 Deferred

- Employee Document upload/verification automation.
- Approval workflow execution and WAITING_APPROVAL behavior.
- Generic workflow runtime, execution profiles, rules, and contributions as runtime authority.
- RESOURCE, TRAINING, FORM, MEETING, MEDICAL, EMAIL, CUSTOM, and other automatic work types.
- Offboarding and separation workflows, except preserving authoritative Asset custody on cancellation.
- Guessing equivalent Departments across Branches by name or code.

Unsupported behavior must be rejected at publish. It must not silently execute as a checklist.

## 3. Current implementation to retain and replace

### 3.1 Retain

- Current published-version snapshot pattern.
- Deterministic Department, task-group, and sequence ordering.
- Source-template task and dependency remapping.
- Due-date snapshot from start date and dueDays.
- Existing AuditService transaction support.
- Recruitment lifecycle transition service and career events.
- Existing partial unique index preventing two IN_PROGRESS Onboardings per Employee.
- Existing Employee and Manager User relations used for runtime resolution.
- Existing Asset V2 internal transaction boundary once its final implementation is committed.

### 3.2 Replace or harden

- Replace manual template selection on the normal start route.
- Replace duplicated Recruitment template resolution with one shared transaction-aware resolver.
- Replace broad HR task mutation with actor-scoped capability checks.
- Replace the generic TaskStatus columns with dedicated Onboarding statuses.
- Replace local progress calculations with one authoritative server definition.
- Replace arbitrary assignedDepartmentId input with Department inheritance from the task's enclosing Department slice.
- Remove named Employee and Designation assignment from new template DTOs.
- Reject invalid owner values and unfinished approval/generic workflow fields at publish.
- Scope every template administration query, including workspace assemblers and nested create/update operations.
- Move mandatory-task completion validation inside the completion transaction.

## 4. Domain decisions

### 4.1 Department authority

Do not add Department.headEmployeeId and do not add an Onboarding-specific Department grant table.

Department authority is the intersection of:

- an authenticated active User;
- an active User-linked Employee;
- the Employee's current companyId, branchId, and departmentId;
- the required Onboarding Department permission;
- the User's active RoleAssignment organization scope.

A User with hr.onboarding.department.assign is the Department head/delegate for this workflow. Multiple delegates are allowed. A User may view personal assigned work through hr.self.read even without Department queue permission.

### 4.2 Owners

Newly published task owner types are:

| Owner | Runtime behavior |
|---|---|
| DEPARTMENT | Enters the enclosing Department's queue without a named assignee |
| EMPLOYEE | Resolves to the onboarding Employee's linked User |
| MANAGER | Resolves to the onboarding Employee's reporting Manager's linked User |

Legacy HR, IT, FINANCE, ADMIN, and SYSTEM values remain readable only until historical reconciliation. They cannot be written to a new draft or published.

### 4.3 Branch rule

Departments are Branch-bound. A template containing Department-owned tasks is therefore concrete to a Branch.

- Resolution still checks Branch override before Designation default.
- A default template may be used only when every Department in its published version belongs to the Employee's Branch.
- A mismatch returns ONBOARDING_TEMPLATE_BRANCH_MISMATCH.
- Another Branch requires its own Branch assignment and published template/version, normally created through clone-and-remap.
- The server never maps Departments by matching names or codes.

### 4.4 Work types

| Work type | Supported | Completion |
|---|---:|---|
| CHECKLIST | Yes | Assigned actor completes or HR override completes/waives |
| ASSET with INDIVIDUAL tracking | Yes | Asset V2 physical/card assignment |
| ASSET with POOL tracking | Yes | Asset V2 software licence allocation |
| ASSET with LOCATION tracking | No | Publish error |
| DOCUMENT and all other types | No | Publish error |

### 4.5 Due dates

For this release, dueDays preserves the existing calendar-day meaning. Dates are calculated from the Onboarding start date and rendered/evaluated in the Employee Branch timezone.

OVERDUE is derived when:

- task status is PENDING or IN_PROGRESS; and
- dueDate is earlier than the current Branch business date/time.

## 5. Prisma and PostgreSQL contract

### 5.1 Enums

Add or extend these enums:

~~~prisma
enum WorkOwnerType {
  DEPARTMENT
  EMPLOYEE
  MANAGER

  // Legacy compatibility only for Onboarding.
  HR
  IT
  FINANCE
  ADMIN
  SYSTEM
}

enum EmployeeOnboardingStatus {
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

enum EmployeeOnboardingTaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  SKIPPED
  WAIVED
  CANCELLED
}

enum OnboardingContractVersion {
  LEGACY_V1
  V2
}

enum OnboardingTemplateResolutionSource {
  BRANCH_OVERRIDE
  DESIGNATION_DEFAULT
  DESIGNATION_LEGACY_FALLBACK
  PRIVILEGED_OVERRIDE
}

enum OnboardingSourceType {
  RECRUITMENT_APPLICATION
  MANUAL
  LEGACY
}

enum OnboardingTaskResultType {
  EMPLOYEE_ASSET
  SOFTWARE_LICENSE_ALLOCATION
}

enum OnboardingTaskActionType {
  ASSIGNED
  REASSIGNED
  UNASSIGNED
  STARTED
  COMPLETED
  OVERRIDE_COMPLETED
  SKIPPED
  AUTO_SKIPPED
  REOPENED
  WAIVED
  CANCELLED
}

enum OnboardingActionAuthorityMode {
  NORMAL
  HR_OVERRIDE
  SYSTEM
}

enum OnboardingCommandType {
  CREATE_TEMPLATE
  UPDATE_TEMPLATE
  CREATE_TEMPLATE_DRAFT
  WRITE_TEMPLATE_DRAFT
  VALIDATE_TEMPLATE_VERSION
  PUBLISH_TEMPLATE_VERSION
  ARCHIVE_TEMPLATE_VERSION
  ARCHIVE_TEMPLATE
  CREATE_DESIGNATION_ASSIGNMENT
  UPDATE_DESIGNATION_ASSIGNMENT
  DEACTIVATE_DESIGNATION_ASSIGNMENT
  START
  OVERRIDE_START
  ASSIGN_TASK
  UNASSIGN_TASK
  START_TASK
  COMPLETE_TASK
  SKIP_TASK
  REOPEN_TASK
  FULFILL_ASSET_TASK
  WAIVE_TASK
  COMPLETE_ONBOARDING
  CANCEL_ONBOARDING
}
~~~

Do not remove the generic TaskStatus enum because other modules may still use it.

### 5.2 Template aggregate

Add a rowVersion optimistic token to mutable draft aggregates. Keep versionNo as the published business version number:

~~~prisma
model OnboardingTemplate {
  // existing fields
  version Int @default(1)

  @@unique([companyId, id])
}

model OnboardingTemplateVersion {
  // existing fields
  companyId String
  rowVersion Int @default(1)

  @@unique([companyId, id])
  @@unique([companyId, onboardingTemplateId, id])
}

model OnboardingDepartmentTemplate {
  // existing fields
  companyId String
  branchId String
  rowVersion Int @default(1)

  @@unique([companyId, id])
  @@unique([companyId, onboardingTemplateVersionId, id])
  @@unique([companyId, onboardingTemplateVersionId, departmentId])
  @@unique([companyId, onboardingTemplateVersionId, displayOrder])
}

model OnboardingTaskGroup {
  // existing fields
  companyId String
  onboardingTemplateVersionId String
  rowVersion Int @default(1)

  @@unique([companyId, id])
  @@unique([companyId, onboardingTemplateVersionId, id])
  @@unique([companyId, onboardingDepartmentTemplateId, displayOrder])
}

model OnboardingTemplateTask {
  // existing fields
  companyId String
  onboardingTemplateVersionId String
  rowVersion Int @default(1)

  @@unique([companyId, id])
  @@unique([companyId, onboardingTemplateVersionId, id])
  @@unique([companyId, taskGroupId, sequenceNo])
}
~~~

Rules:

- versionNo is business history; rowVersion is optimistic concurrency.
- Add companyId to Version, Department slice, Task Group, and Task during expand and backfill it through the parent Template.
- Add onboardingTemplateVersionId to Task Group and Task so same-Version dependency and hierarchy constraints are enforceable without trusting a client join path.
- Add branchId to each Department slice and derive it from its Department; it is immutable after the slice is created.
- Every nested model has @@unique([companyId, id]); Version also has @@unique([companyId, onboardingTemplateId, id]), and Task has @@unique([companyId, onboardingTemplateVersionId, id]).
- Version relates to Template by (companyId, onboardingTemplateId). Department slice relates to Version by (companyId, onboardingTemplateVersionId) and Department by (companyId, branchId, departmentId). Task Group relates to its Department slice and Version through Company-qualified keys. Task relates to its Group and Version through Company-qualified keys.
- dependsOnTaskId uses (companyId, onboardingTemplateVersionId, dependsOnTaskId) so a database FK rejects a foreign-Company or foreign-Version dependency.
- Published and archived versions remain immutable.
- ownerType is required before publish.
- For DEPARTMENT, the executor Department is derived from taskGroup.departmentTemplate.departmentId.
- assignedEmployeeId and assignedDesignationId remain nullable historical columns but are absent from V2 write DTOs.
- assignedDepartmentId remains compatibility data during expand/backfill. New services derive and write the enclosing Department. The contract migration may rename it to executorDepartmentId after all consumers move.

#### 5.2.1 Designation Template assignment

Harden DesignationOnboardingAssignment as the effective-dated resolver record:

~~~prisma
model DesignationOnboardingAssignment {
  id        String @id @default(uuid())
  companyId String
  designationId String
  branchId String?
  onboardingTemplateId String

  effectiveFrom DateTime
  effectiveTo   DateTime?
  isActive Boolean @default(true)
  version Int @default(1)

  createdByUserId String
  updatedByUserId String
  deactivatedAt DateTime?
  deactivatedByUserId String?
  deactivationReason String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, id])
  @@index([companyId, designationId, branchId, isActive, effectiveFrom])
}
~~~

Relations are Company-qualified: Designation by (companyId, designationId), optional Branch by (companyId, branchId), and Template by (companyId, onboardingTemplateId), all Restrict. Add an effectiveTo >= effectiveFrom check.
Deactivation actor/timestamp/reason are an all-or-none protected evidence group, and isActive=false is required when the group is populated. Ordinary list, audit, notification, receipt, log, and telemetry mappers omit deactivationReason.

Replace the current one-active-row partial indexes with non-overlap protection so a future non-overlapping assignment can be scheduled:

~~~sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE designation_onboarding_assignments
ADD CONSTRAINT designation_onboarding_default_effective_excl
EXCLUDE USING gist (
  "designationId" WITH =,
  tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'), '[]') WITH &&
)
WHERE ("branchId" IS NULL AND "isActive" = true);

ALTER TABLE designation_onboarding_assignments
ADD CONSTRAINT designation_onboarding_branch_effective_excl
EXCLUDE USING gist (
  "designationId" WITH =,
  "branchId" WITH =,
  tsrange("effectiveFrom", COALESCE("effectiveTo", 'infinity'), '[]') WITH &&
)
WHERE ("branchId" IS NOT NULL AND "isActive" = true);
~~~

If btree_gist is not approved in the target PostgreSQL service, implement equivalent deferred constraint triggers plus serializable write commands. Do not rely on application pre-check alone. Preflight must prove the extension/constraint strategy used by the target database.

### 5.3 EmployeeOnboarding

Target shape:

~~~prisma
model EmployeeOnboarding {
  id        String @id @default(uuid())
  companyId String
  branchId  String
  branchTimeZoneAtStart String?
  employeeId String

  departmentIdAtStart  String?
  designationIdAtStart String?

  templateId        String
  templateVersionId String?
  designationOnboardingAssignmentId String?
  templateResolutionSource OnboardingTemplateResolutionSource?

  sourceType OnboardingSourceType?
  sourceId   String?
  recruitmentApplicationId String?

  status EmployeeOnboardingStatus @default(IN_PROGRESS)
  contractVersion OnboardingContractVersion @default(V2)
  version Int @default(1)

  totalTasks     Int @default(0)
  completedTasks Int @default(0)
  skippedTasks   Int @default(0)
  waivedTasks    Int @default(0)
  terminalTasks  Int @default(0)
  mandatoryRemaining Int @default(0)
  progress       Int @default(0)

  startDate DateTime
  startedByUserId String?

  completedAt DateTime?
  completedByUserId String?

  cancelledAt DateTime?
  cancelledByUserId String?
  cancellationReason String?

  overrideStartedAt DateTime?
  overrideStartedByUserId String?
  overrideStartReason String?
  overrideAutomaticTemplateId String?
  overrideResolutionFailureCode String?

  remarks String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tasks EmployeeOnboardingTask[]

  @@unique([companyId, id])
  @@unique([companyId, id, employeeId])
  @@index([companyId, branchId, status])
  @@index([employeeId, status])
  @@index([templateVersionId])
  @@index([sourceType, sourceId])
}
~~~

Source and actor rules:

- Fields shown as nullable solely for compatibility (Branch timezone, Department/Designation/Version/resolution/source snapshots and task Company/Branch/Employee/workstream/Version snapshots) are mandatory for V2 through employee_onboarding_v2_required_shape_check, employee_onboarding_task_v2_required_shape_check, and the contract-version trigger. They remain physically nullable so an evidence-poor LEGACY_V1 row can be preserved without fabricated data.
- contractVersion is immutable to ordinary writes. Every new V2 start and Recruitment conversion writes V2 explicitly. Existing rows are first marked LEGACY_V1 and may be promoted exactly once, for the complete aggregate, only by the controlled reconciliation command after every V2 invariant and actor-evidence field has been proved.
- LEGACY_V1 is a read-only compatibility classification, not a weaker write path. Runtime commands against it fail with ONBOARDING_LEGACY_RECONCILIATION_REQUIRED. Completed historical rows may remain LEGACY_V1 indefinitely; no actor, reason, result, or Department evidence is fabricated merely to satisfy a new check.
- For RECRUITMENT_APPLICATION, sourceId and recruitmentApplicationId are both required and equal. The latter is a Restrict FK to JobApplication; a trigger verifies the Application resolves through its Job Opening to the same Company as the Employee Onboarding.
- For MANUAL, sourceId and recruitmentApplicationId are null.
- For LEGACY, sourceId may contain a stable migration identifier, while recruitmentApplicationId is null.
- The partial source unique makes one Onboarding the only Onboarding for a Recruitment Application, including after it is completed or cancelled.
- startedByUserId is required for every new V2 row. Historical rows may remain null only when no authoritative User can be established.
- completedAt/completedByUserId and cancelledAt/cancelledByUserId/cancellationReason are all-or-none evidence groups for their applicable transitions.
- A privileged override requires overrideStartedAt/overrideStartedByUserId/overrideStartReason plus exactly one comparison outcome: overrideAutomaticTemplateId when normal resolution succeeded, or overrideResolutionFailureCode when it failed.
- branchTimeZoneAtStart is the validated IANA timezone used for due-date business rules and remains the display context even if Branch configuration later changes.
- overrideResolutionFailureCode is restricted to ONBOARDING_TEMPLATE_NOT_CONFIGURED, ONBOARDING_TEMPLATE_NOT_PUBLISHED, or ONBOARDING_TEMPLATE_BRANCH_MISMATCH.
- Cancellation and override reasons are protected fields. Ordinary list/detail, AuditLog, notification, receipt snapshot, log, and telemetry mappers omit them.

Keep completedDate as a compatibility mirror during rolling deployment. New code writes completedAt and completedDate in the same transaction until every consumer has moved.

The raw migration preserves/recreates:

~~~sql
CREATE UNIQUE INDEX "employee_onboarding_one_active_per_employee_idx"
ON "EmployeeOnboarding" ("employeeId")
WHERE "status" = 'IN_PROGRESS';

CREATE UNIQUE INDEX "employee_onboarding_one_recruitment_source_idx"
ON "EmployeeOnboarding" ("recruitmentApplicationId")
WHERE "recruitmentApplicationId" IS NOT NULL;

CREATE UNIQUE INDEX "onboarding_template_one_current_published_idx"
ON "OnboardingTemplateVersion" ("onboardingTemplateId")
WHERE "status" = 'PUBLISHED' AND "isCurrent" = true;

CREATE UNIQUE INDEX "employee_career_event_onboarding_source_idx"
ON employee_career_events ("employeeId", "eventType", "sourceModule", "sourceRecordId")
WHERE "sourceModule" = 'ONBOARDING';
~~~

### 5.4 EmployeeOnboardingTask

Target shape:

~~~prisma
model EmployeeOnboardingTask {
  id           String @id @default(uuid())
  onboardingId String

  companyId  String?
  branchId   String?
  employeeId String?

  workstreamDepartmentId String?
  executorDepartmentId   String?

  taskName    String
  description String?
  sequenceNo  Int
  priority    Int @default(0)
  isMandatory Boolean

  workType     WorkType
  ownerType    WorkOwnerType
  referenceType ReferenceType?
  referenceId   String?

  sourceTemplateTaskId String?
  templateVersionId    String?
  dependsOnTaskId      String?

  status      EmployeeOnboardingTaskStatus @default(PENDING)
  contractVersion OnboardingContractVersion @default(V2)
  version Int @default(1)
  attemptNo   Int @default(1)

  allowSkip   Boolean @default(false)
  allowReopen Boolean @default(true)

  assignedToUserId String?
  assignedByUserId String?
  assignedAt DateTime?

  startedAt DateTime?
  dueDate    DateTime?
  resolvedAt DateTime?
  resolvedByUserId String?

  resultType OnboardingTaskResultType?
  employeeAssetId String?
  softwareLicenseAllocationId String?

  lastReminderDate DateTime?
  nextReminderDate DateTime?
  remarks String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  actionEvents OnboardingTaskActionEvent[]

  @@unique([companyId, id])
  @@unique([companyId, id, employeeId])
  @@unique([companyId, onboardingId, id])
  @@index([companyId, branchId, executorDepartmentId, status, dueDate])
  @@index([assignedToUserId, status, dueDate])
  @@index([companyId, status, nextReminderDate])
  @@index([onboardingId, status])
  @@index([employeeId, status])
  @@index([sourceTemplateTaskId])
  @@index([dependsOnTaskId])
}
~~~

Keep assignedDepartmentId, assignedDesignationId, startedDate, completedDate, and completedByUserId as compatibility mirrors until old consumers are removed. Do not accept them from V2 runtime DTOs.

The nullable Company/Branch/Employee/workstream/Version snapshot columns above are compatibility storage only. Every V2 service maps a row to the strict V2 domain type only after the required-shape guard succeeds; normal V2 repositories never expose nullable snapshots.

### 5.5 Action evidence

~~~prisma
model OnboardingTaskActionEvent {
  id        String @id @default(uuid())
  companyId String
  onboardingId String
  taskId    String

  action OnboardingTaskActionType
  authorityMode OnboardingActionAuthorityMode

  fromStatus EmployeeOnboardingTaskStatus?
  toStatus   EmployeeOnboardingTaskStatus

  fromAssigneeUserId String?
  toAssigneeUserId   String?
  actorUserId        String

  reason String?
  operationId String
  taskVersionBefore Int
  taskVersionAfter  Int
  assetAttemptNo Int?
  resultType OnboardingTaskResultType?
  employeeAssetId String?
  softwareLicenseAllocationId String?

  createdAt DateTime @default(now())

  @@unique([companyId, operationId, taskId, action])
  @@index([taskId, createdAt])
  @@index([onboardingId, createdAt])
}
~~~

reason is protected workflow evidence:

- maximum 1,000 characters;
- returned only to a current participant or hr.onboarding.override;
- omitted from ordinary lists, notifications, logs, and generic AuditLog payloads;
- never stored in a command response snapshot.

authorityMode records whether the action used normal assignee/Department authority, hr.onboarding.override, or a system cascade from start/final completion/cancellation. Capability checks and audit history must never infer this later from the actor's current roles.

For Asset completion or a later reopen, the event stores the applicable attempt number and prior/current custody or allocation reference. Those result references are Restrict history FKs and are visible only through the scoped task history response.

### 5.6 Command receipts

~~~prisma
model OnboardingCommandReceipt {
  id        String @id @default(uuid())
  companyId String
  operationId String
  commandType OnboardingCommandType
  actorUserId String

  requestHash String
  requestHashKeyVersion String
  requestHashFormatVersion Int @default(1)

  resultEntityType String?
  resultEntityId   String?
  safeResultSnapshot Json?
  completedAt DateTime?

  createdAt DateTime @default(now())

  @@unique([companyId, operationId])
  @@index([resultEntityType, resultEntityId])
}
~~~

Canonical request rules:

- Build a command-specific object after DTO transforms.
- Use fixed sorted keys, lowercase UUIDs, ISO dates, normalized strings, explicit nulls, and omitted absent fields.
- Serialize as UTF-8 canonical JSON.
- Calculate lowercase hexadecimal HMAC-SHA-256 with the active Onboarding idempotency key.
- Store both HMAC key version and canonical format version.
- Retain every key version referenced by a receipt.
- Do not reuse the Asset card/HMAC key domain.
- A repeated operationId with the same command/hash returns the same command outcome without repeating side effects and sets X-Idempotent-Replay: true.
- A different command/hash returns 409 OPERATION_ID_REUSED.
- Replay revalidates current authentication, permission, organization scope, Department scope, and response-field visibility before returning.
- Claim inserts a receipt with nullable result fields inside the business transaction. Before commit, the command writes resultEntityType, resultEntityId, safeResultSnapshot, and completedAt together.
- A deferred constraint trigger rejects commit unless those four result fields are all populated. A crash rolls back the uncommitted receipt with the rest of the command, so no permanently PROCESSING receipt remains.
- safeResultSnapshot contains only result IDs, versions, statuses, resolution source, and replay metadata. It never contains Employee names, reasons, remarks, Asset identifiers beyond authorized result IDs, permissions, hashes, or notification payloads.
- On replay, revalidate current authorization, use safeResultSnapshot to prove the original outcome, then scoped-load the current typed resource projection. Response metadata includes replayedOperationResultVersion when the resource has changed since the original command; the command is never executed again.
- V2 receipts are append-only and are not purged. Every referenced HMAC key and canonical format version remains readable. Any future retention policy requires a separate audited design that preserves duplicate prevention and replay semantics.

### 5.7 Required SQL checks

Name and map every check:

~~~sql
ALTER TABLE designation_onboarding_assignments
ADD CONSTRAINT designation_onboarding_effective_shape_check
CHECK (
  ("effectiveTo" IS NULL OR "effectiveTo" >= "effectiveFrom") AND
  (
    num_nonnulls("deactivatedAt", "deactivatedByUserId", "deactivationReason") = 0 OR
    (
      num_nonnulls("deactivatedAt", "deactivatedByUserId", "deactivationReason") = 3 AND
      "isActive" = false AND nullif(btrim("deactivationReason"), '') IS NOT NULL
    )
  )
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_v2_required_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR
  num_nonnulls(
    "companyId", "branchId", "branchTimeZoneAtStart", "employeeId",
    "departmentIdAtStart", "designationIdAtStart", "templateId",
    "templateVersionId", "templateResolutionSource", "sourceType",
    "startDate", "startedByUserId", "version"
  ) = 13
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_v2_required_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR
  num_nonnulls(
    "onboardingId", "companyId", "branchId", "employeeId",
    "workstreamDepartmentId", "taskName", "sequenceNo", "isMandatory",
    "workType", "ownerType", "templateVersionId", "status", "version", "attemptNo"
  ) = 14
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_terminal_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    (
      "status" = 'IN_PROGRESS' AND
      "completedAt" IS NULL AND "completedByUserId" IS NULL AND
      "cancelledAt" IS NULL AND "cancelledByUserId" IS NULL AND "cancellationReason" IS NULL
    ) OR
    (
      "status" = 'COMPLETED' AND
      "completedAt" IS NOT NULL AND "completedByUserId" IS NOT NULL AND
      "cancelledAt" IS NULL AND "cancelledByUserId" IS NULL AND "cancellationReason" IS NULL
    ) OR
    (
      "status" = 'CANCELLED' AND
      "cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL AND nullif(btrim("cancellationReason"), '') IS NOT NULL AND
      "completedAt" IS NULL AND "completedByUserId" IS NULL
    )
  )
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_source_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    (
      "sourceType" = 'RECRUITMENT_APPLICATION' AND
      "sourceId" IS NOT NULL AND
      "recruitmentApplicationId" IS NOT NULL AND
      "sourceId" = "recruitmentApplicationId"
    ) OR
    ("sourceType" = 'MANUAL' AND "sourceId" IS NULL AND "recruitmentApplicationId" IS NULL) OR
    ("sourceType" = 'LEGACY' AND "recruitmentApplicationId" IS NULL)
  )
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_override_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    (
      "templateResolutionSource" <> 'PRIVILEGED_OVERRIDE' AND
      num_nonnulls(
        "overrideStartedAt", "overrideStartedByUserId", "overrideStartReason",
        "overrideAutomaticTemplateId", "overrideResolutionFailureCode"
      ) = 0
    ) OR (
      "templateResolutionSource" = 'PRIVILEGED_OVERRIDE' AND
      num_nonnulls("overrideStartedAt", "overrideStartedByUserId", "overrideStartReason") = 3 AND
      nullif(btrim("overrideStartReason"), '') IS NOT NULL AND
      num_nonnulls("overrideAutomaticTemplateId", "overrideResolutionFailureCode") = 1 AND
      (
        "overrideResolutionFailureCode" IS NULL OR
        "overrideResolutionFailureCode" IN (
          'ONBOARDING_TEMPLATE_NOT_CONFIGURED',
          'ONBOARDING_TEMPLATE_NOT_PUBLISHED',
          'ONBOARDING_TEMPLATE_BRANCH_MISMATCH'
        )
      )
    )
  )
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_resolution_assignment_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR
  "templateResolutionSource" NOT IN ('BRANCH_OVERRIDE', 'DESIGNATION_DEFAULT') OR
  "designationOnboardingAssignmentId" IS NOT NULL
);

ALTER TABLE "EmployeeOnboarding"
ADD CONSTRAINT "employee_onboarding_counter_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    "version" > 0 AND
    "totalTasks" >= 0 AND "completedTasks" >= 0 AND "skippedTasks" >= 0 AND "waivedTasks" >= 0 AND
    "terminalTasks" = "completedTasks" + "skippedTasks" + "waivedTasks" AND
    "terminalTasks" <= "totalTasks" AND
    "mandatoryRemaining" >= 0 AND "mandatoryRemaining" <= "totalTasks" AND
    "progress" BETWEEN 0 AND 100
  )
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_owner_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    ("ownerType" = 'DEPARTMENT' AND "executorDepartmentId" IS NOT NULL) OR
    ("ownerType" IN ('EMPLOYEE', 'MANAGER') AND "executorDepartmentId" IS NULL)
  )
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_version_attempt_check"
CHECK ("contractVersion" = 'LEGACY_V1' OR ("version" > 0 AND "attemptNo" > 0));

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_assignment_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR
  num_nonnulls("assignedToUserId", "assignedByUserId", "assignedAt") IN (0, 3)
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_work_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    ("workType" = 'CHECKLIST' AND "referenceType" IS NULL AND "referenceId" IS NULL) OR
    (
      "workType" = 'ASSET' AND "ownerType" = 'DEPARTMENT' AND
      "referenceType" = 'ASSET_TYPE' AND "referenceId" IS NOT NULL
    )
  )
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_result_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    (
      "workType" = 'ASSET' AND "status" = 'COMPLETED' AND
      (
        ("resultType" = 'EMPLOYEE_ASSET' AND "employeeAssetId" IS NOT NULL AND "softwareLicenseAllocationId" IS NULL) OR
        ("resultType" = 'SOFTWARE_LICENSE_ALLOCATION' AND "softwareLicenseAllocationId" IS NOT NULL AND "employeeAssetId" IS NULL)
      )
    ) OR
    (
      NOT ("workType" = 'ASSET' AND "status" = 'COMPLETED') AND
      "resultType" IS NULL AND "employeeAssetId" IS NULL AND "softwareLicenseAllocationId" IS NULL
    )
  )
);

ALTER TABLE "EmployeeOnboardingTask"
ADD CONSTRAINT "employee_onboarding_task_resolution_shape_check"
CHECK (
  "contractVersion" = 'LEGACY_V1' OR (
    (
      "status" IN ('PENDING', 'IN_PROGRESS') AND
      "resolvedAt" IS NULL AND "resolvedByUserId" IS NULL
    ) OR
    (
      "status" IN ('COMPLETED', 'SKIPPED', 'WAIVED', 'CANCELLED') AND
      "resolvedAt" IS NOT NULL AND "resolvedByUserId" IS NOT NULL
    )
  )
);

ALTER TABLE "OnboardingTaskActionEvent"
ADD CONSTRAINT "onboarding_task_action_reason_check"
CHECK (
  ("reason" IS NULL OR char_length("reason") <= 1000) AND
  (
    "action" NOT IN ('REASSIGNED', 'UNASSIGNED', 'SKIPPED', 'AUTO_SKIPPED', 'REOPENED', 'WAIVED', 'OVERRIDE_COMPLETED', 'CANCELLED') OR
    nullif(btrim("reason"), '') IS NOT NULL
  ) AND (
    "authorityMode" <> 'HR_OVERRIDE' OR nullif(btrim("reason"), '') IS NOT NULL
  ) AND (
    ("authorityMode" = 'NORMAL' AND "action" IN ('ASSIGNED', 'REASSIGNED', 'UNASSIGNED', 'STARTED', 'COMPLETED', 'SKIPPED', 'REOPENED')) OR
    ("authorityMode" = 'HR_OVERRIDE' AND "action" IN ('REASSIGNED', 'REOPENED', 'OVERRIDE_COMPLETED', 'WAIVED')) OR
    ("authorityMode" = 'SYSTEM' AND "action" IN ('ASSIGNED', 'AUTO_SKIPPED', 'CANCELLED'))
  )
);

ALTER TABLE "OnboardingTaskActionEvent"
ADD CONSTRAINT "onboarding_task_action_asset_result_check"
CHECK (
  (
    "resultType" IS NULL AND "employeeAssetId" IS NULL AND
    "softwareLicenseAllocationId" IS NULL AND "assetAttemptNo" IS NULL
  ) OR (
    "assetAttemptNo" IS NOT NULL AND "assetAttemptNo" > 0 AND
    (
      ("resultType" = 'EMPLOYEE_ASSET' AND "employeeAssetId" IS NOT NULL AND "softwareLicenseAllocationId" IS NULL) OR
      ("resultType" = 'SOFTWARE_LICENSE_ALLOCATION' AND "softwareLicenseAllocationId" IS NOT NULL AND "employeeAssetId" IS NULL)
    )
  )
);
~~~

### 5.8 Composite relations and referential actions

Add these supporting unique keys in the exact order used by the foreign keys:

~~~prisma
Branch                    @@unique([companyId, id])
Department                @@unique([companyId, branchId, id])
Designation               @@unique([companyId, id])
Employee                  @@unique([companyId, id])
OnboardingTemplate        @@unique([companyId, id])
DesignationOnboardingAssignment @@unique([companyId, id])
OnboardingTemplateVersion @@unique([companyId, onboardingTemplateId, id])
OnboardingTemplateTask    @@unique([companyId, onboardingTemplateVersionId, id])
EmployeeOnboarding        @@unique([companyId, id, employeeId])
EmployeeOnboardingTask    @@unique([companyId, id, employeeId])
~~~

Required relations are:

- EmployeeOnboarding to Employee by (companyId, employeeId), Branch by (companyId, branchId), Department snapshot by (companyId, branchId, departmentIdAtStart), Designation snapshot by (companyId, designationIdAtStart), selected Template by (companyId, templateId), Version by (companyId, templateId, templateVersionId), optional automatic-comparison Template by (companyId, overrideAutomaticTemplateId), and optional effective assignment by (companyId, designationOnboardingAssignmentId).
- EmployeeOnboardingTask to its parent by (companyId, onboardingId, employeeId), Employee by (companyId, employeeId), workstream Department by (companyId, branchId, workstreamDepartmentId), and optional executor Department by (companyId, branchId, executorDepartmentId).
- EmployeeOnboardingTask to source Template Task by (companyId, templateVersionId, sourceTemplateTaskId). The task therefore stores templateVersionId as an immutable snapshot in addition to sourceTemplateTaskId.
- EmployeeOnboardingTask dependency to another task by (companyId, onboardingId, dependsOnTaskId), backed by a parent-scoped unique key, so direct SQL cannot link another Onboarding.
- Action events to Onboarding and task with Company-qualified keys. Actor, from-assignee, and to-assignee User relations are named separately.
- Command receipts to actor User with a named relation and to no mutable business row; resultEntityType/resultEntityId is an immutable replay pointer, not a cascading FK.
- recruitmentApplicationId to JobApplication with onDelete Restrict. A deferred trigger verifies the Application's Job Opening Company equals EmployeeOnboarding.companyId.
- EmployeeOnboardingTask and OnboardingTaskActionEvent employeeAssetId/softwareLicenseAllocationId to the final Asset V2 custody tables using Company-qualified result keys. Task relations also include employeeId; action-event triggers verify the result Employee equals the parent task Employee. Add the matching Asset V2 supporting uniques before activating these FKs.

Organization, Template, Version, source task, Employee, Recruitment Application, Asset result, action evidence, and actor relations use onDelete Restrict and onUpdate Restrict. The mutable current assignedToUserId may be null because a Department task can be unassigned; deletion of a currently or historically referenced User remains Restrict so evidence is not erased.

If the final Asset or Recruitment schema cannot supply one of these exact keys, stop and reconcile the contract after pulling the final commits. Do not weaken the relation to an unqualified single-column FK.

### 5.9 Constraint triggers for cross-row rules

Foreign keys and CHECK constraints cannot enforce all runtime invariants. Add the named triggers below. Cross-row guards are deferred constraint triggers evaluated at commit; the contract-version guard is a BEFORE INSERT/UPDATE trigger with a restricted reconciliation procedure as its only promotion path:

| Trigger | Applies to | Commit-time assertion |
|---|---|---|
| onboarding_template_publish_guard | Version transition to PUBLISHED | Exact owner/work/reference shapes, same-Version acyclic dependencies, no optional or skippable prerequisite, active same-Company/Branch Departments, active Individual/Pool Asset Types, and no deferred workflow fields |
| onboarding_template_history_immutable_guard | Published/archived Version and children | No update/delete of immutable Template hierarchy or requirement fields |
| employee_onboarding_source_guard | EmployeeOnboarding insert/update | Recruitment Application exists, belongs to the same Company through Job Opening, matches source fields, and is unique |
| employee_onboarding_contract_version_guard | EmployeeOnboarding and task insert/update | V2 services must insert V2 explicitly; compatibility-created LEGACY_V1 rows are read-only; only the restricted reconciliation procedure may promote a fully validated aggregate from LEGACY_V1 to V2 |
| employee_onboarding_task_snapshot_guard | Runtime task insert/update | Parent Company/Branch/Employee/Version match, owner Department shape matches source snapshot, dependency belongs to same Onboarding, and immutable requirement fields do not change |
| employee_onboarding_task_assignee_guard | Assignment field update | Assigned User resolves to an active Employee in the same Company/Branch and, for Department work, executor Department |
| employee_onboarding_asset_result_guard | Asset result/status update | Result belongs to same Company/Employee, matches required Asset Type/tracking mode, and the source command references this task/attempt |
| employee_onboarding_progress_guard | Task or parent terminal-state update | Stored completed/skipped/waived/terminal/mandatory/progress counters equal the locked child rows |

Each trigger raises a named SQLSTATE/detail code that the API translation table maps to the corresponding stable public error. Trigger messages contain no Employee, Department, reason, Asset, or tenant data.

## 6. Template validation and lifecycle

### 6.1 Draft writes

- Scope-load the Template Version and enclosing Department slice first.
- Verify Template Company, Department Company, and Department Branch in one predicate.
- Task create/update accepts ownerType, workType, referenceType/referenceId, dependency, scheduling, and behavior fields only.
- The client cannot write assignedEmployeeId, assignedDesignationId, or an arbitrary executor Department.
- Department owner is inherited from the URL/enclosing Task Group.
- Every update requires expectedVersion = task.rowVersion.
- CAS failure returns ONBOARDING_TEMPLATE_VERSION_CHANGED.

### 6.2 Publish validation

Publishing reruns validation inside the publish transaction and rejects:

- inactive Template;
- no active scope or no active Department/task group/task;
- foreign Company/Branch Department;
- owner outside DEPARTMENT/EMPLOYEE/MANAGER;
- named Employee/Designation assignment;
- DEPARTMENT owner not matching enclosing Department;
- unsupported workType;
- CHECKLIST with an Asset reference;
- ASSET without ASSET_TYPE reference;
- missing/inactive/foreign Asset Type;
- LOCATION-tracked Asset Type;
- ASSET owner other than DEPARTMENT;
- approvalWorkflowId, autoComplete, executionRule, or other deferred runtime setting;
- duplicate sequence;
- dependency outside Version, self-dependency, or cycle;
- a dependency source task that is optional or has allowSkip = true;
- multiple current published Versions.

The validation response is:

~~~ts
interface OnboardingValidationResult {
  valid: boolean;
  errorCount: number;
  warningCount: number;
  errors: Array<{
    code: string;
    path: string;
    message: string;
    entityId?: string;
  }>;
  warnings: Array<{
    code: string;
    path: string;
    message: string;
    entityId?: string;
  }>;
}
~~~

No active Department assigner is a warning, not a publish blocker, because staffing and permissions can change after publication.

### 6.3 Publish transaction

Body:

~~~ts
interface PublishOnboardingVersionRequest {
  operationId: string;
  expectedVersion: number;
  effectiveFrom?: string;
  changeSummary?: string;
}
~~~

Transaction:

1. Claim command receipt.
2. Lock Template and target Version.
3. Compare rowVersion.
4. Re-run validation.
5. Lock current published Version.
6. Archive/unset the old current Version.
7. Publish/set current on the target.
8. Increment rowVersion.
9. Write audit and safe outbox event.
10. Commit.

### 6.4 Shared Template resolution

Create one OnboardingTemplateResolutionService and use it from normal HR start, preflight, Recruitment conversion, and override comparison. It accepts a Prisma.TransactionClient when called from a command and never starts its own transaction.

Inputs are companyId, branchId, designationId, startDate, and optional overrideTemplateId. Normal resolution is deterministic:

1. Load the one active DesignationOnboardingAssignment Branch override whose effective range contains startDate.
2. If none exists, load the one active Designation default whose effective range contains startDate.
3. If none exists, read the temporary Designation.onboardingTemplateId compatibility fallback and increment onboarding_template_legacy_fallback_total with Company, Branch, and Designation safe dimensions.
4. If none exists, return ONBOARDING_TEMPLATE_NOT_CONFIGURED.

For every result, the resolver must:

- scope the assignment, Designation, Template, and Version to the Employee's Company;
- require an active Template and exactly one current PUBLISHED Version effective on startDate;
- verify every concrete Department slice belongs to the Employee Branch;
- reject missing or unpublished results with ONBOARDING_TEMPLATE_NOT_PUBLISHED;
- reject Department/Branch mismatch with ONBOARDING_TEMPLATE_BRANCH_MISMATCH;
- return the assignment ID, Template ID, Version ID, version number, and resolution source;
- return a safe 404 for any direct override Template outside scope.

Preflight may run this logic read-only to explain the expected result. Start must rerun it after acquiring locks; a preflight response is never a reservation or authorization token.

Override start evaluates normal resolution first and records either its resolved assignment or its stable failure code as evidence; a missing normal configuration does not by itself block an authorized override. It then validates the requested published Template against the same Company and Employee Branch and stores PRIVILEGED_OVERRIDE plus the selected Template, actor, timestamp, and protected reason.

Legacy fallback use must reach zero in production reconciliation before the fallback is removed. A feature flag must not silently change the precedence order.

### 6.5 Start preconditions and snapshot contract

Before creating any rows, revalidate that the Employee is active for Onboarding, belongs to the requested Company/Branch context, has a current Department and Designation, and has no active Onboarding. Recruitment source starts also revalidate the accepted Application and source uniqueness.

Actor preconditions are:

- A mandatory EMPLOYEE task requires the joining Employee to have an active linked User.
- A mandatory MANAGER task requires an active reporting Manager with an active linked User.
- A missing mandatory special-owner actor blocks preflight and start with ONBOARDING_START_PRECONDITION_FAILED.
- An optional EMPLOYEE or MANAGER task with no resolvable actor is snapshotted directly as SKIPPED with AUTO_SKIPPED action evidence that records the explicit missing-actor reason.
- A Department with no active same-Department user carrying hr.onboarding.department.assign does not block start. Its tasks remain unassigned, ONBOARDING_DEPARTMENT_NO_ASSIGNER is emitted for exact-scope HR recipients, and mandatory work continues to block final completion.

Snapshot rules are:

- Copy immutable Company, Branch, Branch timezone, Employee, workstream Department, executor Department, Template Version, owner, mandatory, skip/reopen, due, dependency, work type, and Asset requirement fields.
- Compute dueDate once from startDate/dueDays using the Branch timezone rule.
- Resolve EMPLOYEE and MANAGER to assignedToUserId and write assignedByUserId/assignedAt plus ASSIGNED evidence.
- Create DEPARTMENT tasks with assignedToUserId, assignedByUserId, and assignedAt all null.
- Remap dependencies only after all task rows exist and verify every source and target belongs to the same locked Version and runtime Onboarding.
- Do not copy a named Employee, named Designation, arbitrary Department, approval state, or generic workflow runtime field.
- Recheck that every prerequisite is mandatory and has allowSkip = false. Optional or skippable prerequisites are invalid because automatic missing-actor skip and final optional auto-skip do not satisfy dependencies.

### 6.6 Serializable start transaction

Normal start and Recruitment conversion use serializable isolation with bounded retry for serialization failure and deadlock. An exact retry must return the committed Onboarding; it must not create a second Employee, User, invitation, Onboarding, career event, or notification.

The transaction is:

1. Claim or replay (companyId, operationId) using INSERT ... ON CONFLICT DO NOTHING RETURNING; on no inserted row, scoped-read and compare the stored command/hash.
2. Lock and revalidate the Employee and, for Recruitment, the JobApplication/conversion aggregate.
3. Resolve and lock the effective Designation assignment, Template, and published Version.
4. Check the active-Onboarding and Recruitment-source unique predicates.
5. Insert EmployeeOnboarding with organization, assignment, source, resolution, actor, and Template snapshots.
6. Insert task snapshots in deterministic source-task ID order, then insert dependency links.
7. Auto-assign Employee and Manager tasks and queue Department tasks as specified above.
8. Write Onboarding/task action evidence, career events, AuditLog, and safe OutboxEvent rows.
9. Store a safe receipt snapshot containing only result IDs, versions, statuses, resolution source, and idempotent response metadata.
10. Commit once.

Recruitment conversion calls these transaction-aware primitives inside the conversion transaction. It must not create the Employee and Onboarding in separate commits. Its idempotent path returns the existing Employee and source-linked Onboarding together, plus durable invitation delivery state from the final Recruitment contract.

Start writes one EmployeeCareerEvent with eventType ONBOARDING_STARTED, sourceModule ONBOARDING, and sourceRecordId = onboardingId. Final completion writes ONBOARDING_COMPLETED and, when lifecycle eligibility succeeds, PROBATION_STARTED. Cancellation writes ONBOARDING_CANCELLED. Each event is idempotent on Employee/eventType/sourceRecordId and is committed with the lifecycle transition it describes.

### 6.7 Canonical lock order

Every Onboarding command and composed Asset command follows this order:

1. Onboarding command receipt.
2. Required RoleAssignment/permission records and applicable Asset Department grant rows.
3. Employee.
4. EmployeeOnboarding.
5. Target task, prerequisites, and affected dependents in ascending task ID order.
6. Asset and subtype or pool aggregate.
7. EmployeeAsset or SoftwareLicenseAllocation custody rows.
8. Action evidence, AuditLog, and OutboxEvent inserts.

Read identifiers may be discovered before locking, but no command may lock a later category and then return to an earlier category. Internal primitives accept the parent's transaction context, do not claim another receipt, do not start or commit a nested transaction, and do not relock rows out of order.

## 7. Authorization and capability contract

### 7.1 Permissions

| Permission | Scope and behavior |
|---|---|
| hr.onboarding.read | HR list/detail monitoring within organization scope |
| hr.onboarding.manage | Template draft management, normal start, cancel, final complete |
| hr.onboarding.publish | Publish/archive Template Versions |
| hr.onboarding.department.read | View queue for actor Employee's Department |
| hr.onboarding.department.assign | Assign/reassign/unassign queue tasks for actor Employee's Department |
| hr.onboarding.override | Cross-Department break-glass complete/reassign/reopen/waive with reason |
| hr.self.read | View and execute tasks assigned to the authenticated User |

Seed new permissions as tenant-assignable. Add them to appropriate default roles without granting hr.onboarding.override to ordinary HR or Department roles.

#### 7.1.1 Permission seed and route policy

Use the repository's deterministic md5('permission:' || code) IDs and ON CONFLICT-safe role mappings. Do not use a new hard-coded UUID sequence.

Default system-role mapping is least privilege:

- ORGANIZATION_OWNER and COMPANY_ADMINISTRATOR receive hr.onboarding.publish in addition to their existing read/manage rights.
- HR_MANAGER retains existing read/manage. Template publish is granted explicitly to an approved HR Template administrator role rather than added automatically to every HR Manager.
- hr.onboarding.department.read and hr.onboarding.department.assign are tenant-assignable but receive no blanket system-role mapping. A tenant administrator grants both through the role used for a Department head/delegate.
- hr.onboarding.override receives no default system-role mapping.
- hr.self.read remains mapped to EMPLOYEE and other existing self-service roles.

RoleAssignment continues to use GLOBAL, GROUP, COMPANY, or BRANCH scope. Do not add DEPARTMENT RoleScope for this feature: Department restriction comes from the actor's active Employee.departmentId after organization scope succeeds.

Route policy uses:

- hr.onboarding.manage for Template draft writes, Designation assignment configuration, normal start, cancellation, and final completion;
- hr.onboarding.publish for publish/archive Template and Version commands;
- hr.onboarding.department.read for Department queue/detail reads;
- any-of hr.onboarding.department.assign or hr.onboarding.override for assignee candidates/reassignment commands; initial ASSIGN still requires Department assignment authority at record level;
- hr.self.read for /me reads and execution by the current assignee;
- authentication plus active Employee projection for workspace-capabilities; returned sections independently apply hr.self.read and Department-read rules;
- hr.onboarding.override only as an additional service-level path for the reasoned break-glass action.

Task command controller guards must support the relevant any-of coarse permissions, then require the exact record-level allowed action in the service. A coarse permission alone is never sufficient.

### 7.2 Actor scope

Create OnboardingActorContextService that resolves:

~~~ts
interface OnboardingActorContext {
  userId: string;
  permissions: string[];
  organizationContext: {
    companyGroupId?: string;
    companyId?: string;
    branchId?: string;
  };
  employeeContext: {
    employeeId: string;
    companyId: string;
    branchId: string;
    departmentId: string;
    isActive: true;
  } | null;
  roleAssignments: Array<{
    scope: "GLOBAL" | "GROUP" | "COMPANY" | "BRANCH";
    companyGroupId?: string;
    companyId?: string;
    branchId?: string;
  }>;
}
~~~

HR monitoring, Template management, start, final completion, cancellation, and override resolve organizationContext plus the applicable RoleAssignment and do not require the HR User to have an Employee row. Department read/assign and hr.self.read require a non-null active employeeContext; Department authority additionally requires its exact departmentId match after organization scope succeeds. A missing Employee context therefore removes personal/Department capabilities but does not erase valid organization-scoped HR capabilities. Never resolve recipients or access using companyId OR branchId without evaluating RoleScope.

### 7.3 Allowed actions

~~~ts
type EmployeeOnboardingAllowedAction =
  | "CANCEL"
  | "COMPLETE";

type EmployeeOnboardingTaskAllowedAction =
  | "ASSIGN"
  | "REASSIGN"
  | "UNASSIGN"
  | "START"
  | "COMPLETE"
  | "SKIP"
  | "REOPEN"
  | "FULFILL_ASSET"
  | "WAIVE";

type OnboardingTemplateAllowedAction =
  | "CREATE"
  | "CREATE_DRAFT"
  | "EDIT_DRAFT"
  | "CLONE"
  | "VALIDATE"
  | "PUBLISH"
  | "ARCHIVE"
  | "VIEW_HISTORY";

type DesignationOnboardingAssignmentAllowedAction =
  | "CREATE"
  | "EDIT"
  | "DEACTIVATE";

interface RuntimeActionCapability<TAction extends string> {
  action: TAction;
  authorityMode: "NORMAL" | "HR_OVERRIDE";
  reasonRequired: boolean;
  reasonField: "reason" | "overrideReason" | null;
  remarksRequired: boolean;
  confirmationTone: "NORMAL" | "WARNING" | "BREAK_GLASS";
  candidateScope?: "EXECUTOR_DEPARTMENT" | "HR_OVERRIDE_BRANCH";
  preflight?: "NONE" | "REOPEN" | "ONBOARDING_COMPLETE";
}

type EmployeeOnboardingTaskActionCapability =
  RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>;

type EmployeeOnboardingActionCapability =
  RuntimeActionCapability<EmployeeOnboardingAllowedAction>;
~~~

OnboardingCapabilityService calculates runtime actions from actor context, record scope, status, version, dependencies, current assignment, task configuration, Asset capability, and feature gates. OnboardingTemplateCapabilityService calculates Template/Version actions from lifecycle state, rowVersion, draft ownership rules, organization scope, and manage/publish permissions.

Each returned Onboarding or task action has exactly one matching actionCapabilities entry. When normal authority and break-glass authority are both valid, the service returns NORMAL; HR_OVERRIDE is returned only when the normal path is unavailable and the protected reason is therefore mandatory. reasonField names the only accepted reason property, candidateScope controls the assignee lookup shape, and preflight identifies actions that require a fresh preview. The client never infers these from a role name, route, or status.

The client never receives an action that the same actor/record cannot successfully authorize at that moment, excluding normal concurrency changes.

## 8. Public API contract

### 8.1 Conventions

- Existing global ApiResponse and error envelope remain unchanged.
- Paginated lists return {items,total,page,limit}.
- Search parameter is keyword.
- Sort direction parameter is sortOrder.
- Sort fields are resource-specific allowlists.
- Foreign-scope direct IDs return safe 404.
- Every runtime mutation requires operationId and expected version.
- Command responses are direct resource DTOs inside the standard envelope.
- Response mappers redact protected reasons, internal receipt hashes, and notification payload details.
- Register /preflight, /summary, /employee/:employeeId, /department-queue, and other static prefixes before generic /:id handlers so a valid static route is never parsed as an ID.

### 8.2 Preflight

GET /employee-onboarding/preflight

Query:

~~~ts
interface OnboardingPreflightQuery {
  employeeId: string;
  startDate: string;
  overrideTemplateId?: string;
}
~~~

Response:

~~~ts
interface OnboardingPreflightResponse {
  mode: "NORMAL" | "OVERRIDE";
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
    companyId: string;
    branchId: string;
    departmentId: string;
    designationId: string | null;
  };
  resolvedTemplate?: {
    templateId: string;
    templateCode: string;
    templateName: string;
    templateVersionId: string;
    versionNo: number;
    resolutionSource:
      | "BRANCH_OVERRIDE"
      | "DESIGNATION_DEFAULT"
      | "DESIGNATION_LEGACY_FALLBACK"
      | "PRIVILEGED_OVERRIDE";
  };
  automaticResolution?: {
    templateId: string;
    templateCode: string;
    templateName: string;
    templateVersionId: string;
    versionNo: number;
    resolutionSource:
      | "BRANCH_OVERRIDE"
      | "DESIGNATION_DEFAULT"
      | "DESIGNATION_LEGACY_FALLBACK";
  };
  automaticResolutionFailureCode?:
    | "ONBOARDING_TEMPLATE_NOT_CONFIGURED"
    | "ONBOARDING_TEMPLATE_NOT_PUBLISHED"
    | "ONBOARDING_TEMPLATE_BRANCH_MISMATCH";
  summary: {
    totalTasks: number;
    mandatoryTasks: number;
    departmentTasks: number;
    employeeTasks: number;
    managerTasks: number;
    assetTasks: number;
  };
  departments: Array<{
    id: string;
    name: string;
    taskCount: number;
    hasActiveAssigner: boolean;
  }>;
  canStart: boolean;
  blockers: Array<{ code: string; message: string; entityId?: string }>;
  warnings: Array<{ code: string; message: string; entityId?: string }>;
  allowedActions: Array<"START" | "OVERRIDE_START">;
  actionCapabilities: Array<RuntimeActionCapability<"START" | "OVERRIDE_START">>;
}
~~~

Without overrideTemplateId the endpoint runs NORMAL mode and may return START only. With overrideTemplateId it requires hr.onboarding.override, validates that published Template as the proposed resolvedTemplate with PRIVILEGED_OVERRIDE, independently evaluates normal resolution into automaticResolution or automaticResolutionFailureCode, and may return OVERRIDE_START only. The preflight does not persist override evidence; the command reruns both validations and stores the comparison with the mandatory reason.

### 8.3 Start

POST /employee-onboarding

~~~ts
interface StartEmployeeOnboardingRequest {
  operationId: string;
  employeeId: string;
  startDate: string;
  remarks?: string;
}
~~~

POST /employee-onboarding/override-start

~~~ts
interface OverrideStartEmployeeOnboardingRequest
  extends StartEmployeeOnboardingRequest {
  templateId: string;
  reason: string;
}
~~~

Normal start rejects templateId if supplied. Override start requires hr.onboarding.override and records PRIVILEGED_OVERRIDE.
Both routes return EmployeeOnboardingResponse. A replay returns the existing scoped resource projection with X-Idempotent-Replay: true and the original result version in response metadata after current authorization is revalidated.

### 8.4 Onboarding reads

| Method | Route | Permission |
|---|---|---|
| GET | /employee-onboarding | hr.onboarding.read |
| GET | /employee-onboarding/:id | hr.onboarding.read or participant-safe read |
| GET | /employee-onboarding/employee/:employeeId | hr.onboarding.read |
| GET | /employee-onboarding/summary | hr.onboarding.read |
| GET | /me/onboarding | hr.self.read |
| GET | /me/onboarding-tasks | hr.self.read |
| GET | /me/onboarding/workspace-capabilities | Authenticated, active Employee projection |

GET /me/onboarding returns a self-service envelope rather than exposing HR organization detail:

~~~ts
interface MeOnboardingResponse {
  ownOnboarding: EmployeeOnboardingResponse | null;
}
~~~

Workspace discovery is independent of hr.self.read:

~~~ts
interface OnboardingWorkspaceCapabilitiesResponse {
  sections: Array<"MY_TASKS" | "DEPARTMENT_QUEUE">;
}
~~~

MY_TASKS is included only when the active, user-linked Employee has hr.self.read. DEPARTMENT_QUEUE is included only after the server confirms hr.onboarding.department.read, an active Employee, a current Department, and valid RoleAssignment organization scope. The response contains no Department counts or labels; those appear only after the scoped queue is requested. GET /me/onboarding remains the joiner's own summary and is not the authority for Department Queue discovery.

GET /me/onboarding-tasks returns {items,total,page,limit} and is always constrained to assignedToUserId = authenticated User. Exact filters are status, dueState, workType, ownerType, employeeId, executorDepartmentId, and keyword. The only sortBy values are dueDate, priority, taskName, status, and updatedAt; sortOrder is ASC or DESC. The default is page 1, limit 10, dueDate ASC with nulls last, then priority DESC, sequenceNo ASC, and task ID ASC. Pagination uses the shared PaginationDto bounds of page >= 1 and limit 1..100. Manager Dashboard and My Workspace consume this same projection; neither may request organization-wide pending work.

List filters:

- companyId, branchId, departmentId, designationId;
- employeeId, templateId, status;
- startedFrom, startedTo, completedFrom, completedTo;
- hasOverdue, hasUnassignedMandatory;
- keyword, page, limit, sortBy, sortOrder.

### 8.5 Department queue

GET /employee-onboarding-task/department-queue

Requires hr.onboarding.department.read and returns only executorDepartmentId = actor.departmentId.

Filters:

- assignmentState = UNASSIGNED | ASSIGNED | ALL;
- assignedToUserId;
- status;
- dueState = DUE_SOON | OVERDUE | ALL;
- mandatory;
- workType;
- employeeId;
- keyword, page, limit, sortBy, sortOrder.

Department queue sortBy is limited to dueDate, status, employeeName, assignedAt, and updatedAt. Assignee candidates sort only by employeeCode or displayName. Every endpoint rejects, rather than forwards, an unknown Prisma field.

GET /employee-onboarding-task/:id/assignee-candidates?keyword=&page=&limit=

Candidate access requires a current record-level ASSIGN or REASSIGN action capability and either hr.onboarding.department.assign or hr.onboarding.override, according to that capability's authorityMode. It is not a broad Employee lookup.

- Normal ASSIGN/REASSIGN returns only active, user-linked Employees in the task's Company, Branch, and executor Department.
- HR_OVERRIDE REASSIGN of DEPARTMENT work uses the same executor-Department target restriction.
- HR_OVERRIDE REASSIGN of EMPLOYEE or MANAGER work returns active, user-linked Employees in the same Company and Branch; those task shapes have no executor Department.

The corresponding candidateScope is EXECUTOR_DEPARTMENT for the first two cases and HR_OVERRIDE_BRANCH for the third. The server derives all target scope from the locked task and action descriptor. A client cannot choose another Company, Branch, or Department. ASSIGN is never exposed under HR_OVERRIDE.

The candidate response is deliberately smaller than an Employee profile:

~~~ts
interface OnboardingAssigneeCandidateResponse {
  items: Array<{
    employeeId: string;
    userId: string;
    employeeCode: string;
    displayName: string;
    isActive: true;
    designation: { id: string; code: string; name: string } | null;
    department: { id: string; code: string; name: string };
    branch: { id: string; code: string; name: string };
  }>;
  total: number;
  page: number;
  limit: number;
}
~~~

The list supports keyword, page, limit, sortBy = employeeCode | displayName, and sortOrder. It omits contact details, role names, permissions, private Employee fields, and ineligible Employees.

GET /employee-onboarding-task/:id/asset-candidates?keyword=&page=&limit=&sortBy=&sortOrder=

Requires current FULFILL_ASSET capability and delegates filtering to Asset V2. It returns only the task's required Asset Type and eligible current scope:

~~~ts
interface OnboardingAssetCandidateResponse {
  trackingMode: "INDIVIDUAL" | "POOL";
  items: Array<{
    assetId: string;
    version: number;
    code: string;
    safeLabel: string;
    assetType: { id: string; name: string };
    owningBranch?: { id: string; name: string };
    owningDepartment?: { id: string; name: string };
    availability: AssetAvailabilityStatus;
    expiryState?: AssetExpiryState;
    availableCapacity?: number;
  }>;
  total: number;
  page: number;
  limit: number;
}
~~~

The mapper never returns card secrets, ciphertext/hash fields, vault references, private history, unrelated custody, or employee notes.
AssetAvailabilityStatus and AssetExpiryState are imported from the final Asset V2 public contract; Onboarding must not copy or redefine broader values.

### 8.6 Runtime response models

~~~ts
interface V2EmployeeOnboardingResponse {
  id: string;
  contractVersion: "LEGACY_V1" | "V2";
  version: number;
  status: "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
  };
  organizationSnapshot: {
    company: { id: string; code: string; name: string };
    branch: { id: string; code: string; name: string; timeZone: string };
    department: { id: string; code: string; name: string };
    designation: { id: string; code: string; name: string };
  };
  templateSnapshot: {
    templateId: string;
    templateCode: string;
    templateName: string;
    templateVersionId: string;
    versionNo: number;
    resolutionSource: string;
  };
  startDate: string;
  startedBy: { userId: string; displayName: string };
  completedAt: string | null;
  cancelledAt: string | null;
  progress: {
    total: number;
    completed: number;
    skipped: number;
    waived: number;
    terminal: number;
    mandatoryRemaining: number;
    unfinishedOptional: number;
    unassignedMandatory: number;
    overdue: number;
    percent: number;
    canComplete: boolean;
  };
  departmentProgress: Array<{
    workstreamDepartment: { id: string; name: string };
    total: number;
    terminal: number;
    mandatoryRemaining: number;
    unassigned: number;
    dueSoon: number;
    overdue: number;
    percent: number;
  }>;
  tasks?: V2EmployeeOnboardingTaskResponse[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: EmployeeOnboardingActionCapability[];
}

interface V2EmployeeOnboardingTaskResponse {
  id: string;
  onboardingId: string;
  contractVersion: "LEGACY_V1" | "V2";
  version: number;
  attemptNo: number;
  taskName: string;
  description: string | null;
  sequenceNo: number;
  priority: number;
  isMandatory: boolean;
  allowSkip: boolean;
  allowReopen: boolean;
  status:
    | "PENDING"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "SKIPPED"
    | "WAIVED"
    | "CANCELLED";
  dueState: "NONE" | "UPCOMING" | "DUE_SOON" | "OVERDUE";
  dueDate: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  ownerType: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";
  employee: { id: string; employeeCode: string; displayName: string };
  organization: {
    company: { id: string; code: string; name: string };
    branch: { id: string; code: string; name: string; timeZone: string };
  };
  workstreamDepartment: { id: string; name: string };
  executorDepartment: { id: string; name: string } | null;
  assignee: { userId: string; employeeId: string; displayName: string } | null;
  assignment: {
    assignedAt: string;
    assignedBy: { userId: string; displayName: string };
  } | null;
  dependency: {
    taskId: string;
    taskName: string;
    status: string;
    satisfied: boolean;
  } | null;
  requirement: {
    workType: "CHECKLIST" | "ASSET";
    referenceType: "ASSET_TYPE" | null;
    referenceId: string | null;
    referenceCode: string | null;
    referenceName: string | null;
    assetKind: AssetKind | null;
    assetTrackingMode: "INDIVIDUAL" | "POOL" | null;
    assetEligibilityScope: "SAME_BRANCH" | "SAME_COMPANY" | null;
  };
  result: {
    type: "EMPLOYEE_ASSET" | "SOFTWARE_LICENSE_ALLOCATION";
    id: string;
    assetId: string;
    safeAssetLabel: string;
  } | null;
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: EmployeeOnboardingTaskActionCapability[];
}

interface LegacyEmployeeOnboardingTaskResponse {
  id: string;
  onboardingId: string;
  contractVersion: "LEGACY_V1";
  version: number | null;
  taskName: string;
  description: string | null;
  legacyStatus: string;
  legacyOwnerType: string | null;
  legacyWorkType: string | null;
  employee: { id: string; employeeCode: string; displayName: string } | null;
  workstreamDepartment: { id: string; name: string } | null;
  executorDepartment: { id: string; name: string } | null;
  assignee: { userId: string; employeeId: string | null; displayName: string } | null;
  dueDate: string | null;
  resolvedAt: string | null;
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: [];
  actionCapabilities: [];
}

interface LegacyEmployeeOnboardingResponse {
  id: string;
  contractVersion: "LEGACY_V1";
  version: number | null;
  legacyStatus: string;
  employee: { id: string; employeeCode: string; displayName: string } | null;
  organizationSnapshot: {
    company: { id: string; code: string; name: string } | null;
    branch: { id: string; code: string; name: string; timeZone: string } | null;
    department: { id: string; code: string; name: string } | null;
    designation: { id: string; code: string; name: string } | null;
  };
  templateSnapshot: {
    templateId: string | null;
    templateCode: string | null;
    templateName: string | null;
    templateVersionId: string | null;
    versionNo: number | null;
    resolutionSource: string | null;
  };
  startDate: string | null;
  startedBy: { userId: string; displayName: string } | null;
  completedAt: string | null;
  cancelledAt: string | null;
  progress: {
    total: number | null;
    terminal: number | null;
    percent: number | null;
  };
  tasks?: LegacyEmployeeOnboardingTaskResponse[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: [];
  actionCapabilities: [];
}

type EmployeeOnboardingResponse =
  | V2EmployeeOnboardingResponse
  | LegacyEmployeeOnboardingResponse;

type EmployeeOnboardingTaskResponse =
  | V2EmployeeOnboardingTaskResponse
  | LegacyEmployeeOnboardingTaskResponse;
~~~

For every V2 Onboarding/task response, actionCapabilities contains exactly one descriptor for each allowedActions value and no additional descriptors. LEGACY_V1 responses are historical/read-only: both action arrays are empty and blockedReasons contains ONBOARDING_LEGACY_RECONCILIATION_REQUIRED when the aggregate is still active. AssetKind is imported from Asset V2 rather than duplicated locally.

### 8.7 Template administration API

Preserve the existing resource roots while hardening every route with Company/Branch scope and optimistic tokens:

~~~ts
interface OnboardingTemplateSummaryResponse {
  id: string;
  rowVersion: number;
  code: string;
  name: string;
  isActive: boolean;
  currentPublishedVersion: {
    id: string;
    versionNo: number;
    status: "PUBLISHED" | "ARCHIVED";
  } | null;
  draftVersion: { id: string; versionNo: number; rowVersion: number } | null;
  allowedActions: OnboardingTemplateAllowedAction[];
}

interface OnboardingTemplateEditorResponse {
  template: OnboardingTemplateSummaryResponse;
  selectedVersion: {
    id: string;
    versionNo: number;
    rowVersion: number;
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    allowedActions: OnboardingTemplateAllowedAction[];
    departments: OnboardingDepartmentTemplateEditorResponse[];
  };
}

interface OnboardingTemplateListResponse {
  items: OnboardingTemplateSummaryResponse[];
  total: number;
  page: number;
  limit: number;
  collectionAllowedActions: Array<"CREATE">;
}

interface DesignationOnboardingAssignmentListResponse {
  items: DesignationOnboardingAssignmentResponse[];
  total: number;
  page: number;
  limit: number;
  collectionAllowedActions: Array<"CREATE">;
}
~~~

collectionAllowedActions is computed for the resolved organization context and is empty when creation is not authorized. Resource allowedActions is computed per Template or Version; the UI never infers CREATE, draft, validate, publish, clone, archive, or history controls merely from page access. OnboardingDepartmentTemplateEditorResponse is the existing typed, scoped hierarchy projection hardened by this plan; its nested rows each expose their rowVersion and server-returned mutable actions.

| Method | Route | V2 behavior |
|---|---|---|
| GET | /onboarding-template | Scoped paged Template list |
| POST | /onboarding-template | Create Template in resolved Company scope |
| GET | /onboarding-template/:id | Scoped Template detail |
| GET | /onboarding-template/:id/editor | Scoped aggregate editor projection |
| PATCH | /onboarding-template/:id | Update mutable Template metadata with expectedVersion |
| GET | /onboarding-template-version/template/:templateId | Scoped Version history |
| POST | /onboarding-template-version/:versionId/draft | Clone/create next draft with operationId and expectedVersion |
| POST | /onboarding-template-version/:versionId/validate | Validate the saved draft with expectedVersion |
| POST | /onboarding-template-version/:versionId/publish | Publish with operationId and expectedVersion |
| POST | /onboarding-template-version/:versionId/archive | Archive with operationId, expectedVersion, and reason |
| GET | /onboarding-workspace/template-version/:versionId | Scoped Version/Department/group/task assembler |
| POST/PATCH/DELETE | /onboarding-department-template | Draft-only Department-slice commands |
| POST/PATCH/DELETE | /onboarding-task-group | Draft-only Task Group commands |
| POST/PATCH/DELETE | /onboarding-template-task | Draft-only Task commands |
| GET | /designation-onboarding-assignments | Scoped effective-dated Designation default/Branch override list |
| POST | /designation-onboarding-assignments | Create a default or Branch override assignment |
| PATCH | /designation-onboarding-assignments/:id | Versioned update of a future/current assignment |
| POST | /designation-onboarding-assignments/:id/deactivate | Reasoned, versioned deactivation; no hard delete |

Static routes such as /editor, /template/:templateId, /validate, and /publish must be registered before generic /:id routes. Every direct ID is loaded through its scoped parent chain; a valid child ID combined with a foreign parent ID returns the same safe 404 as a missing row.

Every create, update, delete, reorder, clone/draft, stored validation, publish, and archive command accepts operationId. Every mutation of an existing aggregate also accepts expectedVersion. Validation that is implemented as a pure read may omit a receipt, but it must return the rowVersion it validated and publish must rerun validation under locks.

The V2 task write DTO is:

~~~ts
interface WriteOnboardingTemplateTaskRequest {
  taskGroupId: string;
  taskName: string;
  description?: string;
  sequenceNo: number;
  priority?: number;
  isMandatory: boolean;
  allowSkip: boolean;
  allowReopen: boolean;
  dueDays?: number;
  ownerType: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";
  workType: "CHECKLIST" | "ASSET";
  referenceType?: "ASSET_TYPE";
  referenceId?: string;
  dependsOnTaskId?: string;
  expectedVersion?: number;
  operationId: string;
}
~~~

Create omits expectedVersion; update/delete/reorder require it. The DTO has no companyId, branchId, assignedDepartmentId, assignedEmployeeId, assignedDesignationId, approvalWorkflowId, executionRule, or generic workflow field. The service derives Company, Version, Branch, workstream Department, and executor Department through taskGroupId and rejects a mismatch before any write.

Legacy DELETE aliases for published/current history are disabled in V2. Deleting a draft child is allowed only when dependency checks pass and writes action/audit evidence. Archive is the public lifecycle operation for Templates and published Versions.

Designation assignment commands use:

~~~ts
interface WriteDesignationOnboardingAssignmentRequest {
  designationId: string;
  branchId?: string;
  onboardingTemplateId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  expectedVersion?: number;
  operationId: string;
}

interface DeactivateDesignationOnboardingAssignmentRequest {
  expectedVersion: number;
  operationId: string;
  reason: string;
}

interface DesignationOnboardingAssignmentResponse {
  id: string;
  version: number;
  designation: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string } | null;
  template: { id: string; code: string; name: string };
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  allowedActions: DesignationOnboardingAssignmentAllowedAction[];
}
~~~

Create omits expectedVersion; update/deactivate require it. The service resolves Company from the scoped Designation, verifies optional Branch and Template belong to that Company, validates the effective range, then relies on the non-overlap constraint for concurrency. Deactivation sets isActive=false/effectiveTo as appropriate and writes protected action evidence, AuditLog, receipt, and OutboxEvent in one transaction.

### 8.8 Task command DTOs

Task routes are:

| Method | Route | Meaning |
|---|---|---|
| GET | /employee-onboarding-task/:id | Scoped task detail for HR monitor, Department participant, or current assignee |
| GET | /employee-onboarding-task/:id/assignee-candidates | Eligible task-scoped assignees for the current normal or override reassignment capability |
| GET | /employee-onboarding-task/:id/asset-candidates | Eligible Asset V2 inventory/pools when fulfillment capability exists |
| GET | /employee-onboarding-task/:id/history | Scoped paged action/assignment history |
| GET | /employee-onboarding-task/:id/reopen-preflight | Exact dependent set and versions for one atomic reopen |
| POST | /employee-onboarding-task/:id/assign | Assign an unassigned task or reassign an assigned task; server chooses action from locked state |
| POST | /employee-onboarding-task/:id/unassign | Return a pending task to its Department queue |
| POST | /employee-onboarding-task/:id/start | Assigned actor starts work |
| POST | /employee-onboarding-task/:id/complete | Assigned actor completes Checklist work, or HR uses explicit reasoned override |
| POST | /employee-onboarding-task/:id/skip | Assigned actor skips eligible optional work with reason |
| POST | /employee-onboarding-task/:id/reopen | Department assigner or HR override reopens eligible terminal work |
| POST | /employee-onboarding-task/:id/fulfill-asset | Complete Asset work through the Asset V2 internal primitive |
| POST | /employee-onboarding-task/:id/waive | HR override waives work with protected reason |

Controller guards provide the coarse permission boundary, but the service always reloads the task through OnboardingActorContextService and requires the exact allowed action after locks. Possession of an ID or access to a list route never authorizes a command.
Every task command returns the refreshed EmployeeOnboardingTaskResponse. Parent progress/version is refetched through the affected Onboarding query; the UI must not calculate it from the command response.

Task history uses page, limit, and sortOrder; the only sort field is createdAt. It returns:

~~~ts
interface OnboardingTaskActionEventResponse {
  id: string;
  action: OnboardingTaskActionType;
  authorityMode: "NORMAL" | "HR_OVERRIDE" | "SYSTEM";
  fromStatus: EmployeeOnboardingTaskStatus | null;
  toStatus: EmployeeOnboardingTaskStatus;
  fromAssignee: { userId: string; displayName: string } | null;
  toAssignee: { userId: string; displayName: string } | null;
  actor: { userId: string; displayName: string };
  reason: string | null;
  assetResult: {
    attemptNo: number;
    resultType: "EMPLOYEE_ASSET" | "SOFTWARE_LICENSE_ALLOCATION";
    resultId: string;
  } | null;
  taskVersionAfter: number;
  createdAt: string;
}
~~~

The route applies the same participant/organization scope as task detail. Protected reasons are returned only to the action participant or an actor with hr.onboarding.override; otherwise reason is null. It never returns receipt hashes, notification payloads, private Asset identifiers, or unrestricted User data.

Reopen preview returns:

~~~ts
interface ReopenOnboardingTaskPreflightResponse {
  taskId: string;
  contractVersion: "LEGACY_V1" | "V2";
  expectedTaskVersion: number;
  canReopen: boolean;
  affectedTasks: Array<{
    taskId: string;
    taskName: string;
    role: "TARGET" | "DEPENDENT";
    status: EmployeeOnboardingTaskStatus;
    expectedVersion: number;
    attemptNo: number;
  }>;
  assetResultState: "NONE" | "TERMINAL" | "ACTIVE_CUSTODY";
  blockedReasons: Array<{ code: string; message: string; taskId?: string }>;
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: EmployeeOnboardingTaskActionCapability[];
}
~~~

The service discovers the transitive terminal dependent set under scoped reads. affectedTasks contains the TARGET once plus every DEPENDENT in reverse topological execution order. The client submits only the exact DEPENDENT IDs/versions in dependentTaskVersions; target version remains expectedTaskVersion. The command locks and revalidates the whole set, reopens dependents in the returned order and then the prerequisite, and commits one receipt/evidence/audit/outbox result. A changed or incomplete set returns TASK_DEPENDENTS_COMPLETED or TASK_STATE_CHANGED without a partial reopen.

Base:

~~~ts
interface OnboardingTaskCommand {
  operationId: string;
  expectedTaskVersion: number;
}
~~~

Assign/reassign:

~~~ts
interface AssignOnboardingTaskRequest extends OnboardingTaskCommand {
  assigneeEmployeeId: string;
  reason?: string;
}
~~~

The server resolves the Employee's current active User inside the command transaction. reason is required whenever an existing assignee is replaced, regardless of task status.

Unassign:

~~~ts
interface UnassignOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}
~~~

Only PENDING tasks may be unassigned. An IN_PROGRESS task must be reassigned directly.

Start:

~~~ts
interface StartOnboardingTaskRequest extends OnboardingTaskCommand {
  remarks?: string;
}
~~~

Complete Checklist:

~~~ts
interface CompleteOnboardingTaskRequest extends OnboardingTaskCommand {
  remarks?: string;
  overrideReason?: string;
}
~~~

overrideReason is accepted only when the actor uses hr.onboarding.override. Asset tasks reject this endpoint.

Skip:

~~~ts
interface SkipOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}
~~~

Reopen:

~~~ts
interface ReopenOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
  dependentTaskVersions?: Array<{
    taskId: string;
    expectedVersion: number;
  }>;
}
~~~

If completed dependents exist, the command must include and atomically reopen each affected dependent or return TASK_DEPENDENTS_COMPLETED.

Fulfill Asset:

~~~ts
interface FulfillOnboardingAssetTaskRequest extends OnboardingTaskCommand {
  assetId: string;
  expectedAssetVersion: number;
  effectiveDate: string;
  remarks?: string;
}
~~~

The server dispatches INDIVIDUAL to assignIndividualAssetWithinTransaction and POOL to allocateLicenseSeatWithinTransaction. The same Onboarding operation owns the receipt, transaction, audit, and response. The Asset primitive must not start another transaction or claim another receipt.

Waive:

~~~ts
interface WaiveOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}
~~~

Requires hr.onboarding.override. Waiving an Asset task creates no custody/allocation result.

### 8.9 Final completion and cancellation

GET /employee-onboarding/:id/completion-preflight

~~~ts
interface EmployeeOnboardingCompletionPreflightResponse {
  onboardingId: string;
  contractVersion: "LEGACY_V1" | "V2";
  expectedOnboardingVersion: number;
  canComplete: boolean;
  mandatoryRemaining: number;
  optionalTasksToAutoSkip: number;
  probationWillStart: boolean;
  blockedReasons: Array<{ code: string; message: string; taskId?: string }>;
  warnings: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: EmployeeOnboardingActionCapability[];
}
~~~

The preflight is a scoped explanation, not a reservation. The complete command locks and recalculates all values and may still return ONBOARDING_STATE_CHANGED or MANDATORY_TASKS_INCOMPLETE.

POST /employee-onboarding/:id/complete

~~~ts
interface CompleteEmployeeOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
  note?: string;
}
~~~

POST /employee-onboarding/:id/cancel

~~~ts
interface CancelEmployeeOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
  reason: string;
}

interface CompleteEmployeeOnboardingResponse {
  onboarding: EmployeeOnboardingResponse;
  employeeStatus: EmployeeStatus;
  probationStarted: boolean;
  careerEventIds: string[];
}

interface CancelEmployeeOnboardingResponse {
  onboarding: EmployeeOnboardingResponse;
  outstandingAssetResults: Array<{
    taskId: string;
    resultType: "EMPLOYEE_ASSET" | "SOFTWARE_LICENSE_ALLOCATION";
    resultId: string;
    safeAssetLabel?: string;
  }>;
}
~~~

Keep DELETE /employee-onboarding/:id only as a deprecated compatibility alias. It must accept an operation ID/version/reason through a documented body or be disabled when Onboarding V2 is enabled.

## 9. State machine and transaction rules

### 9.1 Task transitions

| From | Action | To | Actor |
|---|---|---|---|
| PENDING unassigned | assign | PENDING | Department assigner only |
| PENDING/IN_PROGRESS assigned | reassign | Same state | Department assigner or HR override; reason required |
| PENDING | start | IN_PROGRESS | Current assignee |
| PENDING | complete | COMPLETED | Current assignee for Checklist |
| IN_PROGRESS | complete | COMPLETED | Current assignee for Checklist |
| PENDING/IN_PROGRESS | fulfill asset | COMPLETED | Current assignee plus Asset grant |
| PENDING/IN_PROGRESS | skip | SKIPPED | Current assignee; optional and allowSkip |
| COMPLETED/SKIPPED DEPARTMENT work | reopen | PENDING | Same-Department assigner or HR override |
| COMPLETED/SKIPPED EMPLOYEE/MANAGER work | reopen | PENDING | HR override only |
| WAIVED | reopen | PENDING | HR override only |
| PENDING/IN_PROGRESS | waive | WAIVED | HR override only |
| PENDING/IN_PROGRESS | cancel onboarding | CANCELLED | System inside cancellation |

Completed task completion is idempotent only through a matching operation receipt. A different operation against a completed task returns TASK_STATE_CHANGED.

### 9.2 Assignment

- ASSIGN is available only for an unassigned DEPARTMENT task in PENDING.
- Normal REASSIGN is available only for an assigned DEPARTMENT task in PENDING or IN_PROGRESS and always requires a reason. HR_OVERRIDE REASSIGN is also available for an already assigned EMPLOYEE or MANAGER task under the section 8.5 same-Company/Branch target rule.
- A normal or DEPARTMENT-work override target must resolve to an active Employee in the same Company, Branch, and executor Department. An EMPLOYEE/MANAGER override target must resolve to an active Employee in the same Company and Branch.
- An assignee may execute the task through hr.self.read even without Department queue permission.
- Department assigner may assign self.
- Department assigner cannot complete a teammate's task.
- Reassignment preserves startedAt and status; action history records both assignees.
- PENDING unassignment requires reason.
- EMPLOYEE and MANAGER tasks cannot be manually assigned through the normal Department endpoint.
- HR override may reassign an already assigned task with reason, subject to the candidate eligibility in section 8.5, but cannot perform an initial ASSIGN. It cannot fake-complete an Asset task; it must fulfill or waive it.
- COMPLETE with actionCapabilities.authorityMode = HR_OVERRIDE requires overrideReason. COMPLETE with NORMAL authority ignores/rejects overrideReason. ASSIGN is never returned with HR_OVERRIDE authority.

#### 9.2.1 Task command execution algorithm

Every assign, reassign, unassign, start, complete, skip, reopen, fulfill-asset, and waive command uses the same transaction shell:

1. Authenticate and parse the command-specific canonical request.
2. Begin the serializable transaction and claim/replay the receipt.
3. Lock required permission and Asset grant rows, then Employee, parent Onboarding, target task, prerequisites, and affected dependents in canonical order.
4. Re-resolve actor organization scope and, for self/Department authority, the active Employee/Department context; then recheck the parent is IN_PROGRESS.
5. Compare expectedTaskVersion to task.version and any dependent/Asset versions supplied by the command.
6. Recalculate allowedActions from the locked state and require the exact requested action.
7. Execute one conditional update using id, version, and expected status/assignee predicates; increment version exactly once per affected task.
8. Recalculate stored Onboarding counters from task rows in the same transaction and increment the parent version when its aggregate projection changes.
9. Insert OnboardingTaskActionEvent, protected evidence, redacted AuditLog, and safe OutboxEvent rows.
10. Store the safe result snapshot in the parent receipt and commit.

A zero-row conditional update maps to TASK_STATE_CHANGED. Serialization/deadlock failure is retried only by OnboardingTransactionRunner within the bounded server policy. Exhaustion maps to ONBOARDING_TRANSACTION_RETRY_EXHAUSTED; the client refetches before issuing a revised command.

### 9.3 Dependencies

- A dependency is satisfied only by COMPLETED or WAIVED.
- Publish prohibits every optional task and every task with allowSkip = true from being referenced as a dependency.
- Start, complete, skip, and fulfill-asset recheck dependency after locks.
- Reopening a prerequisite with terminal dependents is atomic: either reopen the supplied dependent set in reverse dependency order or reject.
- Dependency cycles are prohibited at publish and verified after migration.
- Reopening a completed Asset task first asks Asset V2 whether the referenced custody/allocation is terminal. Active custody blocks reopen with ASSET_CUSTODY_STILL_ACTIVE and directs the actor to the Asset return/revoke workflow.
- After terminal custody is confirmed, reopen records the prior result in REOPENED action evidence, increments attemptNo, clears only the task's current-result fields, and keeps the Asset custody/allocation history intact. A later fulfillment uses the new attempt number.

### 9.4 Progress

Authoritative definition:

~~~text
total = all non-CANCELLED task snapshots
terminal = COMPLETED + SKIPPED + WAIVED
percent = floor((terminal / total) * 100), or 0 when total = 0
mandatoryOutstanding = mandatory tasks not COMPLETED or WAIVED
canComplete = onboarding IN_PROGRESS and mandatoryOutstanding = 0
~~~

All HR, Employee, Manager, Department, and summary responses use this calculation. The stored counters are transactionally updated mirrors and are checked for drift.

### 9.5 Final completion

Within one serializable transaction:

1. Claim/replay receipt.
2. Lock Employee, Onboarding, and all task rows.
3. Re-read Onboarding status and expected version.
4. Recalculate progress from locked tasks.
5. Reject any mandatory task not COMPLETED/WAIVED.
6. Change unfinished optional PENDING/IN_PROGRESS tasks to SKIPPED with AUTO_SKIPPED events and resolved timestamps.
7. Set final counters to 100%.
8. Set Onboarding COMPLETED and increment version.
9. For a Recruitment-created PENDING_ONBOARDING Employee, call the transaction-aware lifecycle service to start Probation.
10. Write ONBOARDING_COMPLETED and PROBATION_STARTED career events as applicable.
11. Write safe audit and outbox events.
12. Commit.

No task command may commit after parent completion. Every task mutation locks/rechecks the parent before changing the task.

### 9.6 Cancellation

- Lock Employee, Onboarding, and tasks.
- Reject COMPLETED/CANCELLED.
- Mark unfinished tasks CANCELLED with action evidence.
- Preserve completed/skipped/waived history.
- Mark Onboarding CANCELLED with actor/reason/version.
- Do not return or revoke Asset custody automatically.
- Response includes safe outstanding Asset result IDs so authorized HR can follow Asset workflows.
- Write audit and outbox atomically.

## 10. Asset V2 integration

Asset V2 remains authoritative for availability, Department ownership, lifecycle, capacity, custody, permissions, and concurrency.

Onboarding must:

- query eligible Assets through an Asset capability/query service;
- require the task assignee plus the appropriate Asset V2 broad permission or owning-Department grant;
- verify the Asset Type matches the task's snapshotted referenceId;
- reject LOCATION tracking;
- require physical/card Asset Branch = Employee Branch;
- require licence pool Company = Employee Company;
- call the final transaction-aware internal primitive;
- never insert EmployeeAsset or SoftwareLicenseAllocation directly;
- never claim a child command receipt;
- store the returned result FK before marking the task complete.

Internal source:

~~~ts
{
  sourceType: "ONBOARDING_TASK",
  sourceId: onboardingTaskId,
  sourceCommandKey: "onboarding-task:" + onboardingTaskId + ":fulfill-asset:attempt:" + attemptNo,
  actorUserId,
  operationId
}
~~~

Use Asset V2's frozen asset-source-command:v1 hashing and non-aborting conflict insertion. Repeated exact fulfillment within one attempt returns the same custody/allocation. A different Asset for the same attempt key returns ASSET_SOURCE_COMMAND_CONFLICT. A new attempt is permitted only through the guarded reopen flow above.

Asset integration cannot be enabled until the final Asset commit is pulled and its actual model, permissions, internal function names, lock order, version field, and feature-gate behavior are reconciled against this document.

## 11. Notification and reminder contract

### 11.1 Events

Add catalog entries:

~~~text
ONBOARDING_STARTED
ONBOARDING_DEPARTMENT_WORK_AVAILABLE
ONBOARDING_DEPARTMENT_NO_ASSIGNER
ONBOARDING_TASK_ASSIGNED
ONBOARDING_TASK_REASSIGNED
ONBOARDING_TASK_UNASSIGNED
ONBOARDING_TASK_DUE_SOON
ONBOARDING_TASK_OVERDUE
ONBOARDING_TASK_COMPLETED
ONBOARDING_TASK_WAIVED
ONBOARDING_CANCELLED
ONBOARDING_COMPLETED
~~~

### 11.2 Recipients

- STARTED: Employee and HR monitor recipients.
- DEPARTMENT_WORK_AVAILABLE: active same-Department users with department.assign.
- NO_ASSIGNER: active Users whose exact RoleAssignment grants hr.onboarding.manage for the Onboarding Company/Branch.
- ASSIGNED/REASSIGNED: current assignee; old assignee receives reassignment notice.
- UNASSIGNED: Department assigners.
- DUE_SOON/OVERDUE: assignee; same-Department assigners for unassigned tasks; exact-scope hr.onboarding.read recipients for mandatory overdue escalation.
- COMPLETED/WAIVED: same-Department assigners plus active Users whose exact RoleAssignment grants hr.onboarding.read for the Onboarding Company/Branch; Employee only when appropriate.
- ONBOARDING_COMPLETED/CANCELLED: Employee, Manager, and HR.

### 11.3 Safe payload

Allow only:

~~~text
companyId, branchId, departmentId, employeeId, onboardingId,
onboardingTaskId, recipientUserId, eventCode, status, dueDate
~~~

Never include remarks, reasons, employee personal data, Asset identifiers, receipt hashes, or private action evidence.
Write one OutboxEvent per recipient so its globally unique dedupeKey is recipient-specific. A consumer may fan that one event to in-app and configured email channels, but it must not add recipients by re-resolving broad roles after commit.

### 11.4 Reminder producer

- Scan only enabled Company/Branch scopes.
- Use Branch timezone and one stable as-of timestamp.
- Due soon threshold is two calendar days.
- Unassigned and overdue reminders run once per Branch business date.
- Dedupe key: onboarding:{eventCode}:{taskId}:{businessDate}:user:{userId}.
- Use batch cursor and skip-locked processing.
- In-app delivery is required; email is optional from the same event.
- Failed delivery retries through the outbox and dead-letter policy without rolling back business state.

## 12. Stable errors and database translation

| Code | HTTP | Meaning |
|---|---:|---|
| ONBOARDING_TEMPLATE_NOT_CONFIGURED | 409 | No Branch/default/legacy template |
| ONBOARDING_TEMPLATE_NOT_PUBLISHED | 409 | No current published version |
| ONBOARDING_TEMPLATE_BRANCH_MISMATCH | 409 | Concrete Department Branch mismatch |
| ONBOARDING_TEMPLATE_INVALID | 409 | Publish/start validation failed |
| ONBOARDING_START_PRECONDITION_FAILED | 409 | Employee/Manager/User/data blocker |
| ACTIVE_ONBOARDING_EXISTS | 409 | Employee already has active Onboarding |
| ONBOARDING_NOT_FOUND | 404 | Missing or foreign-scope Onboarding |
| ONBOARDING_STATE_CHANGED | 409 | Version/state conflict |
| ONBOARDING_LEGACY_RECONCILIATION_REQUIRED | 409 | Active historical aggregate is read-only until authoritative V2 reconciliation |
| ONBOARDING_TASK_NOT_FOUND | 404 | Missing or foreign-scope task |
| ONBOARDING_TEMPLATE_VERSION_CHANGED | 409 | Draft/Version optimistic token changed |
| TASK_STATE_CHANGED | 409 | Concurrent transition |
| TASK_ASSIGNEE_REQUIRED | 409 | Task has no current assignee |
| TASK_ASSIGNEE_OUT_OF_DEPARTMENT | 409 | Assignee not eligible |
| TASK_NOT_ASSIGNED_TO_ACTOR | 403 | Actor cannot execute task |
| DEPENDENCY_NOT_COMPLETED | 409 | Required predecessor incomplete |
| TASK_DEPENDENTS_COMPLETED | 409 | Reopen set incomplete |
| TASK_SKIP_NOT_ALLOWED | 409 | Mandatory/not configured for skip |
| MANDATORY_TASKS_INCOMPLETE | 409 | Final completion blocked |
| OVERRIDE_REASON_REQUIRED | 400 | Break-glass reason absent |
| ASSET_TASK_INVALID_TYPE | 409 | Missing/mismatched/LOCATION Asset Type |
| ASSET_PERMISSION_REQUIRED | 403 | Missing Asset capability/grant |
| ASSET_CUSTODY_STILL_ACTIVE | 409 | Asset task cannot reopen before return/revoke |
| ASSET_SOURCE_COMMAND_CONFLICT | 409 | Same source key, different fulfillment |
| OPERATION_ID_REUSED | 409 | Receipt hash/command mismatch |
| ONBOARDING_TRANSACTION_RETRY_EXHAUSTED | 409 | Bounded serialization/deadlock retries exhausted |

Map named unique/check/trigger violations to these stable codes. Do not expose Prisma or PostgreSQL messages.

Database translation is deterministic:

- active-Onboarding partial unique → ACTIVE_ONBOARDING_EXISTS;
- Recruitment-source partial unique → source-aware conversion scoped-reads and returns the existing matching Employee plus Onboarding; a contradictory source/Employee mapping returns ONBOARDING_STATE_CHANGED;
- source-shape or source-Company guard mismatch → ONBOARDING_START_PRECONDITION_FAILED;
- Template publish/history guard → ONBOARDING_TEMPLATE_INVALID or ONBOARDING_TEMPLATE_VERSION_CHANGED;
- task assignee guard → TASK_ASSIGNEE_OUT_OF_DEPARTMENT;
- task snapshot/dependency guard → TASK_STATE_CHANGED or DEPENDENCY_NOT_COMPLETED according to the named detail code;
- Asset result guard → ASSET_TASK_INVALID_TYPE or ASSET_SOURCE_COMMAND_CONFLICT;
- progress guard → ONBOARDING_STATE_CHANGED;
- contract-version guard or V2 command against LEGACY_V1 → ONBOARDING_LEGACY_RECONCILIATION_REQUIRED;
- command receipt unique collision is never handled by catching a failed INSERT transaction; use the non-aborting claim/replay path and return OPERATION_ID_REUSED only after hash comparison.

## 13. Migration plan

### 13.1 Dependency gate

Before creating the Onboarding migration:

1. Pull final Recruitment and Asset commits.
2. Confirm actual migration order and names.
3. Run read-only Prisma migration status.
4. Confirm Recruitment conversion source IDs and Asset result tables.
5. Confirm Asset internal command and permission names.
6. Update this document only for real contract deltas.

Do not place the Onboarding migration ahead of pending Recruitment/Asset migrations it depends on.

### 13.2 Expand migration

- Add DEPARTMENT to WorkOwnerType in its own committed migration before any row writes use the value.
- Create dedicated Onboarding status enums and add nullable statusV2 shadow columns; do not alter the generic status columns during expand.
- Create OnboardingContractVersion and add contractVersion = LEGACY_V1 to every existing aggregate/task. Keep the database default LEGACY_V1 during compatibility so an old application instance cannot accidentally create a row classified as V2; V2 services always write V2 explicitly.
- Add new nullable snapshot, actor, result, version, source, and resolution columns.
- Create action-event and command-receipt tables.
- Add supporting Company-qualified unique keys and nullable composite FKs.
- Add new permissions and role mappings.
- Add indexes concurrently only when deployment procedure supports it; Prisma migrations otherwise use reviewed normal index creation during maintenance.
- Keep legacy columns and compatibility mirrors.
- Deploy compatibility services that dual-write legacy status and statusV2 before running controlled backfill.

The expand SQL begins with this shape, adjusted only for the final migration/table naming:

~~~sql
ALTER TYPE "WorkOwnerType" ADD VALUE IF NOT EXISTS 'DEPARTMENT';

CREATE TYPE "EmployeeOnboardingStatus" AS ENUM
  ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TYPE "EmployeeOnboardingTaskStatus" AS ENUM
  ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'WAIVED', 'CANCELLED');

CREATE TYPE "OnboardingContractVersion" AS ENUM ('LEGACY_V1', 'V2');

ALTER TABLE "EmployeeOnboarding"
  ADD COLUMN "statusV2" "EmployeeOnboardingStatus",
  ADD COLUMN "contractVersion" "OnboardingContractVersion" NOT NULL DEFAULT 'LEGACY_V1';

ALTER TABLE "EmployeeOnboardingTask"
  ADD COLUMN "statusV2" "EmployeeOnboardingTaskStatus",
  ADD COLUMN "contractVersion" "OnboardingContractVersion" NOT NULL DEFAULT 'LEGACY_V1';
~~~

If the PostgreSQL version cannot safely consume a newly added enum value in the remaining migration transaction, keep the WorkOwnerType change in a separate migration and deploy it first. Do not combine it with writes of DEPARTMENT rows.

### 13.3 Read-only preflight

Preflight must report and gate on:

~~~sql
-- Duplicate active Onboardings
SELECT "employeeId", count(*)
FROM "EmployeeOnboarding"
WHERE status = 'IN_PROGRESS'
GROUP BY "employeeId"
HAVING count(*) > 1;

-- Multiple current published Versions
SELECT "onboardingTemplateId", count(*)
FROM "OnboardingTemplateVersion"
WHERE status = 'PUBLISHED' AND "isCurrent" = true
GROUP BY "onboardingTemplateId"
HAVING count(*) > 1;

-- Completed Onboarding with incomplete mandatory tasks
SELECT eo.id, count(eot.id)
FROM "EmployeeOnboarding" eo
JOIN "EmployeeOnboardingTask" eot ON eot."onboardingId" = eo.id
WHERE eo.status = 'COMPLETED'
  AND eot."isMandatory" = true
  AND eot.status NOT IN ('COMPLETED', 'WAIVED')
GROUP BY eo.id;
~~~

Also report:

- conflicting active Designation defaults/Branch overrides;
- missing Template/Version/Employee relations;
- Department Company/Branch mismatch;
- named assigned Employee/Designation on current published versions;
- null/legacy/unsupported owners;
- DEPARTMENT UI values that could not be stored by current enum;
- persisted WAITING_APPROVAL or REJECTED task states;
- OVERDUE tasks and whether startedDate is present;
- dependency cycles and dependencies on optional or skippable tasks;
- invalid Asset Type references and LOCATION tracking;
- progress/counter drift;
- PENDING_ONBOARDING Employees with no or multiple Onboardings;
- mandatory Employee/Manager tasks without resolvable Users;
- mandatory Department tasks without executor Department;
- completed Asset tasks without an authoritative custody/allocation;
- unassigned mandatory tasks and Departments without active assigners.
- duplicate/missing ONBOARDING_STARTED, ONBOARDING_COMPLETED, and PROBATION_STARTED career events for the same source Onboarding;
- completed Recruitment-source Onboardings whose Employee status/career projection does not show the required Probation transition.

### 13.4 Controlled backfill

- EmployeeOnboarding status maps IN_PROGRESS/COMPLETED/CANCELLED directly; stop on any other state.
- EmployeeOnboardingTask:
  - NOT_STARTED → PENDING;
  - PENDING/IN_PROGRESS/COMPLETED/SKIPPED/CANCELLED map directly;
  - OVERDUE → PENDING when startedDate is null, otherwise IN_PROGRESS;
  - WAITING_APPROVAL and REJECTED require explicit reconciliation input.
- EMPLOYEE and MANAGER owner map directly.
- HR/IT/FINANCE/ADMIN map to DEPARTMENT only when the enclosing Department is unambiguous.
- SYSTEM, null, cross-Branch, named-person, and mismatched Department tasks require reconciliation; never guess.
- Populate Company/Branch/Employee/workstream/executor snapshots from the locked parent/version hierarchy.
- Backfill runtime version = 1 and draft rowVersion = 1.
- Backfill sourceType LEGACY for historical records.
- Backfill completedAt/completedDate mirrors.
- Recalculate authoritative totals/progress.
- Do not mutate historical published Template versions.
- Clone incompatible current published versions to Draft, transform the clone, validate it, and publish a replacement.
- Keep existing active legacy task rows readable through the compatibility mapper. Do not expose V2 commands for a row whose owner, Department, dependency, status, or Asset requirement remains ambiguous.
- Do not enable a Company/Branch until every active ambiguous row in that scope is reconciled or closed under an approved legacy procedure.
- Leave every imported row and task as LEGACY_V1 by default. Promote an aggregate and all of its tasks to V2 in one restricted reconciliation transaction only after Company/Branch/Department snapshots, owner/work/result shapes, assignment triples, terminal actors/dates, dependencies, counters, and required action evidence are authoritative. Do not synthesize a User actor, completion reason, assignment timestamp, or Asset result.
- A completed/cancelled historical aggregate with unavailable evidence remains LEGACY_V1 and read-only. Every active aggregate in an enabled Company/Branch must be V2; the enablement query fails if any parent or child remains LEGACY_V1.

After unresolved rows have been exported to the reconciliation report, the deterministic status backfill is:

~~~sql
UPDATE "EmployeeOnboarding"
SET "statusV2" = CASE status::text
  WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"EmployeeOnboardingStatus"
  WHEN 'COMPLETED' THEN 'COMPLETED'::"EmployeeOnboardingStatus"
  WHEN 'CANCELLED' THEN 'CANCELLED'::"EmployeeOnboardingStatus"
  ELSE NULL
END
WHERE "statusV2" IS NULL;

UPDATE "EmployeeOnboardingTask"
SET "statusV2" = CASE
  WHEN status::text IN ('NOT_STARTED', 'PENDING')
    THEN 'PENDING'::"EmployeeOnboardingTaskStatus"
  WHEN status::text = 'OVERDUE' AND "startedDate" IS NULL
    THEN 'PENDING'::"EmployeeOnboardingTaskStatus"
  WHEN status::text IN ('IN_PROGRESS', 'OVERDUE') AND "startedDate" IS NOT NULL
    THEN 'IN_PROGRESS'::"EmployeeOnboardingTaskStatus"
  WHEN status::text = 'COMPLETED'
    THEN 'COMPLETED'::"EmployeeOnboardingTaskStatus"
  WHEN status::text = 'SKIPPED'
    THEN 'SKIPPED'::"EmployeeOnboardingTaskStatus"
  WHEN status::text = 'CANCELLED'
    THEN 'CANCELLED'::"EmployeeOnboardingTaskStatus"
  ELSE NULL
END
WHERE "statusV2" IS NULL;
~~~

The backfill fails its gate while either statusV2 column remains null. WAITING_APPROVAL, REJECTED, unknown values, and contradictory started/resolved dates must be reconciled before continuing.

### 13.5 Contract migration

After all application instances read statusV2, dual-write has been verified, and old instances are drained:

- lock the two Onboarding tables during the controlled cutover;
- drop the old active-status partial index before renaming columns;
- rename status to legacyStatus and statusV2 to status;
- set the new status columns NOT NULL and their V2 defaults;
- retain LEGACY_V1 historical rows behind discriminator-guarded checks, install the contract-version immutability trigger, and change the database default to V2 only after every old application instance is drained;
- keep compatibility snapshot/owner/version fields physically nullable while any LEGACY_V1 row exists; enforce their non-null V2 shape through the named checks and contract-version trigger;
- add named checks;
- recreate active/source partial unique indexes;
- activate composite FKs;
- after every resolver instance filters by effective date, add the Designation assignment non-overlap constraints and drop designation_onboarding_default_active_uidx and designation_onboarding_branch_active_uidx in the same reviewed migration;
- drop or retain compatibility columns only according to repository-wide consumer search;
- keep historical named-assignment relations if required for immutable history, but prohibit writes;
- record post-migration verification results.

The status cutover SQL is:

~~~sql
LOCK TABLE "EmployeeOnboarding", "EmployeeOnboardingTask"
IN ACCESS EXCLUSIVE MODE;

DROP INDEX IF EXISTS "employee_onboarding_one_active_per_employee_idx";
DROP INDEX IF EXISTS "EmployeeOnboarding_status_idx";
DROP INDEX IF EXISTS "EmployeeOnboarding_companyId_status_idx";
DROP INDEX IF EXISTS "EmployeeOnboarding_employeeId_status_idx";
DROP INDEX IF EXISTS "EmployeeOnboardingTask_status_idx";
DROP INDEX IF EXISTS "EmployeeOnboardingTask_onboardingId_status_idx";
DROP INDEX IF EXISTS "EmployeeOnboardingTask_assignedToUserId_status_dueDate_idx";

ALTER TABLE "EmployeeOnboarding"
  RENAME COLUMN status TO "legacyStatus";
ALTER TABLE "EmployeeOnboarding"
  RENAME COLUMN "statusV2" TO status;
ALTER TABLE "EmployeeOnboarding"
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'IN_PROGRESS'::"EmployeeOnboardingStatus",
  ALTER COLUMN "contractVersion" SET DEFAULT 'V2'::"OnboardingContractVersion";

ALTER TABLE "EmployeeOnboardingTask"
  RENAME COLUMN status TO "legacyStatus";
ALTER TABLE "EmployeeOnboardingTask"
  RENAME COLUMN "statusV2" TO status;
ALTER TABLE "EmployeeOnboardingTask"
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'PENDING'::"EmployeeOnboardingTaskStatus",
  ALTER COLUMN "contractVersion" SET DEFAULT 'V2'::"OnboardingContractVersion";

CREATE UNIQUE INDEX "employee_onboarding_one_active_per_employee_idx"
ON "EmployeeOnboarding" ("employeeId")
WHERE status = 'IN_PROGRESS';

CREATE INDEX "EmployeeOnboarding_status_idx"
ON "EmployeeOnboarding" (status);
CREATE INDEX "EmployeeOnboarding_companyId_status_idx"
ON "EmployeeOnboarding" ("companyId", status);
CREATE INDEX "EmployeeOnboarding_employeeId_status_idx"
ON "EmployeeOnboarding" ("employeeId", status);

CREATE INDEX "EmployeeOnboardingTask_status_idx"
ON "EmployeeOnboardingTask" (status);
CREATE INDEX "EmployeeOnboardingTask_onboardingId_status_idx"
ON "EmployeeOnboardingTask" ("onboardingId", status);
CREATE INDEX "EmployeeOnboardingTask_assignedToUserId_status_dueDate_idx"
ON "EmployeeOnboardingTask" ("assignedToUserId", status, "dueDate");
CREATE INDEX "EmployeeOnboardingTask_department_queue_idx"
ON "EmployeeOnboardingTask" ("companyId", "branchId", "executorDepartmentId", status, "dueDate");
CREATE INDEX "EmployeeOnboardingTask_reminder_scan_idx"
ON "EmployeeOnboardingTask" ("companyId", status, "nextReminderDate");
~~~

Keep legacyStatus only through the verified compatibility window, then remove it in a later reviewed contract migration after repository-wide read/write search and rollback sign-off.
Only after the final LEGACY_V1 row has been authoritatively reconciled or expired under the records policy may a separate reviewed migration convert compatibility-nullable columns to database NOT NULL. That later migration is not an Onboarding V2 production-enable prerequisite.

Before enabling a scope, this query must return zero rows:

~~~sql
SELECT eo.id
FROM "EmployeeOnboarding" eo
LEFT JOIN "EmployeeOnboardingTask" eot ON eot."onboardingId" = eo.id
WHERE eo.status = 'IN_PROGRESS'
GROUP BY eo.id, eo."contractVersion"
HAVING eo."contractVersion" <> 'V2'
   OR count(eot.id) = 0
   OR count(*) FILTER (WHERE eot."contractVersion" <> 'V2') > 0;
~~~

### 13.6 Rollback and restore

- Expand migration rollback removes only unused additive objects before feature enablement.
- After backfill/contract, rollback is restore-forward: restore the rehearsed backup and redeploy the previous application.
- Never use prisma db push on shared/production PostgreSQL.
- Never mark a migration applied unless its SQL ran.
- Record schema, row counts, constraint/index presence, and reconciliation report before and after deployment.

## 14. Services and implementation structure

Create or extract:

- OnboardingTemplateResolutionService — one resolver for Recruitment and Onboarding.
- OnboardingActorContextService — User/Employee/Department/scope resolution.
- OnboardingCapabilityService — all allowedActions.
- OnboardingTransactionRunner — serializable transaction and bounded retry.
- OnboardingCommandReceiptService — claim/replay/hash.
- OnboardingProgressService — one progress definition.
- OnboardingAuditMapper — allowlisted, redacted before/after/action metadata.
- OnboardingNotificationService — safe outbox events/recipients.
- OnboardingReminderJob — due/unassigned/overdue producer.
- OnboardingAssetFulfillmentService — orchestrates final Asset internal primitives.
- OnboardingLegacyReconciliationService — restricted aggregate validator/promoter; never fabricates evidence and is unavailable through normal runtime controllers.

Controllers remain thin. Services must accept Prisma.TransactionClient for composed operations. Internal primitives do not begin nested transactions, claim nested receipts, or acquire locks out of order.

## 15. Test implementation

### 15.1 Unit/service

- Template owner/work-type/reference validation.
- Department inheritance.
- Scope predicates and direct-ID hiding.
- Resolver Branch/default/legacy/override precedence.
- Actor context and RoleScope handling.
- LEGACY_V1 read-only projection, command denial, and all-or-nothing authoritative promotion to V2.
- Dedicated legacy DTO preservation for unsupported historical owner/work/status strings without V2 coercion.
- allowedActions/actionCapabilities one-to-one mapping, NORMAL precedence, and reasoned HR_OVERRIDE descriptors for every persona/state.
- Assignee eligibility.
- Transition matrix and dependency rules.
- Progress and final-completion eligibility.
- Receipt hash/replay/conflict.
- Notification recipient/dedupe/redaction.
- Asset capability delegation.

### 15.2 Real PostgreSQL integration

- Cross-Company, cross-Branch, and cross-Department access.
- Concurrent normal starts and source-idempotent Recruitment starts.
- Assign versus assign/reassign.
- Reopen preflight graph versus a concurrent dependent mutation.
- Task complete versus Onboarding complete.
- Reopen prerequisite versus dependent completion.
- Complete/waive versus cancellation.
- Asset fulfillment versus direct Asset assignment/allocation.
- Exact Asset source replay and conflict.
- Final completion, Probation, career, audit, and outbox atomicity.
- DB checks, FKs, partial uniques, and trigger/error translation.

### 15.3 HTTP/API

- Permission and record scope for every route.
- Foreign direct IDs return safe 404.
- Paginated query/filter/sort allowlists.
- allowedActions match command authorization.
- Workspace-capability discovery, actor-scoped My Tasks, completion/reopen preflights, and protected task history projections.
- Protected reasons absent from ordinary responses/logs.
- Idempotent replay revalidates current authorization.
- Stable errors for versions, state, assignee, dependencies, and Assets.

### 15.4 Migration

- From-zero database.
- Upgrade copy with every legacy status/owner variant.
- Discriminator-guarded strict checks: historical LEGACY_V1 reads survive, malformed V2 inserts fail, and enabled scopes contain no active LEGACY_V1 aggregate/task.
- Preflight failure cases.
- Deterministic controlled backfill.
- Constraint and index verification.
- No mutation of historical published versions.
- Backup/restore rehearsal.

### 15.5 Real lifecycle

Real API/browser testing must prove:

1. HR publishes a Branch-valid designation template.
2. Recruitment/manual start resolves the correct version.
3. Department work appears only in its Department queue.
4. Department assigner selects an eligible member.
5. Assigned member completes Checklist work.
6. Employee and Manager complete their personal tasks.
7. Asset custodian fulfills physical and pool tasks.
8. Unauthorized Department/Company/Branch actors are denied.
9. HR override is separately permissioned and reasoned.
10. Final completion starts Probation and updates career/audit/outbox.

## 16. Rollout and production gates

Configuration:

~~~text
ONBOARDING_V2_ENABLED
ONBOARDING_V2_COMPANY_IDS
ONBOARDING_V2_BRANCH_IDS
ONBOARDING_REMINDERS_ENABLED
ONBOARDING_IDEMPOTENCY_ACTIVE_KEY_VERSION
ONBOARDING_IDEMPOTENCY_ACCEPTED_KEY_VERSIONS
~~~

Rules:

- Default V2 and reminders off.
- Enforce allowlist server-side; no client override.
- Mixed Company Group context must select a uniformly enabled Company/Branch.
- Asset tasks require the corresponding Asset V2 scope to be enabled.
- Jobs query only enabled scopes.
- Missing key versions, invalid allowlist IDs, missing notification catalog entries, or unavailable Asset V2 dependencies fail the affected scope closed and emit readiness errors.

Monitor:

- active Onboarding and completion counts;
- unassigned/overdue mandatory tasks;
- Departments without assigners;
- permission denials and foreign-ID attempts;
- version conflicts and retry exhaustion;
- Asset fulfillment failures/conflicts;
- outbox retries/dead letters;
- progress drift;
- legacy template fallback usage;
- completed Onboarding without Probation/career projection.

Production enablement requires:

- final Recruitment and Asset commits reviewed;
- migrations from zero and upgrade copy passed;
- reconciliation reports at zero or signed exceptions;
- all lint, type-check, build, unit, integration, API, and real-browser gates green;
- real S3/Asset/outbox/email dependencies verified as applicable;
- backup/restore and rollback rehearsed;
- technical UAT and business sign-off recorded.

## 17. Implementation order

1. Pull/review final Recruitment and Asset changes and freeze integration contracts.
2. Fix P0 template/workspace tenant scoping.
3. Add schema expand migration, permissions, and feature gates.
4. Implement controlled preflight/backfill tooling.
5. Implement shared resolver, actor context, capability, receipt, and transaction services.
6. Enforce V2 template DTO/publish contract.
7. Implement start/preflight and Recruitment integration.
8. Implement personal and Department queue reads.
9. Implement assignment and Checklist transitions.
10. Implement Asset fulfillment through Asset V2.
11. Implement final completion/cancellation and Probation integration.
12. Implement notifications/reminders and monitoring.
13. Integrate the companion UI plan.
14. Run contract migration, full verification, pilot, and production acceptance.

No later step may compensate for a failed tenant-isolation, migration, transaction, or authorization gate.
