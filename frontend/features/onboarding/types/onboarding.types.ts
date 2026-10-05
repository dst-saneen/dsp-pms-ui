export type EmployeeOnboardingAllowedAction = "CANCEL" | "COMPLETE";

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

export interface AssetFulfillmentResultView {
  type: "EMPLOYEE_ASSET" | "SOFTWARE_LICENSE_ALLOCATION";
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

export interface EmployeeOnboardingRuntimeView {
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
  tasks?: EmployeeOnboardingTaskRuntimeView[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: EmployeeOnboardingAllowedAction[];
  actionCapabilities: Array<
    RuntimeActionCapability<EmployeeOnboardingAllowedAction>
  >;
}

export interface ImportedEmployeeOnboardingTaskView {
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
  assignee: {
    userId: string;
    employeeId: string | null;
    displayName: string;
  } | null;
  dueDate: string | null;
  resolvedAt: string | null;
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: [];
  actionCapabilities: [];
}

export interface ImportedEmployeeOnboardingView {
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
  tasks?: ImportedEmployeeOnboardingTaskView[];
  blockedReasons: Array<{ code: string; message: string }>;
  allowedActions: [];
  actionCapabilities: [];
}

export type EmployeeOnboardingTaskView =
  | EmployeeOnboardingTaskRuntimeView
  | ImportedEmployeeOnboardingTaskView;

export type EmployeeOnboardingView =
  | EmployeeOnboardingRuntimeView
  | ImportedEmployeeOnboardingView;

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface OnboardingWorkspaceCapabilitiesView {
  sections: Array<"MY_TASKS" | "DEPARTMENT_QUEUE">;
}

export interface MeOnboardingView {
  ownOnboarding: EmployeeOnboardingView | null;
}

export interface MyOnboardingTasksQuery {
  status?: EmployeeOnboardingTaskStatus;
  dueState?: "ALL" | "DUE_SOON" | "OVERDUE";
  workType?: "CHECKLIST" | "ASSET";
  ownerType?: "DEPARTMENT" | "EMPLOYEE" | "MANAGER";
  employeeId?: string;
  executorDepartmentId?: string;
  keyword?: string;
  page: number;
  limit: number;
  sortBy: "dueDate" | "priority" | "taskName" | "status" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface DepartmentOnboardingQueueQuery {
  assignmentState?: "UNASSIGNED" | "ASSIGNED" | "ALL";
  assignedToUserId?: string;
  status?: EmployeeOnboardingTaskStatus;
  dueState?: "DUE_SOON" | "OVERDUE" | "ALL";
  mandatory?: boolean;
  workType?: "CHECKLIST" | "ASSET";
  employeeId?: string;
  keyword?: string;
  page: number;
  limit: number;
  sortBy: "dueDate" | "status" | "employeeName" | "assignedAt" | "updatedAt";
  sortOrder: "asc" | "desc";
}

export interface OnboardingPreflightQuery {
  employeeId: string;
  startDate: string;
  overrideTemplateId?: string;
}

export interface OnboardingPreflightView {
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
  actionCapabilities: Array<
    RuntimeActionCapability<"START" | "OVERRIDE_START">
  >;
}

export interface StartEmployeeOnboardingRequest {
  operationId: string;
  employeeId: string;
  startDate: string;
  remarks?: string;
}

export interface OverrideStartEmployeeOnboardingRequest
  extends StartEmployeeOnboardingRequest {
  templateId: string;
  reason: string;
}

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

export interface OnboardingTaskCommand {
  operationId: string;
  expectedTaskVersion: number;
}

export interface AssignOnboardingTaskRequest extends OnboardingTaskCommand {
  assigneeEmployeeId: string;
  reason?: string;
}

export interface UnassignOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}

export interface StartOnboardingTaskRequest extends OnboardingTaskCommand {
  remarks?: string;
}

export interface CompleteOnboardingTaskRequest extends OnboardingTaskCommand {
  remarks?: string;
  overrideReason?: string;
}

export interface SkipOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}

export interface ReopenOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
  dependentTaskVersions?: Array<{
    taskId: string;
    expectedVersion: number;
  }>;
}

export interface FulfillAssetOnboardingTaskRequest extends OnboardingTaskCommand {
  assetId: string;
  expectedAssetVersion: number;
  effectiveDate: string;
}

export interface WaiveOnboardingTaskRequest extends OnboardingTaskCommand {
  reason: string;
}

export interface CompleteOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
}

export interface CancelOnboardingRequest {
  operationId: string;
  expectedOnboardingVersion: number;
  reason: string;
}
