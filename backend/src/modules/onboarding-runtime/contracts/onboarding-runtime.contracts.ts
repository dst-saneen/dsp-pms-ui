/**
 * Onboarding runtime API and domain contracts (onboarding-db-api-implementation-plan).
 */

// ---------------------------------------------------------------------------
// Enums & unions
// ---------------------------------------------------------------------------

export type OnboardingContractVersion = 'LEGACY_V1' | 'V2';

export type EmployeeOnboardingStatus =
  'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type EmployeeOnboardingTaskStatus =
  'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'WAIVED' | 'CANCELLED';

export type EmployeeOnboardingAllowedAction = 'CANCEL' | 'COMPLETE';

export type EmployeeOnboardingTaskAllowedAction =
  | 'ASSIGN'
  | 'REASSIGN'
  | 'UNASSIGN'
  | 'START'
  | 'COMPLETE'
  | 'SKIP'
  | 'REOPEN'
  | 'FULFILL_ASSET'
  | 'WAIVE';

export type OnboardingTemplateAllowedAction =
  | 'CREATE'
  | 'CREATE_DRAFT'
  | 'EDIT_DRAFT'
  | 'CLONE'
  | 'VALIDATE'
  | 'PUBLISH'
  | 'ARCHIVE'
  | 'VIEW_HISTORY';

export type DesignationOnboardingAssignmentAllowedAction =
  'CREATE' | 'EDIT' | 'DEACTIVATE';

export type OnboardingPreflightStartAction = 'START' | 'OVERRIDE_START';

export type OnboardingTemplateResolutionSource =
  | 'BRANCH_OVERRIDE'
  | 'DESIGNATION_DEFAULT'
  | 'DESIGNATION_LEGACY_FALLBACK'
  | 'PRIVILEGED_OVERRIDE';

export type OnboardingAutomaticResolutionFailureCode =
  | 'ONBOARDING_TEMPLATE_NOT_CONFIGURED'
  | 'ONBOARDING_TEMPLATE_NOT_PUBLISHED'
  | 'ONBOARDING_TEMPLATE_BRANCH_MISMATCH';

export type RuntimeAuthorityMode = 'NORMAL' | 'HR_OVERRIDE';

export type RuntimeReasonField = 'reason' | 'overrideReason' | null;

export type RuntimeConfirmationTone = 'NORMAL' | 'WARNING' | 'BREAK_GLASS';

export type RuntimeCandidateScope =
  'EXECUTOR_DEPARTMENT' | 'HR_OVERRIDE_BRANCH';

export type RuntimePreflightKind = 'NONE' | 'REOPEN' | 'ONBOARDING_COMPLETE';

export type OnboardingTaskActionType =
  | 'ASSIGNED'
  | 'REASSIGNED'
  | 'UNASSIGNED'
  | 'STARTED'
  | 'COMPLETED'
  | 'OVERRIDE_COMPLETED'
  | 'SKIPPED'
  | 'AUTO_SKIPPED'
  | 'REOPENED'
  | 'WAIVED'
  | 'CANCELLED';

export type OnboardingActionAuthorityMode = 'NORMAL' | 'HR_OVERRIDE' | 'SYSTEM';

export type OnboardingTaskOwnerType = 'DEPARTMENT' | 'EMPLOYEE' | 'MANAGER';

export type OnboardingTaskWorkType = 'CHECKLIST' | 'ASSET';

export type OnboardingTaskDueState =
  'NONE' | 'UPCOMING' | 'DUE_SOON' | 'OVERDUE';

export type OnboardingWorkspaceSection = 'MY_TASKS' | 'DEPARTMENT_QUEUE';

/** Imported from the Asset domain public contract when available. */
export type AssetKind = 'GENERAL' | 'HARDWARE' | 'CARD' | 'SOFTWARE_LICENSE';

export type AssetTrackingMode = 'INDIVIDUAL' | 'POOL';

export type AssetEligibilityScope = 'SAME_BRANCH' | 'SAME_COMPANY';

export type AssetAvailabilityStatus = string;

export type AssetExpiryState = string;

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OnboardingBlockedReason {
  code: string;
  message: string;
  entityId?: string;
  taskId?: string;
}

export interface RuntimeActionCapability<TAction extends string> {
  action: TAction;
  authorityMode: RuntimeAuthorityMode;
  reasonRequired: boolean;
  reasonField: RuntimeReasonField;
  remarksRequired: boolean;
  confirmationTone: RuntimeConfirmationTone;
  candidateScope?: RuntimeCandidateScope;
  preflight?: RuntimePreflightKind;
}

