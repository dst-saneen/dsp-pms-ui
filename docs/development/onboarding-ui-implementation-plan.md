# Onboarding V2 — Frontend and UI Implementation Plan

**Document status:** Approved implementation contract  
**Prepared:** 2026-08-18  
**Reviewed code baseline:** 563f4d4b86e45e1ad3c5303ff0ecac3919d0f0c0  
**Implementation status:** Documentation only; this document does not prove code, deployment, browser acceptance, or UAT completion  
**Authoritative backend contract:** [Onboarding DB/API Implementation Plan](./onboarding-db-api-implementation-plan.md)  
**Product boundary:** [Onboarding Department Flow](../product/onboarding-department-flow-gap-explained.md)  
**Asset dependency:** [Asset Management DB/API Implementation Plan](./asset-management-db-api-implementation-plan.md)  
**Recruitment frontend review:** [Recruitment to Onboarding UI Code Review](./recruitment-to-onboarding-ui-code-review.md)

## 1. Authority and UI outcome

This document is the source of truth for the Onboarding V2 frontend journeys, routes, typed API consumption, components, client state, error handling, accessibility, browser testing, and UI acceptance gates.

The database and API plan is authoritative whenever this document and the backend contract appear to differ. The UI must render server-provided state and capabilities. It must never reproduce authorization, Department scope, task transitions, dependency satisfaction, completion eligibility, progress, Asset eligibility, or override rules locally.

The required production experience is:

1. HR authors a designation and Branch-aware template using Department, Employee, and Manager owners only.
2. Normal Onboarding start resolves the published template automatically; HR does not choose a template.
3. HR monitors the complete Onboarding without receiving ordinary Department execution controls.
4. Department users work from a scoped queue determined by permission plus their active Employee Department.
5. Department assigners allocate work only to eligible active members returned by the server.
6. Every assigned Employee, Manager, or Department member sees their work in one personal queue.
7. Checklist and Asset work use distinct execution experiences.
8. Every action shown by the UI has both an allowedActions entry and matching actionCapabilities metadata in the current server response.
9. Final completion is an explicit HR action and displays the authoritative server readiness result.
10. All successful mutations refetch every affected Onboarding, Employee, career, Asset, and workspace projection.

## 2. Locked UX rules

### 2.1 Template ownership

- A support task belongs to the Department slice that contains it.
- The UI must not send a second Department for a Department-owned task.
- A template never assigns a named person.
- EMPLOYEE means the joining Employee and is resolved at runtime.
- MANAGER means the joining Employee's active reporting Manager and is resolved at runtime.
- DEPARTMENT creates an unassigned runtime task in the executor Department queue.
- Only DEPARTMENT, EMPLOYEE, and MANAGER are available for newly authored versions.
- Legacy owner values may be displayed in historical read-only screens but cannot be selected, cloned unchanged into a publishable draft, or submitted by a new editor.

### 2.2 Department authority

- There is no Department head field in the UI.
- There is no Department onboarding grant administration screen.
- A Department viewer or assigner is determined by the server from RBAC permission plus the actor's active Employee Department.
- The UI does not infer authority from a role name, job title, designation, Manager relationship, Department name, or navigation visibility.
- The assignee picker displays only active, user-linked candidates returned by the Department assignee-candidate API.
- A Department assigner can assign or reassign work but cannot complete a teammate's task.

### 2.3 HR and override behavior

- HR monitoring and Department task execution are separate capabilities.
- Ordinary hr.onboarding.read and hr.onboarding.manage do not grant task execution across Departments.
- Break-glass actions appear only when the server returns the relevant action under hr.onboarding.override.
- Every break-glass dialog displays a warning, requires a reason, and sends the current expectedTaskVersion and a stable operationId.
- Override actions must remain visually distinct from normal task actions and must not be the primary action on a page.

### 2.4 Executable work

- CHECKLIST and ASSET are the only authorable and executable work types in this release.
- Asset tasks require an Asset Type whose tracking mode is INDIVIDUAL or POOL.
- LOCATION-tracked Asset Types are not selectable.
- Asset tasks cannot display the generic Complete action.
- Employee Documents, approvals, generic workflow rules, forms, training, meetings, medical, email, and custom work execution are not exposed.

### 2.5 Progress and completion

- Progress is rendered from the backend projection without client recalculation.
- COMPLETED, SKIPPED, and WAIVED are terminal for progress.
- Dependencies are shown as satisfied only when the server says they are satisfied.
- Mandatory work must be COMPLETED or WAIVED before final completion.
- The final completion confirmation explains that unfinished optional tasks will be system-skipped.
- The UI never predicts Probation creation; it displays the committed response and then refetches career state.

## 3. Current UI baseline and required replacement

### 3.1 Existing surfaces to retain and refactor

The current product already has:

- HR Onboarding Template list and editor surfaces.
- Template version, validate, publish, draft, and history controls.
- HR Employee Onboarding list and detail pages.
- An Employee My Workspace Onboarding summary.
- A Manager Dashboard Onboarding summary.
- Shared page shells, tables, filters, dialogs, badges, lookups, notifications, and query infrastructure.

These foundations should be reused where their contracts match V2. Existing local permission or transition rules must be removed rather than layered underneath allowedActions.

### 3.2 Existing behavior that must not survive V2

- The owner selector currently exposes values that do not form one valid backend contract.
- The normal start form currently asks HR to choose an arbitrary template.
- HR task rows currently derive Start, Complete, Skip, and Reopen controls from status and flags.
- Unassigned work can currently receive execution controls in the HR view.
- My Workspace currently presents a limited read-only task summary rather than an actor-scoped work queue.
- Manager Dashboard currently presents organization-scoped pending work instead of only tasks assigned to the authenticated Manager.
- Different surfaces currently calculate progress differently.
- The quick-grid authoring path creates client identifiers without a complete create/update/delete persistence lifecycle.
- The current frontend has no stable allowedActions contract.

V2 activation is blocked until each affected surface consumes the same authoritative response model.

## 4. Route and navigation contract

### 4.1 HR routes

| Route | Purpose | Normal mutation authority |
|---|---|---|
| /hr/onboarding-templates | Search, create, clone, validate, publish, archive, and inspect template versions | Template lifecycle permissions returned by the API |
| /hr/onboarding-templates/[id] | Edit one draft and inspect published history | Server-returned template actions |
| /hr/employee-onboarding | Start Onboarding and monitor authorized Employee Onboardings | Start, cancel, and final completion only when allowed |
| /hr/employee-onboarding/[id] | Monitor task, Department, exception, progress, and career readiness | Onboarding-level actions and explicit override task actions only |

The HR navigation remains under the HR area. Access to a route does not imply access to every mutation rendered inside it.

### 4.2 My Workspace route

Add one route:

- /my-workspace/onboarding

This route contains:

- My Tasks
- Department Queue
- My Own Onboarding summary when the authenticated User is the subject of an active or historical Onboarding

Department Queue discovery uses `GET /me/onboarding/workspace-capabilities`, not `GET /me/onboarding`. The capability response is intentionally separate from the Employee's own Onboarding projection:

~~~ts
export interface OnboardingWorkspaceCapabilitiesView {
  sections: Array<"MY_TASKS" | "DEPARTMENT_QUEUE">;
}
~~~

`DEPARTMENT_QUEUE` is returned only after the server resolves the authenticated User's active Employee, current Department, organization scope, feature scope, and Department read permission. The response contains no Department label, ID, or count. Those values are loaded only from the subsequently authorized Department Queue response. The frontend must not reveal a disabled tab, Department name, count, or tooltip that exposes unavailable work.

### 4.3 Deep links

Notification links use route-owned query state:

- /my-workspace/onboarding?taskId={taskId}
- /hr/employee-onboarding/{onboardingId}?taskId={taskId}

Opening a deep link fetches the scoped detail endpoint. The list response is not treated as authorization. A stale or foreign task returns the standard denied or not-found state without leaking Employee, Department, or Asset details.

### 4.4 Manager Dashboard integration