export type EmployeeOnboardingTaskActionCapability =
  RuntimeActionCapability<EmployeeOnboardingTaskAllowedAction>;

export type EmployeeOnboardingActionCapability =
  RuntimeActionCapability<EmployeeOnboardingAllowedAction>;

export type OnboardingPreflightStartActionCapability =
  RuntimeActionCapability<OnboardingPreflightStartAction>;

// ---------------------------------------------------------------------------
// Actor context
// ---------------------------------------------------------------------------

export interface OnboardingActorContext {
  userId: string;
  isGlobal: boolean;
  permissions: string[];
  assetGrantedDepartmentIds: string[];
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
    scope: 'GLOBAL' | 'GROUP' | 'COMPANY' | 'BRANCH';
    companyGroupId?: string;
    companyId?: string;
    branchId?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface OnboardingProgressSnapshot {
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
}

export interface OnboardingDepartmentProgressSnapshot {
  workstreamDepartment: { id: string; name: string };
  total: number;
  terminal: number;
  mandatoryRemaining: number;
  unassigned: number;
  dueSoon: number;
  overdue: number;
  percent: number;
}

export interface OnboardingProgressTaskInput {
  status: string;
  isMandatory: boolean;
  assignedToUserId?: string | null;
  dueState?: OnboardingTaskDueState;
}

// ---------------------------------------------------------------------------
// Runtime views
// ---------------------------------------------------------------------------

export interface AssetFulfillmentResultView {
  type: 'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION';
  id: string;
  assetId: string;
  safeAssetLabel: string;
}

export interface EmployeeOnboardingTaskRuntimeView {
  id: string;
  onboardingId: string;
  contractVersion: OnboardingContractVersion;
  version: number;
  attemptNo: number;
  taskName: string;
  description: string | null;
  sequenceNo: number;
  priority: number;
  isMandatory: boolean;
  allowSkip: boolean;
  allowReopen: boolean;
  status: EmployeeOnboardingTaskStatus;
  dueState: OnboardingTaskDueState;
  dueDate: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  ownerType: OnboardingTaskOwnerType;
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
  requirement: {
    workType: OnboardingTaskWorkType;
    referenceType: 'ASSET_TYPE' | null;
    referenceId: string | null;
    referenceCode: string | null;
    referenceName: string | null;
    assetKind: AssetKind | null;
    assetTrackingMode: AssetTrackingMode | null;
    assetEligibilityScope: AssetEligibilityScope | null;
  };
  result: AssetFulfillmentResultView | null;
  blockedReasons: OnboardingBlockedReason[];
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: EmployeeOnboardingTaskActionCapability[];
}

export interface EmployeeOnboardingRuntimeView {
  id: string;
  contractVersion: OnboardingContractVersion;
  version: number;
  status: EmployeeOnboardingStatus;
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
  progress: OnboardingProgressSnapshot;
  departmentProgress: OnboardingDepartmentProgressSnapshot[];
  tasks?: EmployeeOnboardingTaskRuntimeView[];
  blockedReasons: OnboardingBlockedReason[];
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: EmployeeOnboardingActionCapability[];
}

// ---------------------------------------------------------------------------
// Imported-record compatibility views
// ---------------------------------------------------------------------------

export interface ImportedEmployeeOnboardingTaskView {
  id: string;
  onboardingId: string;
  contractVersion: 'LEGACY_V1';
  version: number | null;
  taskName: string;
  description: string | null;
  legacyStatus: string;
  legacyOwnerType: string | null;
  legacyWorkType: string | null;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
  } | null;
  workstreamDepartment: { id: string; name: string } | null;
  executorDepartment: { id: string; name: string } | null;
  assignee: {
    userId: string;
    employeeId: string | null;
    displayName: string;
  } | null;
  dueDate: string | null;
  resolvedAt: string | null;
  blockedReasons: OnboardingBlockedReason[];
  allowedActions: [];
  actionCapabilities: [];
}

export interface ImportedEmployeeOnboardingView {
  id: string;
  contractVersion: 'LEGACY_V1';
  version: number | null;
  legacyStatus: string;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
  } | null;
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
  tasks?: ImportedEmployeeOnboardingTaskView[];
  blockedReasons: OnboardingBlockedReason[];
  allowedActions: [];
  actionCapabilities: [];
}

export type EmployeeOnboardingTaskView =
  EmployeeOnboardingTaskRuntimeView | ImportedEmployeeOnboardingTaskView;

export type EmployeeOnboardingView =
  EmployeeOnboardingRuntimeView | ImportedEmployeeOnboardingView;

/** API response aliases mirror view shapes. */
export type EmployeeOnboardingRuntimeResponse = EmployeeOnboardingRuntimeView;
export type EmployeeOnboardingTaskRuntimeResponse =
  EmployeeOnboardingTaskRuntimeView;
export type ImportedEmployeeOnboardingResponse = ImportedEmployeeOnboardingView;
export type ImportedEmployeeOnboardingTaskResponse =
  ImportedEmployeeOnboardingTaskView;
export type EmployeeOnboardingResponse = EmployeeOnboardingView;
export type EmployeeOnboardingTaskResponse = EmployeeOnboardingTaskView;

// ---------------------------------------------------------------------------
// Preflight & workspace
// ---------------------------------------------------------------------------

export interface OnboardingPreflightQuery {
  employeeId: string;
  startDate: string;
  overrideTemplateId?: string;
}

export interface OnboardingPreflightResponse {
  mode: 'NORMAL' | 'OVERRIDE';
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
    resolutionSource: OnboardingTemplateResolutionSource;
  };
  automaticResolution?: {
    templateId: string;
    templateCode: string;
    templateName: string;
    templateVersionId: string;
    versionNo: number;
    resolutionSource: Exclude<
      OnboardingTemplateResolutionSource,
      'PRIVILEGED_OVERRIDE'
    >;
  };
  automaticResolutionFailureCode?: OnboardingAutomaticResolutionFailureCode;
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
  blockers: OnboardingBlockedReason[];
  warnings: OnboardingBlockedReason[];
  allowedActions: OnboardingPreflightStartAction[];
  actionCapabilities: OnboardingPreflightStartActionCapability[];
}

export interface MeOnboardingResponse {
  ownOnboarding: EmployeeOnboardingResponse | null;
}

export interface OnboardingWorkspaceCapabilitiesResponse {
  sections: OnboardingWorkspaceSection[];
}

export interface EmployeeOnboardingCompletionPreflightResponse {
  onboardingId: string;
  contractVersion: OnboardingContractVersion;
  expectedOnboardingVersion: number;
  canComplete: boolean;
  mandatoryRemaining: number;
  optionalTasksToAutoSkip: number;
  probationWillStart: boolean;
  blockedReasons: OnboardingBlockedReason[];
  warnings: OnboardingBlockedReason[];
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: EmployeeOnboardingActionCapability[];
}