The Manager Dashboard summary consumes the same My Tasks API as My Workspace and filters only the already actor-scoped response for presentation. The organization-wide pending Onboarding query must be removed. Selecting an item deep-links to /my-workspace/onboarding.

## 5. Persona and capability matrix

| Persona | Can see | Can normally mutate | Must not receive |
|---|---|---|---|
| HR Template administrator | Authorized Templates, drafts, versions, validation | Draft lifecycle actions returned by the server | Department task execution by virtue of Template access |
| HR monitor | Authorized Onboardings and all task status in organization scope | Start, cancel, final complete when allowed | Ordinary Department Complete, Skip, Start, or Reopen controls |
| HR override user | HR monitor view plus server-authorized exception actions | Reasoned reassign, reopen, complete, or waive | Unreasoned or locally inferred override controls |
| Department viewer | Own Department queue | None unless another capability is returned | Other Departments, assignee candidates, or hidden counts |
| Department assigner | Own Department queue and eligible candidates | Assign, reassign, unassign, Department reopen when returned | Teammate Complete or cross-Department assignment |
| Assigned Department Employee | Tasks assigned to authenticated User | Start, Complete, Skip when returned | Unassigned queue unless Department read is also granted |
| New Employee | Own Onboarding summary and tasks assigned to authenticated User | Actor-scoped task actions | Other Employee Onboardings |
| Reporting Manager | Manager tasks assigned to authenticated User | Actor-scoped task actions | Organization-wide pending tasks |
| Asset custodian | Asset fulfillment only when both modules authorize it | FULFILL_ASSET when returned | Onboarding authority from Asset permission alone |
| Other Department user | Personal tasks assigned to the User | Actions on those assignments only | Source Department queue visibility unless separately authorized by the server contract |
| Other Company or Branch user | Nothing outside resolved scope | Nothing | Identifiers, counts, candidate names, or existence hints |

A person can match more than one persona. The server resolves the combined capabilities for each record. The UI renders the returned union without reconstructing how it was granted.

## 6. Frontend contract architecture

### 6.1 Type ownership

Frontend types must be generated from, or validated against, the final API DTO definitions. Hand-maintained copies are acceptable only while generation is unavailable and must have contract tests against recorded API fixtures.

The frontend must define no broader action string than the server contract:

~~~ts
export type EmployeeOnboardingAllowedAction =
  | "CANCEL"
  | "COMPLETE";

export type EmployeeOnboardingTaskAllowedAction =
  | "ASSIGN"
  | "REASSIGN"
  | "UNASSIGN"
  | "START"
  | "COMPLETE"
  | "SKIP"
  | "REOPEN"
  | "FULFILL_ASSET"
  | "WAIVE";

export type EmployeeOnboardingTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "SKIPPED"
  | "WAIVED"
  | "CANCELLED";

export type OnboardingTaskActionType =
  | "ASSIGNED"
  | "REASSIGNED"
  | "UNASSIGNED"
  | "STARTED"
  | "COMPLETED"
  | "OVERRIDE_COMPLETED"
  | "SKIPPED"
  | "AUTO_SKIPPED"
  | "REOPENED"
  | "WAIVED"
  | "CANCELLED";

export type OnboardingTemplateAllowedAction =
  | "CREATE"
  | "CREATE_DRAFT"
  | "EDIT_DRAFT"
  | "CLONE"
  | "VALIDATE"
  | "PUBLISH"
  | "ARCHIVE"
  | "VIEW_HISTORY";

export type DesignationOnboardingAssignmentAllowedAction =
  | "CREATE"
  | "EDIT"
  | "DEACTIVATE";
~~~

Unknown future action values are ignored and logged as a client-contract mismatch. They must not activate a fallback button.

Runtime Onboarding and task responses also carry the immutable compatibility classification:

~~~ts
export type OnboardingContractVersion = "LEGACY_V1" | "V2";

export type RuntimeAuthorityMode = "NORMAL" | "HR_OVERRIDE";
export type RuntimeReasonField = "reason" | "overrideReason" | null;

export interface RuntimeActionCapability<TAction extends string> {
  action: TAction;
  authorityMode: RuntimeAuthorityMode;
  reasonRequired: boolean;
  reasonField: RuntimeReasonField;
  remarksRequired: boolean;
  confirmationTone: "NORMAL" | "WARNING" | "BREAK_GLASS";
  candidateScope?: "EXECUTOR_DEPARTMENT" | "HR_OVERRIDE_BRANCH";
  preflight?: "NONE" | "REOPEN" | "ONBOARDING_COMPLETE";
}
~~~

`allowedActions` is the compact action allowlist. `actionCapabilities` is the per-action rendering and request metadata for those same actions. An action is rendered only when it appears in `allowedActions` and has exactly one matching capability entry. A missing, duplicate, or contradictory capability entry fails closed, hides the control, refetches the resource, and records a safe client-contract mismatch. The UI does not infer override mode, reason requirements, candidate scope, confirmation tone, or preflight requirements from the route or role.

### 6.2 Runtime task projection

The task view model mirrors the typed API response and retains every field needed to render without local policy calculations:

~~~ts
export interface V2EmployeeOnboardingTaskView {
  id: string;
  onboardingId: string;
  contractVersion: OnboardingContractVersion;
  version: number;
  attemptNo: number;
  status: EmployeeOnboardingTaskStatus;
  ownerType: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";
  taskName: string;
  description: string | null;
  sequenceNo: number;
  priority: number;
  isMandatory: boolean;
  allowSkip: boolean;
  allowReopen: boolean;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
  };
  organization: {
    company: { id: string; code: string; name: string };
    branch: { id: string; code: string; name: string; timeZone: string };
  };
  workstreamDepartment: { id: string; name: string };
  executorDepartment: { id: string; name: string } | null;
  assignee: {
    userId: string;
    employeeId: string;
    displayName: string;
  } | null;
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
  dueDate: string | null;
  dueState: "NONE" | "UPCOMING" | "DUE_SOON" | "OVERDUE";
  startedAt: string | null;
  resolvedAt: string | null;
  requirement: {
    workType: "CHECKLIST" | "ASSET";
    referenceType: "ASSET_TYPE" | null;
    referenceId: string | null;
    referenceCode: string | null;
    referenceName: string | null;
    assetKind: "GENERAL" | "HARDWARE" | "CARD" | "SOFTWARE_LICENSE" | null;
    assetTrackingMode: "INDIVIDUAL" | "POOL" | null;
    assetEligibilityScope: "SAME_BRANCH" | "SAME_COMPANY" | null;
  };
  result: AssetFulfillmentResultView | null;
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: Array<
    RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
  >;
}

export interface AssetFulfillmentResultView {
  type: "EMPLOYEE_ASSET" | "SOFTWARE_LICENSE_ALLOCATION";
  id: string;
  assetId: string;
  safeAssetLabel: string;
}
~~~

The UI may format these values but must not recalculate dueState, dependency satisfaction, allowedActions, or completion readiness.

### 6.3 Onboarding projection

~~~ts
export interface V2EmployeeOnboardingView {
  id: string;
  contractVersion: OnboardingContractVersion;
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
    canComplete: boolean;
    percent: number;
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
  tasks?: V2EmployeeOnboardingTaskView[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: Array<
    RuntimeActionCapability<EmployeeOnboardingAllowedAction>
  >;
}

export interface LegacyEmployeeOnboardingTaskView {
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

export interface LegacyEmployeeOnboardingView {
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
  progress: { total: number | null; terminal: number | null; percent: number | null };
  tasks?: LegacyEmployeeOnboardingTaskView[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: [];
  actionCapabilities: [];
}

export type EmployeeOnboardingTaskView =
  | V2EmployeeOnboardingTaskView
  | LegacyEmployeeOnboardingTaskView;

export type EmployeeOnboardingView =
  | V2EmployeeOnboardingView
  | LegacyEmployeeOnboardingView;
~~~

The API mapper preserves these public property names and performs no scope, status, progress, dependency, due-state, or action calculation. Raw IDs and snapshot values remain traceable to the typed backend response.

The mapper must provide the safe organization names and Branch `timeZone` required for presentation; the UI must not join organization masters independently or substitute the browser timezone. `templateCode`, Asset kind, tracking mode, and eligibility scope are part of the typed projection rather than inferred from labels or reference IDs.

### 6.3.1 Legacy compatibility UX

`LEGACY_V1` Onboardings and tasks remain viewable only through their scoped compatibility projections. The HR list and detail, Employee self-summary, and task drawer show a `Legacy — read only` badge and a concise reconciliation message. They render the safe status, snapshots, progress supplied by the compatibility mapper, and safe history where available.

The frontend must ignore and report any runtime mutation action accidentally returned for `LEGACY_V1`. It must not show assignment, execution, override, Asset fulfillment, final-completion, or cancellation controls, and it must not attempt to convert a row by editing client state. Direct command errors with `ONBOARDING_LEGACY_RECONCILIATION_REQUIRED` refresh the record and retain the read-only view. V2 controls become available only after a fresh response identifies the record as `contractVersion: "V2"`.

### 6.4 Paged list and query contract

All paged lists consume:

~~~ts
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
~~~

The query layer uses keyword and sortOrder exactly. It does not substitute search, query, pageSize, sortDirection, or archived unless a specific endpoint defines those fields.

Every sortBy select is populated from the endpoint's allowlist. The UI must not submit column keys that the API has not declared sortable.

### 6.5 Command identity and versions

Every mutation:

1. Creates a UUID operationId when the user confirms a new intent.
2. Retains that operationId for transport retries of the exact same body.
3. Sends the relevant optimistic token: expectedVersion for Template drafts, expectedTaskVersion for task commands, expectedOnboardingVersion for final completion/cancellation, and the Asset version required by fulfillment.
4. Creates a new operationId after the user changes a material field or accepts refreshed state.
5. Does not create a new operationId merely because a network retry button was pressed.

A dialog stores operationId and its relevant expected version together. Closing and reopening the dialog starts a new intent unless the product explicitly restores an unsent draft.

## 7. Template authoring experience

### 7.1 Template list

The Template list displays:

- Template name and code.
- Designation assignment.
- Branch assignment context.
- Current published version.
- Draft version when one exists.
- Active/archive state.
- Last validation result and validation timestamp.
- Server-returned lifecycle actions.

Filters include Company/Branch context from the application scope selector, designation, lifecycle state, and keyword. A mixed Company Group context that is not uniformly enabled must show the server's select-Company-or-Branch instruction and must not fall back to a blended V1/V2 list.

The list consumes OnboardingTemplateListResponse. `Create Template` appears only when collectionAllowedActions contains CREATE. Every row/editor lifecycle button comes only from that Template or selected Version's allowedActions; route access does not imply create, clone, validate, publish, archive, or history authority.

#### 7.1.1 Designation default and Branch override assignments

The Template administration area includes an Assignment panel backed by /designation-onboarding-assignments. It shows:

- Designation.
- Default or concrete Branch override scope.
- Assigned Template.
- Effective-from and optional effective-to dates.
- Active/deactivated state.
- Current optimistic version.

The panel consumes DesignationOnboardingAssignmentListResponse. `Add assignment` appears only when collectionAllowedActions contains CREATE. Create and edit dialogs use scoped Designation, Branch, and Template lookups. They do not allow a Company ID to be entered. A Branch override is visually distinct from the Designation default and the panel explains the resolver precedence.

The UI may prevent a visibly overlapping date range, but only the server decides overlap under concurrency. A conflict preserves input, refetches assignments, and highlights the conflicting effective range. Deactivation is a separate reasoned action; no hard-delete control is exposed.
EDIT and DEACTIVATE controls are rendered only from each assignment row's allowedActions.

### 7.2 Template editor hierarchy

The editor hierarchy is:

~~~text
Template
└── Published or draft Version
    ├── Branch and Designation assignment context
    └── Department slice
        └── Task group
            └── Task
~~~

The Department slice is the source of workstream Department and, for DEPARTMENT owner tasks, executor Department. The task form displays the inherited Department as read-only context and does not submit a mutable Department identifier.

### 7.3 Canonical persistence path

Keep one server-persisted task authoring path.

The selected path must support:

- Create with a server identifier.
- Update with expectedVersion.
- Delete or archive with expectedVersion.
- Deterministic task and group reordering.
- Dependency selection restricted to the same saved Version.
- Save-before-validate and save-before-publish.
- Recovery after field validation or version conflict.

The client-only quick grid must either be removed from V2 routes or repaired to persist create, update, delete, and reorder operations. Client-generated placeholder task IDs must never be sent as if they were existing server records.

### 7.4 Task editor fields

The task editor exposes:

- Name.
- Description.
- Sequence.
- Mandatory flag.
- Optional allow-skip and allow-reopen flags.
- Due-day rule.
- Owner: Department, Employee, or Manager.
- Work type: Checklist or Asset.
- Prerequisite task from the same saved Version.
- Asset Type when work type is Asset.

It never exposes:

- Named Employee assignment.
- Named Designation assignment.
- A second Department selector for a Department-owned task.
- HR, IT, Finance, Admin, System, or Designation owner options.
- Approval steps.
- Generic workflow rules or execution profiles.
- Document upload automation.
- Unsupported work types.

### 7.5 Owner behavior

When Department is selected:

- Display the enclosing Department name and Branch.
- Explain that the runtime task starts unassigned in that Department queue.
- Require Asset tasks to remain Department-owned.

When Employee is selected:

- Explain that the joining Employee is resolved at start.
- Display no person picker.

When Manager is selected:

- Explain that the joining Employee's active reporting Manager is resolved at start.
- Display no person picker.

Switching owner clears incompatible local draft values before submission. Server validation remains authoritative even when the client has already prevented an invalid combination.

### 7.6 Asset task editor

The Asset Type lookup is scoped by the current Company and Branch and requests only active V2 Asset Types. Each option displays:

- Asset Type name and code.
- Kind.
- Tracking mode.
- Owning organization context where relevant.

INDIVIDUAL and POOL are selectable. LOCATION is displayed only in an explanatory disabled result if the shared lookup cannot filter it server-side; the preferred API returns no ineligible row.

Changing a task from Asset to Checklist clears its Asset reference. Changing the selected Asset Type revalidates the task against the current feature scope.

### 7.7 Validation and publish

Validate operates on the last saved draft. Unsaved changes trigger a save prompt before validation.

The validation response is rendered in two forms:

- A summary grouped by Template, Department, group, and task.
- A field-level message adjacent to the affected input.

Errors deep-link or scroll to the affected task. Version conflicts preserve the unsaved form values, refetch the server version, and present an explicit compare-and-reapply workflow. The client must not silently overwrite a newer draft.

Publish is displayed only when returned by the server. The confirmation shows the exact draft version, Designation, Branch, Department count, task count, and validation result. It does not claim that publication changes existing runtime snapshots.

### 7.8 Historical versions

Historical published versions are read-only. Legacy owners, unsupported work types, or named assignments are labeled Historical configuration. Clone creates a draft, but the new draft cannot publish until every incompatibility is corrected.

## 8. Start Onboarding experience

### 8.1 Entry points

Start Onboarding is available from:

- The HR Employee Onboarding list.
- An eligible Employee detail action.
- Recruitment conversion through the backend, without a separate interactive UI action.

Both HR entry points open the same normal start form.

### 8.2 Normal start form

The normal form contains:

- Employee.
- Start date.
- Optional remarks.

It does not contain a Template selector.

Employee or start-date changes call:

- GET /employee-onboarding/preflight?employeeId={id}&startDate={date}

The normal preflight request never supplies an override Template. When an authorized user opens Override Start and selects a Template, the UI requests the override form of the same preflight contract with `overrideTemplateId={templateId}`. The response is mode-specific: normal preflight may authorize `START`; override preflight may authorize `OVERRIDE_START`. The client never copies an action or `canStart` value from one mode into the other.

The preflight panel displays:

- Resolved Template name and code.
- Published Version number.
- Resolution source: Branch override, Designation default, or temporary legacy fallback.
- Employee Branch, Department, and Designation.
- Department and task summary.
- Mandatory Employee/Manager actor checks.
- Department no-assigner warnings.
- Asset V2 availability warnings or blockers.
- Every blocking issue and non-blocking warning supplied by the server.

The normal submit button is enabled only when `canStart === true` and `allowedActions` contains `START`. `canStart` without `START`, or `START` without `canStart`, is a contract mismatch and fails closed. The UI does not override or reinterpret a blocker.

### 8.3 Start command

The confirmed request is:

~~~ts
{
  employeeId: string;
  startDate: string;
  remarks?: string;
  operationId: string;
}
~~~

On success, navigate to the returned Onboarding detail and call the common `invalidateOnboardingRuntime()` helper. Start and override-start do not maintain a smaller route-specific refresh list.

### 8.4 Override start

Override start is a separate dialog and command. It is never a toggle inside the normal form.

The dialog requires:

- Employee.
- Start date.
- A published Template selected from a server-scoped lookup.
- Mandatory reason.
- Optional remarks.

It displays the automatic resolution, or its stable failure code, beside the selected override so the user can see what is being replaced or why no normal result exists. The override command is visible and enabled only when the current override preflight returns `canStart === true` and `allowedActions` contains `OVERRIDE_START`. Either value without the other fails closed. Rejected permission or scope must close the capability after refetch.

## 9. HR Onboarding list and monitor

### 9.1 List page

The HR list consumes GET /employee-onboarding and displays:

- Employee name and code.
- Branch, Department, and Designation snapshots.
- Template and resolution source.
- Status.
- Authoritative progress.
- Mandatory remaining count.
- Unassigned and overdue exception counts.
- Start and completion dates.
- Server-returned row actions.

Filters include keyword, status, Branch, Department, Designation, due exception, and start-date range when supported by the API. Every filter is server-side. The page never fetches an unscoped organization list and hides records in the browser.

### 9.2 Detail header

The detail header displays:

- Employee identity and snapshot organization.
- Onboarding status and version.
- Template, published Version, and resolution source.
- Start date and actor.
- Authoritative overall progress.
- Mandatory remaining count.
- Onboarding-level blocked reasons.
- CANCEL or COMPLETE only when included in allowedActions.

### 9.3 Department monitor

Tasks are grouped by workstream Department. Each Department card displays:

- Total and terminal task count.
- Mandatory remaining count.
- Unassigned count.
- Due-soon and overdue count.
- Authoritative percent.

Task rows display owner type, executor Department, assignee, work type, dependency, due state, status, and Asset result. Ordinary HR sees no task execution buttons when allowedActions is empty.

### 9.4 Final completion

Opening COMPLETE first loads `GET /employee-onboarding/:id/completion-preflight`. The dialog does not reuse a list row or an earlier detail response as completion evidence.

~~~ts
export interface OnboardingCompletionPreflightView {
  onboardingId: string;
  contractVersion: OnboardingContractVersion;
  expectedOnboardingVersion: number;
  canComplete: boolean;
  mandatoryRemaining: number;
  optionalTasksToAutoSkip: number;
  probationWillStart: boolean;
  blockedReasons: Array<{ code: string; message: string; taskId?: string }>;
  warnings: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: Array<
    RuntimeActionCapability<EmployeeOnboardingAllowedAction>
  >;
}
~~~

The confirmation displays:

- Mandatory readiness from the completion preflight.
- The authoritative `optionalTasksToAutoSkip` count.
- `expectedOnboardingVersion` from that preflight.
- The authoritative `probationWillStart` outcome.

Confirm is enabled only when `canComplete === true`, `contractVersion === "V2"`, `COMPLETE` is present, and its matching capability declares `preflight: "ONBOARDING_COMPLETE"`. The UI does not enumerate an optimistic set of tasks to mutate. It sends only the final completion command with the preflight version, then renders the committed response including the actual `probationStarted` value.

A MANDATORY_TASKS_INCOMPLETE or ONBOARDING_STATE_CHANGED response closes no evidence, preserves page position, refetches the complete detail, and highlights the new blockers.

### 9.5 Cancellation

CANCEL requires a reason and explicit confirmation. The confirmation states:

- Non-terminal Onboarding tasks will be cancelled by the backend.
- Already assigned Assets or licence allocations are not automatically returned or revoked.
- Asset custody remains visible and must be resolved through Asset workflows.

After success, call the common `invalidateOnboardingRuntime()` helper.
Render outstandingAssetResults from the cancellation response as safe follow-up links for actors who retain Asset read access; otherwise show only the count and general Asset-resolution instruction.

### 9.6 HR override controls

Override actions are rendered in an Exception actions menu only when the action is present in task `allowedActions` and its matching `actionCapabilities` entry has `authorityMode: "HR_OVERRIDE"`.

Supported override journeys are:

- Reassign.
- Reopen.
- Complete Checklist work.
- Waive.

Every dialog shows the Employee, task, Department, current state, current assignee, expectedTaskVersion, and the reason/remarks controls declared by the matching capability. For HR override Checklist COMPLETE, `reasonRequired` must be true and `reasonField` must be `overrideReason`; otherwise the UI hides the action as a contract mismatch. Override completion is unavailable for an Asset task unless the server returns WAIVE; it must not fabricate an Asset result.

## 10. My Workspace Onboarding

### 10.1 Page composition

The page contains:

1. My Own Onboarding summary, when applicable.
2. My Tasks tab.
3. Department Queue tab when returned as available.

The My Own Onboarding summary and My Tasks queue remain separate. A User can be the subject of one Onboarding while also completing Department or Manager tasks for other Employees.

### 10.2 My Own Onboarding summary

The summary consumes GET /me/onboarding and displays:

- Status and authoritative progress.
- Start date and Template label.
- Mandatory remaining count.
- Department progress summary.
- Next blocked or actionable task, if supplied.
- Link to the My Tasks tab.

It does not calculate progress from the visible subset of tasks.

### 10.3 My Tasks

My Tasks consumes `GET /me/onboarding-tasks`. It contains every visible task currently assigned to the authenticated User, including:

- Employee-owned tasks for the User's own Onboarding.
- Manager-owned tasks for direct reports.
- Department tasks assigned to the User.

The exact query contract is:

~~~ts
export interface MyOnboardingTasksQuery {
  status?:
    | "PENDING"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "SKIPPED"
    | "WAIVED"
    | "CANCELLED";
  dueState?: "ALL" | "DUE_SOON" | "OVERDUE";
  workType?: "CHECKLIST" | "ASSET";
  ownerType?: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";
  employeeId?: string;
  executorDepartmentId?: string;
  keyword?: string;
  page: number;
  limit: number;
  sortBy: "dueDate" | "priority" | "taskName" | "status" | "updatedAt";
  sortOrder: "ASC" | "DESC";
}
~~~

The shared pagination contract defaults to `page=1` and `limit=10`; page and limit must be integers, page must be at least 1, and limit must be from 1 through 100. The visible page-size choices are 10, 25, 50, and 100. The initial sort is `sortBy=dueDate` and `sortOrder=ASC`; the server places null due dates last and uses priority descending, sequence number ascending, then task ID ascending as deterministic tie-breakers. `keyword` searches only the safe Employee code/display name and task name fields authorized for the actor. Changing any filter or sort resets page to 1. The browser sends only the fields above and never performs local post-filtering or sorting.

Every item opens the shared task drawer. Cards and rows render only the task's allowedActions.

### 10.4 Department Queue

Department Queue consumes GET /employee-onboarding-task/department-queue. The server resolves the Department; the browser does not submit an arbitrary Department ID as authority.

Filters are:

- Unassigned.
- Assigned.
- Due Soon.
- Overdue.
- Completed.
- Employee keyword.
- Work type.

A viewer can inspect rows and task details. An assigner receives ASSIGN, REASSIGN, UNASSIGN, or REOPEN only when currently valid. Queue counts and filters come from the same scoped API response and must not include another Department.

### 10.5 Empty states

- My Tasks: No onboarding tasks are assigned to you.
- Department Queue: No onboarding work matches this Department filter.
- My Own Onboarding: No active onboarding is associated with your employee account.

An empty authorized queue is distinct from a denied queue. Denied access must not render a zero count that suggests a Department exists.

## 11. Shared task detail and actions

### 11.1 Task drawer

The same task drawer is used from HR monitoring, My Tasks, Department Queue, Manager Dashboard deep links, and notifications. It always refetches GET /employee-onboarding-task/:id when opened.

It displays:

- Employee and Onboarding summary.
- Task name, description, mandatory flag, and work type.
- Workstream and executor Departments.
- Owner type and current assignee.
- Dependency and its current server-evaluated satisfaction.
- Due date and due state.
- Requirement and Asset Type details.
- Fulfillment result when present.
- Blocked reasons.
- Assignment and action history loaded from `GET /employee-onboarding-task/:id/history?page={page}&limit={limit}&sortOrder={ASC|DESC}` only when the actor is permitted to read it; its only sort field is `createdAt`.
- Current version.
- Buttons for exact allowedActions only.

The history endpoint returns:

~~~ts
export interface OnboardingTaskHistoryItemView {
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

It is wrapped in `PagedResult<OnboardingTaskHistoryItemView>`. Protected `reason` is `null` unless the viewer is the action participant or has override authority. The response omits remarks, private evidence, Asset secrets, receipt data, and notification payloads. The drawer loads history lazily; task detail does not embed an unbounded event list.

### 11.2 Action bar rendering

The action bar follows these mechanical rules:

- Render an action only when its exact string appears in allowedActions and exactly one matching actionCapabilities entry is present.
- Do not infer actions from status, owner type, isMandatory, allowSkip, allowReopen, role, route, or Department.
- Disable all controls for that task while a mutation is pending.
- Do not optimistically change assignment, status, progress, or Asset availability.
- After success, replace or refetch the server projection before showing final success.
- If the response removes a previously displayed action, close its dialog and explain that access or state changed.

### 11.3 Assign

ASSIGN opens a candidate lookup populated only through `GET /employee-onboarding-task/:id/assignee-candidates` for the current task. The response uses the shared paged envelope and the following deliberately small item projection:

~~~ts
export interface OnboardingAssigneeCandidateView {
  employeeId: string;
  userId: string;
  employeeCode: string;
  displayName: string;
  isActive: true;
  designation: { id: string; code: string; name: string } | null;
  department: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string };
}
~~~

The dialog consumes `PagedResult<OnboardingAssigneeCandidateView>`, displays only these safe fields, and accepts `keyword`, page, limit, `sortBy=employeeCode|displayName`, and sortOrder. It does not allow free-text IDs or users outside returned results.

Candidate scope comes from the matching action capability and is still enforced by the server:

- `EXECUTOR_DEPARTMENT`: normal Department ASSIGN/REASSIGN and HR override REASSIGN of DEPARTMENT work return only active, user-linked Employees in the task Company, Branch, and executor Department.
- `HR_OVERRIDE_BRANCH`: HR override REASSIGN of EMPLOYEE or MANAGER work returns active, user-linked Employees in the same Company and Branch; those task shapes have no executor Department, and reassignment does not change the immutable template owner or workstream.

The candidate endpoint accepts the HR override path only when the actor has `hr.onboarding.override`, the record-level REASSIGN action is currently allowed, and the capability reports `authorityMode: "HR_OVERRIDE"`. ASSIGN is never returned with HR override authority. The override request does not additionally require Department assignment permission. The browser never broadens or narrows candidates locally.

Assigning self uses the same candidate result and command. The command body includes assigneeEmployeeId, expectedTaskVersion, and operationId.

### 11.4 Reassign

REASSIGN shows the current assignee, new eligible assignee, and mandatory reason. It uses the same capability-selected candidate rules as ASSIGN. It does not first unassign the task. In-progress work must move through the single reassign command.

The UI explains that reassignment preserves action history. A version conflict keeps the entered reason and candidate selection while refreshing the current assignee for review.

### 11.5 Unassign

UNASSIGN requires a non-empty reason, the current expectedTaskVersion, and operationId. Its matching capability must declare `reasonRequired: true` and `reasonField: "reason"`; otherwise the UI fails closed. It is shown only when the server permits the current pending state. The UI does not offer Unassign for in-progress work.

### 11.6 Start and checklist complete

START and COMPLETE are normal assigned-actor actions only when their capability reports `authorityMode: "NORMAL"`. COMPLETE is rendered only for CHECKLIST work. An HR override COMPLETE uses the Exception actions menu and the capability-declared `overrideReason`; it never reuses the ordinary completion dialog.

The completion dialog displays any server-declared remarks or evidence requirements. It does not allow a Department assigner to complete work merely because that user can see the task.

### 11.7 Skip

SKIP requires a reason. The UI does not decide whether work is optional or allowSkip is true; the presence of SKIP is authoritative.

The confirmation explains that a skipped optional task counts as terminal progress but does not create an Asset or checklist completion result.

### 11.8 Reopen

REOPEN requires a reason and a fresh preflight. When the matching capability declares `preflight: "REOPEN"`, opening the dialog calls `GET /employee-onboarding-task/:id/reopen-preflight`. The returned `expectedTaskVersion`, not the earlier drawer version, is the target command token.

~~~ts
export interface ReopenTaskPreflightView {
  taskId: string;
  contractVersion: OnboardingContractVersion;
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
  blockedReasons: Array<{ code: string; message: string; taskId?: string }>;
  assetResultState: "NONE" | "TERMINAL" | "ACTIVE_CUSTODY";
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: Array<
    RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>
  >;
}
~~~

The confirmation lists the single `TARGET` plus every `DEPENDENT` that the one atomic command will reopen, the attempt change, and any retained Asset-result history. Confirm is enabled only when `contractVersion === "V2"`, `canReopen === true`, REOPEN is still present, and the preflight capability still requires the reason. The command sends `expectedTaskVersion` from the preflight and builds `dependentTaskVersions` only from entries whose `role === "DEPENDENT"`; it never includes the TARGET in that array and never issues cascade calls. `ACTIVE_CUSTODY` or any blocker removes confirm and shows the permitted Asset follow-up. A 409 discards the stale preflight, preserves the reason, refetches task/preflight/history, and requires a new confirmation and operationId.

### 11.9 Waive

WAIVE is a break-glass HR action with a mandatory reason. It is visually labeled as an exception, never as Complete. For Asset work it records no custody or allocation reference and the result is displayed as Waived with protected evidence available only to authorized viewers.

## 12. Asset fulfillment experience

### 12.1 Capability intersection

The Asset fulfillment drawer opens only when FULFILL_ASSET is returned. This action proves that the backend has intersected:

- Current Onboarding task authority.
- Current assignee or override requirements.
- Asset V2 Company/Branch feature scope.
- Applicable Asset permission and Department grant.
- Task state and dependency state.

The frontend does not separately combine role names or Asset permissions to invent this action.

### 12.2 Requirement header

The drawer displays the immutable requirement snapshot:

- Required Asset Type.
- Kind.
- Tracking mode.
- Employee recipient.
- Executor Department.
- Physical same-Branch or software same-Company rule supplied by the API.
- Any blocked reason.

### 12.3 Eligible inventory

The drawer requests eligible candidates through GET /employee-onboarding-task/:id/asset-candidates, which delegates to Asset V2 using the locked task requirement. It must not fetch all Assets and filter them in the browser. The typed candidate response includes the requirement's Asset kind, tracking mode, and eligibility scope (`SAME_BRANCH` for Individual physical/card custody, `SAME_COMPANY` for Pool licence allocation) so the UI never infers scope from the selected row.

~~~ts
export interface OnboardingAssetCandidateView {
  assetId: string;
  version: number;
  code: string;
  safeLabel: string;
  assetType: { id: string; code: string; name: string };
  kind: "GENERAL" | "HARDWARE" | "CARD" | "SOFTWARE_LICENSE";
  trackingMode: "INDIVIDUAL" | "POOL";
  eligibilityScope: "SAME_BRANCH" | "SAME_COMPANY";
  owningCompany: { id: string; name: string };
  owningBranch: { id: string; code: string; name: string } | null;
  owningDepartment: { id: string; code: string; name: string } | null;
  availability: string;
  expiryState: string | null;
  availableCapacity: number | null;
}
~~~

For INDIVIDUAL tracking, each row displays safe fields:

- Asset code.
- Asset Type.
- Owning Branch and Department.
- Availability and lifecycle state.
- Non-sensitive identifier label approved for the actor.
- Current Asset version.

For POOL tracking, each row displays:

- Pool name.
- Asset Type.
- Owning Company or Branch context.
- Available capacity.
- Expiry state where safe.
- Current pool version.

Vault references, card secrets, encrypted values, private history, and unrelated assignee data must not appear.

### 12.4 Fulfillment command

The user selects one eligible Asset or pool, enters the effective date if required, and confirms. The request includes:

~~~ts
{
  operationId: string;
  expectedTaskVersion: number;
  assetId: string;
  expectedAssetVersion: number;
  effectiveDate: string;
}
~~~

The exact DTO must match the final Asset V2 adapter contract. The UI does not issue a second Complete request after fulfillment. One backend transaction creates custody or allocation, completes the task, recalculates progress, and returns the result.

### 12.5 Success and invalidation

Success displays:

- Completed task state.
- Custody or licence allocation reference.
- Safe Asset summary.
- Effective date.
- Updated Onboarding progress.

Then call the same common `invalidateOnboardingRuntime()` helper used by every other runtime command. Asset fulfillment does not keep a separate shorter invalidation list.

### 12.6 Failure behavior

- ASSET_PERMISSION_REQUIRED closes the fulfillment capability after refetch and explains that current Asset authority is missing.
- ASSET_TASK_INVALID_TYPE keeps the task open and shows an HR configuration exception.
- ASSET_SOURCE_COMMAND_CONFLICT stops automatic retry and directs the user to refresh the committed fulfillment result.
- Asset availability or capacity conflicts preserve task state, refetch eligible candidates, and require a new selection.
- A mixed or disabled Asset V2 scope fails closed. The UI must not offer a legacy assignment fallback.

### 12.7 Reopen and cancellation after fulfillment

Reopening or cancelling Onboarding does not delete or reverse Asset custody. The task drawer displays the existing custody/allocation reference and links authorized users to the corresponding Asset workflow. Return, revoke, lost, damaged, transfer, or clearance actions remain Asset-owned operations.

A completed Asset task receives REOPEN only after the backend confirms its referenced custody/allocation is terminal. Active custody returns ASSET_CUSTODY_STILL_ACTIVE and the UI links to the permitted return/revoke workflow. A successful reopen preserves the prior result in history, starts a new server attempt number, and requires a new fulfillment; the browser never clears or replaces the prior result locally.

## 13. Notification and reminder experience

### 13.1 Supported notification types

The notification center supports:

- Onboarding started.
- Onboarding cancelled.
- Onboarding completed.
- Department work available.
- Department has no active assigner.
- Task assigned.
- Task reassigned.
- Task unassigned.
- Task due soon.
- Task overdue.
- Task completed.
- Task waived.

### 13.2 Safe presentation

Outbox payloads contain identifiers, event code, status, and due date only. Notification-list copy is therefore generic and catalog-driven, for example `Onboarding work is available`, `An onboarding task was assigned`, or `An onboarding task is overdue`. It may display the supplied status and formatted due date, but it must not claim an Employee name, task name, Department name, assignee name, Template label, or Asset label from the outbox payload. Those labels are loaded only after the user follows the deep link and the scoped destination authorizes and fetches the current resource. Notifications never render private override reasons, Asset secrets, remarks, or evidence in the preview.

### 13.3 Deep-link behavior

Selecting a notification opens the scoped task or Onboarding detail and refetches current state. The notification's historical recipient status never substitutes for current access.

If the task was reassigned or access was removed, the destination renders current safe state or the standard denied/not-found page. A stale notification must not reveal the new assignee.

### 13.4 Reminder presentation

Due Soon and Overdue are visual due states, not task lifecycle statuses. A task remains PENDING or IN_PROGRESS while its due badge changes. All displayed dates use the server-provided Branch timezone context and a consistent absolute-date tooltip.

## 14. Client state, caching, and refetch contract

### 14.1 Query keys

Use canonical keys with stable serialized filters:

~~~ts
onboardingKeys.all
onboardingKeys.list(filters)
onboardingKeys.detail(onboardingId)
onboardingKeys.preflight({ employeeId, startDate, overrideTemplateId })
onboardingKeys.me
onboardingKeys.workspaceCapabilities
onboardingKeys.completionPreflight(onboardingId)
onboardingTaskKeys.me(filters)
onboardingTaskKeys.departmentQueue(filters)
onboardingTaskKeys.detail(taskId)
onboardingTaskKeys.assigneeCandidates(taskId, keyword, page)
onboardingTaskKeys.reopenPreflight(taskId, version)
onboardingTaskKeys.history(taskId, page, limit)
~~~

Do not reuse an organization-wide key for actor-scoped data. User, Company, Branch, and feature-scope changes clear all Onboarding query caches before loading the next context.

### 14.2 Runtime invalidation set

Define one `invalidateOnboardingRuntime()` helper. Every successful runtime mutation uses the same complete invalidation set: normal start, override-start, assign, reassign, unassign, task start, Checklist complete, skip, reopen, waive, Asset fulfillment, final completion, and cancellation.

The common set invalidates:

- Workspace capabilities, My Own Onboarding, My Tasks, Department Queue, and Manager Dashboard Onboarding summary.
- HR Onboarding list, summary, detail, normal/override preflight, and completion preflight.
- Task detail, assignee candidates, Asset candidates, reopen preflight, and task history.
- Employee detail/profile, Employee Onboarding snapshot, career timeline, status, and Probation projection.
- Employee Asset custody/allocation, Asset inventory/pool capacity, and Asset summaries.
- Notification list, unread count, and deep-link destination caches.

This intentionally prefers correctness over mutation-specific cache minimization. The helper scopes invalidation to the current authenticated User and organization context, waits for the critical task/Onboarding projections required by the current screen, and may refetch the remaining invalidated queries in the background. No runtime mutation maintains a smaller private invalidation list.

Template draft mutations invalidate Template list/detail/version/workspace. Validate, publish, archive, clone, and assignment mutations additionally invalidate designation-assignment and start-preflight caches; they do not use the runtime helper unless they also committed a runtime change.

### 14.3 Optimistic UI

Do not optimistically mutate:

- Task status.
- Assignee.
- Progress.
- allowedActions.
- Asset availability or pool capacity.
- Onboarding completion or Probation status.

Low-risk local UI state such as selected filters, expanded groups, and unsent text can update immediately.

### 14.4 Mutation success

A transport 2xx is not enough to render a guessed state. Use the typed command response, then call `invalidateOnboardingRuntime()` for every runtime command. Toast content reflects the returned command result and not a client-predicted transition.

## 15. Error and conflict behavior

### 15.1 HTTP behavior

- 400 or 422: keep the form or dialog open and map field violations to the affected controls.
- 401: use the existing session-expiry flow.
- 403: close the rejected capability after refetch and show a permission-changed message.
- 404: show a safe not-found state with no Employee, Department, Template, task, or Asset existence hint.
- 409: preserve user-entered reason or remarks, refetch current state, and require review before a new command.
- 5xx or network failure: preserve input and retain the same operationId for an exact retry.

### 15.2 Stable code mapping

| Error code | UI behavior |
|---|---|
| ONBOARDING_TEMPLATE_NOT_CONFIGURED | Block normal start and link authorized Template administrators to configuration |
| ONBOARDING_TEMPLATE_NOT_PUBLISHED | Block start and show the resolved Template/version issue |
| ONBOARDING_TEMPLATE_BRANCH_MISMATCH | Block start and show Branch override configuration requirement |
| ACTIVE_ONBOARDING_EXISTS | Navigate or link to the existing scoped Onboarding returned safely by the API |
| ONBOARDING_START_PRECONDITION_FAILED | Render every server blocker and warning in preflight |
| ONBOARDING_LEGACY_RECONCILIATION_REQUIRED | Refresh and retain the scoped Legacy read-only view; expose no V2 command |
| ONBOARDING_STATE_CHANGED | Refetch Onboarding and require confirmation again |
| ONBOARDING_TASK_NOT_FOUND | Close the drawer and show safe not-found |
| TASK_ASSIGNEE_REQUIRED | Refresh queue and open assignment guidance only if ASSIGN is returned |
| TASK_ASSIGNEE_OUT_OF_DEPARTMENT | Keep assign dialog open and refresh candidates |
| TASK_NOT_ASSIGNED_TO_ACTOR | Refetch task and remove execution controls |
| TASK_STATE_CHANGED | Preserve dialog input, refetch, and show old versus new state summary |
| DEPENDENCY_NOT_COMPLETED | Keep task open and display the blocking prerequisite |
| TASK_DEPENDENTS_COMPLETED | Discard stale reopen preflight, preserve reason, refetch task/history/preflight, and require confirmation again |
| MANDATORY_TASKS_INCOMPLETE | Refresh HR detail and highlight mandatory remaining work |
| ASSET_TASK_INVALID_TYPE | Show configuration exception and no legacy fallback |
| ASSET_PERMISSION_REQUIRED | Remove fulfillment action after refetch and explain missing current authority |
| ASSET_CUSTODY_STILL_ACTIVE | Keep the completed task unchanged and link authorized actors to return/revoke |
| ASSET_SOURCE_COMMAND_CONFLICT | Stop retry and refetch authoritative Asset/task result |
| OVERRIDE_REASON_REQUIRED | Focus the reason field and preserve other values |
| OPERATION_ID_REUSED | Stop automatic retry, create no new key silently, and require the user to review/refetch |

### 15.3 Version conflict review

On a version conflict, the UI shows:

- The action the user attempted.
- The prior version and current version.
- The changed state or assignee.
- Preserved local reason or remarks.
- A Review current state action.

The original operationId is not reused with a changed expected version. If the user confirms a revised command after review, create a new operationId.

## 16. Loading, empty, offline, and partial-failure states

### 16.1 Loading

- Skeleton page headings, summary cards, filters, and initial rows.
- Do not flash empty state before the first response.
- Preserve existing rows during filter refetch with a visible updating indicator.
- Disable the affected task's mutations while its latest detail is loading.

### 16.2 Empty

Empty copy must explain the current scoped filter, not imply the organization has no work. Reset filters is available when a filtered result is empty.

### 16.3 Offline or network interruption

Onboarding commands are not queued offline. Preserve the form locally, explain that the state may have changed, and use the same operationId only for an exact retry after connectivity returns.

### 16.4 Partial refetch failure

If a command succeeds but a dependent refetch fails, show the committed command result and a Data refresh incomplete warning. Do not revert the visual state optimistically. Provide a retry that refetches all invalidated projections without repeating the command.

## 17. Accessibility and responsive behavior

### 17.1 Keyboard and focus

- Every table row action and task card is keyboard reachable.
- Opening a drawer or dialog moves focus to its heading.
- Closing returns focus to the invoking row or a stable page heading if the row disappeared.
- Validation summary links move focus to the invalid control.
- Confirmation dialogs use an explicit destructive or exception label rather than a generic Submit label.

### 17.2 Semantics

- Status and due-state badges include accessible text; color alone is not meaningful.
- Progress exposes the numeric percent and terminal/total values.
- Dependency relationships are expressed in text and linked to the prerequisite where access allows.
- Loading and mutation results use appropriate live regions without announcing every background refetch.

### 17.3 Responsive layout

- Desktop uses summary cards plus tables or grouped rows.
- Narrow viewports convert task rows to cards while preserving all labels, blocked reasons, and actions.
- Drawers become full-screen sheets on small screens.
- Action buttons remain in a sticky task footer without covering content.
- Department and My Tasks filters remain usable without horizontal overflow.

### 17.4 Date and timezone presentation

Display dates in the user's locale with the Branch timezone label or tooltip supplied by the API. Do not derive Overdue using the browser's local midnight.

## 18. Security and privacy UI contract

- Client-side hiding is presentation only; the server response must already be scoped.
- Never persist private override reasons, task remarks, Employee details, candidate lists, Asset identifiers, or response snapshots in localStorage.
- Do not include sensitive values in URLs, analytics, console logs, toast details, or client error reporting.
- Redact request bodies containing reasons, remarks, or Asset selection details from telemetry breadcrumbs.
- Clear Onboarding caches on logout, User switch, Company switch, Branch switch, or scope downgrade.
- A notification ID, task ID, onboarding ID, Employee ID, or Asset ID is never treated as authorization.
- Cross-tenant 404 screens use generic wording and do not retain leaked page titles from a previous cached response.

## 19. Observability and support signals

The frontend records non-sensitive product telemetry for:

- Preflight blocker code counts.
- Template validation error code counts.
- allowedActions contract mismatches.
- Task and Onboarding version conflicts.
- Asset fulfillment failure codes.
- Notification deep-link denied/not-found outcomes.
- Data refresh incomplete outcomes after a successful command.
- Legacy template fallback labels shown in start preflight.

Telemetry must contain safe codes and feature scope identifiers approved for operations. It must not contain Employee names, reasons, remarks, Asset secrets, or task evidence.

## 20. Frontend module and component plan

### 20.1 Template feature

Refactor frontend/features/onboarding-template to provide:

- TemplateAssignmentContextHeader.
- DepartmentSliceEditor.
- OnboardingTaskEditor.
- TemplateTaskOwnerField.
- AssetTypeRequirementField.
- TemplateValidationSummary.
- VersionConflictReview.
- TemplateLifecycleActions driven by the server.

Retire or repair the quick-grid path before V2 routing uses it.

### 20.2 HR runtime feature

Refactor frontend/features/employee-onboarding to provide:

- StartOnboardingForm.
- OnboardingPreflightPanel.
- OverrideStartDialog.
- EmployeeOnboardingTable.
- OnboardingMonitorHeader.
- DepartmentProgressCard.
- OnboardingTaskMonitorRow.
- FinalCompletionDialog.
- CancelOnboardingDialog.
- HrOverrideActionMenu.

### 20.3 Shared task workspace

Add shared task components usable by My Workspace and HR monitor:

- OnboardingTaskDrawer.
- OnboardingTaskActionBar.
- BlockedReasonList.
- TaskDependencyCard.
- TaskAssignmentHistory.
- AssignTaskDialog.
- ReassignTaskDialog.
- SkipTaskDialog.
- ReopenTaskDialog.
- WaiveTaskDialog.
- AssetFulfillmentDrawer.

The same task view model feeds every surface. Persona-specific forks of status-to-action logic are prohibited.

### 20.4 My Workspace and Manager Dashboard

Update frontend/features/my-workspace with:

- MyOwnOnboardingSummary.
- MyOnboardingTasks.
- DepartmentOnboardingQueue.
- OnboardingQueueFilters.

Update frontend/features/manager-dashboard to consume the actor-scoped My Tasks summary and deep-link into My Workspace. Remove its organization-wide Onboarding task query and misleading assignee mapping.

### 20.5 Navigation

Update frontend/config/navigation.ts so:

- HR Template and Employee Onboarding entries retain permission-aware visibility.
- My Workspace exposes Onboarding for authenticated Employee Users.
- Department Queue visibility is determined after the page loads its server capability, not by hard-coded role names.

## 21. Test plan

### 21.1 Unit tests

- Owner selector exposes only Department, Employee, and Manager.
- Department ownership is displayed from the enclosing slice and is not editable on the task.
- Employee and Manager owners render no named-person selector.
- Work type selector exposes only Checklist and Asset.
- Asset selector accepts Individual and Pool and rejects Location.
- Unsupported historical configuration renders read-only.
- LEGACY_V1 runtime records display the read-only banner and ignore accidental mutation capabilities.
- Operation ID persists for exact retries and changes for revised intent.
- Unknown allowedActions are ignored.
- An action without exactly one matching actionCapabilities entry is hidden and reported.
- HR override COMPLETE uses the exception dialog and requires `overrideReason` from actionCapabilities metadata.
- No action is inferred from status or flags.
- Progress renders server values without recalculation.
- Due-state badge renders server dueState without browser-date logic.
- Notification previews remain generic when the payload contains only IDs, status, and dates.
- `invalidateOnboardingRuntime()` invalidates the complete runtime set for every runtime command.

### 21.2 Component tests

- Template save, validate, publish, archive, clone, and conflict states.
- Field-level publish validation and validation-summary focus.
- Normal start contains no Template selector.
- Normal preflight requires both canStart and START; override preflight requires both canStart and OVERRIDE_START.
- Preflight renders Template code, resolved source, organization names, Branch timezone, warnings, and blockers.
- Override start is separate, permission-controlled, and requires a reason.
- HR monitor renders no task controls when allowedActions is empty.
- HR override Complete is visually distinct and follows its per-action reason metadata.
- Department viewer can inspect but not assign.
- Department assigner sees only returned same-Department assignment controls and candidates.
- HR override candidate lookup follows the server's record-level override scope and cannot cross Company or Branch.
- Assigned actor sees only returned execution controls.
- Unassign cannot submit without a reason.
- Reopen preflight lists every atomic dependent reopen, and a stale preflight requires reconfirmation.
- Checklist and Asset actions use separate flows.
- Asset fulfillment calls the same complete runtime invalidation helper as every other runtime mutation.
- Final completion preflight shows the authoritative optional auto-skip count and Probation outcome.
- Cancellation explains that Asset custody remains.
- 400, 401, 403, 404, 409, 422, network, and partial-refetch states behave as specified.
- Loading, empty, denied, responsive, focus, and keyboard states pass.

### 21.3 API contract tests

- Frontend fixtures deserialize the final typed Onboarding and task responses.
- Runtime fixtures require contractVersion, safe organization names, Branch `timeZone`, Template code, Asset kind/tracking/scope, allowedActions, and actionCapabilities.
- Legacy fixtures preserve unsupported historical owner/work/status strings through the dedicated read-only projection and never coerce them into V2 unions.
- Workspace section discovery calls `/me/onboarding/workspace-capabilities`, not `/me/onboarding`.
- Every list uses items, total, page, and limit.
- My Tasks serializes only status, dueState, workType, ownerType, employeeId, executorDepartmentId, keyword, page, limit, sortBy, and sortOrder; contract tests enforce page >= 1, limit 1..100, the 10/25/50/100 UI choices, and the documented default/tie-break sort.
- Every mutation sends operationId and its contract-specific expected version field.
- Every mutation returns the same typed projection used by list/detail surfaces.
- allowedActions unions match the OpenAPI or shared schema.
- actionCapabilities has exactly one entry per returned runtime action and carries the correct authority, reason field, candidate scope, and preflight mode.
- Completion-preflight, reopen-preflight, assignee-candidate, Asset-candidate, workspace-capability, and task-history fixtures match their dedicated DTOs.
- Sensitive fields absent from the public DTO cannot appear in rendered view models.

### 21.4 Real API browser personas

Use committed Playwright scenarios against the real API and PostgreSQL database. Mock mode is not release evidence.

1. HR Template administrator authors a concrete-Branch Department template and publishes it.
2. HR monitor starts Onboarding through automatic preflight with no Template selector.
3. Department viewer sees only own Department queue and no assignment action.
4. Department assigner assigns an unassigned task to an eligible same-Department Employee.
5. Assigned Department Employee starts and completes a Checklist task.
6. New Employee sees and executes the Employee-owned task.
7. Reporting Manager sees and executes only the assigned Manager task.
8. Asset custodian with both capabilities fulfills an Asset task and creates real custody or allocation.
9. Other Department user cannot list, open, infer, or mutate the task.
10. Other Company/Branch user receives a safe scoped response and no data.
11. HR override reassign uses only server-returned candidates and override Complete requires the protected reason flow.
12. Reopening a prerequisite confirms and commits the server-returned dependent set atomically.
13. A LEGACY_V1 record remains readable but exposes no runtime command.

Each scenario verifies the visible UI, network payload, database state, audit/action evidence, outbox event, notification deep link, and cross-surface refetch.

### 21.5 Concurrency browser cases

- Two assigners attempt to assign the same task.
- Assignee completes while HR attempts final Onboarding completion.
- Department assigner reopens while HR attempts final completion.
- Asset custodian fulfills while another actor assigns the same Asset directly.
- Same exact command is retried after a lost response.
- Same operationId is submitted with changed input.

The losing browser displays the stable conflict, preserves safe input, refetches authoritative state, and never overwrites the committed result.

### 21.6 Accessibility acceptance

Run automated accessibility checks and manual keyboard review for:

- Template editor and validation summary.
- Start and override dialogs.
- HR monitor.
- My Tasks and Department Queue.
- Task and Asset drawers.
- Conflict, denied, empty, and error states.

## 22. UI implementation order

1. Freeze the backend DTOs, actions, errors, and feature-scope contract.
2. Add generated or contract-tested frontend types and canonical query keys.
3. Repair Template tenant context and select one persistent authoring path.
4. Restrict owner and work-type editors and implement server validation rendering.
5. Replace normal manual Template selection with preflight and add separate override-start.
6. Refactor HR list/detail to server progress, blocked reasons, and allowedActions.
7. Add My Workspace Onboarding, My Tasks, and Department Queue.
8. Add shared task drawer, assignment, execution, override, and conflict dialogs.
9. Integrate Asset fulfillment only after the final Asset V2 adapter is committed and reviewed.
10. Replace Manager Dashboard's organization-wide query with actor-scoped My Tasks.
11. Add notifications, deep links, and full invalidation behavior.
12. Complete component, contract, real API browser, accessibility, and persona acceptance.
13. Enable only for the approved Company/Branch pilot scope after backend reconciliation passes.

## 23. UI definition of done

The UI implementation is complete only when:

- One canonical authoring path persists create, update, delete, dependency, and reorder operations.
- No new Template can submit a named person, unsupported owner, unsupported work type, approval rule, or Location-tracked Asset requirement.
- Normal start has no Template selector and displays authoritative resolution preflight.
- Override start is separate, permission-controlled, and reasoned.
- HR monitoring does not expose ordinary Department execution controls.
- Department Queue visibility and assignment candidates are server-scoped.
- Department Queue discovery comes only from the dedicated workspace-capabilities response.
- My Tasks includes Employee, Manager, and Department assignments for the authenticated User only.
- My Tasks filters, paging, sort allowlist, null-due ordering, and deterministic tie-breakers match the public query contract.
- Manager Dashboard no longer fetches organization-wide pending work.
- Every action is rendered from current allowedActions plus exactly one matching actionCapabilities entry.
- LEGACY_V1 runtime records are clearly read-only and cannot invoke V2 commands.
- Every progress, due, dependency, and completion value is server-authored.
- Final completion and reopen use their dedicated fresh preflight responses.
- Asset fulfillment creates and displays a real custody/allocation result or a reasoned waiver; no generic completion is possible.
- All mutations use operationId and the relevant expected version and handle conflicts without overwriting committed state.
- Every runtime mutation calls the one complete runtime invalidation helper; no runtime command keeps a smaller private invalidation list.
- Cross-Department, cross-Branch, and cross-Company data is absent from network responses as well as the DOM.
- Keyboard, screen-reader, responsive, loading, empty, denied, retry, and conflict behavior passes.
- Real API persona tests pass for the exact frontend, backend, database migration, Recruitment, and Asset candidate commits.
- Technical UAT, business UAT, backup/restore evidence, monitoring, and release sign-off are recorded.

## 24. Explicitly deferred UI work

Do not expose placeholder or disabled production controls for:

- Employee Document collection or verification.
- Approval inboxes, approval decisions, WAITING_APPROVAL, or REJECTED states.
- Generic workflow execution, provider configuration, rules, or contributions.
- Training, meeting, form, medical, email, custom, or resource automation.
- A Department head master-data field.
- A separate Department onboarding grant administration screen.
- Automatic Asset return/revoke on Onboarding reopen or cancellation.

Deferred features require a separately approved database, API, authorization, UI, migration, and acceptance contract before they appear in production routes.