export interface ReopenOnboardingTaskPreflightResponse {
  taskId: string;
  contractVersion: OnboardingContractVersion;
  expectedTaskVersion: number;
  canReopen: boolean;
  affectedTasks: Array<{
    taskId: string;
    taskName: string;
    role: 'TARGET' | 'DEPENDENT';
    status: EmployeeOnboardingTaskStatus;
    expectedVersion: number;
    attemptNo: number;
  }>;
  blockedReasons: OnboardingBlockedReason[];
  allowedActions: EmployeeOnboardingTaskAllowedAction[];
  actionCapabilities: EmployeeOnboardingTaskActionCapability[];
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export interface OnboardingAssigneeCandidateResponse {
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

export interface OnboardingAssetCandidateResponse {
  trackingMode: AssetTrackingMode;
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

// ---------------------------------------------------------------------------
// Template administration
// ---------------------------------------------------------------------------

export interface OnboardingValidationResult {
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

export interface OnboardingTemplateSummaryResponse {
  id: string;
  rowVersion: number;
  code: string;
  name: string;
  isActive: boolean;
  currentPublishedVersion: {
    id: string;
    versionNo: number;
    status: 'PUBLISHED' | 'ARCHIVED';
  } | null;
  draftVersion: { id: string; versionNo: number; rowVersion: number } | null;
  allowedActions: OnboardingTemplateAllowedAction[];
}

export interface OnboardingTemplateListResponse extends PagedResult<OnboardingTemplateSummaryResponse> {
  collectionAllowedActions: Array<'CREATE'>;
}

export interface DesignationOnboardingAssignmentResponse {
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

export interface DesignationOnboardingAssignmentListResponse extends PagedResult<DesignationOnboardingAssignmentResponse> {
  collectionAllowedActions: Array<'CREATE'>;
}

export interface OnboardingTaskHistoryItemResponse {
  id: string;
  action: OnboardingTaskActionType;
  authorityMode: OnboardingActionAuthorityMode;
  fromStatus: EmployeeOnboardingTaskStatus | null;
  toStatus: EmployeeOnboardingTaskStatus;
  fromAssignee: { userId: string; displayName: string } | null;
  toAssignee: { userId: string; displayName: string } | null;
  actor: { userId: string; displayName: string };
  reason: string | null;
  assetResult: {
    attemptNo: number;
    resultType: 'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION';
    resultId: string;
  } | null;
  taskVersionAfter: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

export interface StartEmployeeOnboardingRequest {
  operationId: string;
  employeeId: string;
  startDate: string;
  remarks?: string;
}

export interface OverrideStartEmployeeOnboardingRequest extends StartEmployeeOnboardingRequest {
  templateId: string;
  reason: string;
}

export interface CompleteEmployeeOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
  note?: string;
}

export interface CancelEmployeeOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
  reason: string;
}

export interface CompleteEmployeeOnboardingResponse {
  onboarding: EmployeeOnboardingResponse;
  employeeStatus: string;
  probationStarted: boolean;
  careerEventIds: string[];
}

export interface CancelEmployeeOnboardingResponse {
  onboarding: EmployeeOnboardingResponse;
  outstandingAssetResults: Array<{
    taskId: string;
    resultType: 'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION';
    resultId: string;
    safeAssetLabel?: string;
  }>;
}

export interface PublishOnboardingVersionRequest {
  operationId: string;
  expectedVersion: number;
  effectiveFrom?: string;
  changeSummary?: string;
}

export interface WriteOnboardingTemplateTaskRequest {
  taskGroupId: string;
  taskName: string;
  description?: string;
  sequenceNo: number;
  priority?: number;
  isMandatory: boolean;
  allowSkip: boolean;
  allowReopen: boolean;
  dueDays?: number;
  ownerType: OnboardingTaskOwnerType;
  workType: OnboardingTaskWorkType;
  referenceType?: 'ASSET_TYPE';
  referenceId?: string;
  dependsOnTaskId?: string;
  expectedVersion?: number;
  operationId: string;
}

export interface OnboardingTaskCommand {
  operationId: string;
  expectedTaskVersion: number;
}

export interface OnboardingTaskActionEventResponse {
  id: string;
  action: OnboardingTaskActionType;
  authorityMode: OnboardingActionAuthorityMode;
  fromStatus: EmployeeOnboardingTaskStatus | null;
  toStatus: EmployeeOnboardingTaskStatus;
  fromAssignee: { userId: string; displayName: string } | null;
  toAssignee: { userId: string; displayName: string } | null;
  actor: { userId: string; displayName: string };
  reason: string | null;
  assetResult: {
    attemptNo: number;
    resultType: 'EMPLOYEE_ASSET' | 'SOFTWARE_LICENSE_ALLOCATION';
    resultId: string;
  } | null;
  taskVersionAfter: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Command receipts
// ---------------------------------------------------------------------------

export interface OnboardingCommandReceiptClaimInput {
  companyId: string;
  operationId: string;
  commandType: string;
  actorUserId: string;
  requestPayload: Record<string, unknown>;
}

export interface OnboardingCommandReceiptClaimResult {
  claimed: boolean;
  isReplay: boolean;
  receiptId?: string;
  safeResultSnapshot?: Record<string, unknown>;
  resultEntityType?: string;
  resultEntityId?: string;
}

export interface ResolvedOnboardingTemplate {
  onboardingTemplateId: string;
  onboardingTemplate: {
    id: string;
    code: string;
    name: string;
    companyId: string;
  };
  source: Exclude<OnboardingTemplateResolutionSource, 'PRIVILEGED_OVERRIDE'>;
}

export interface ResolvedPublishedOnboardingTemplate extends ResolvedOnboardingTemplate {
  publishedVersion: {
    id: string;
    versionNo: number;
    status: string;
  };
}

export interface OnboardingCapabilityResult<TAction extends string> {
  allowedActions: TAction[];
  actionCapabilities: RuntimeActionCapability<TAction>[];
  blockedReasons: OnboardingBlockedReason[];
}
