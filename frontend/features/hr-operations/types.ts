export type HrRequestStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export type HrRequestAction = "APPROVE" | "REJECT" | "COMPLETE" | "CANCEL";
export type HrRequestCollectionAction = "CREATE";
export type HrRequestTypeAction = "CREATE" | "UPDATE" | "ARCHIVE";

export type SeparationStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "CLEARANCE_IN_PROGRESS"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type SeparationAction = "APPROVE" | "REJECT" | "CANCEL" | "COMPLETE";
export type SeparationCollectionAction = "CREATE";
export type ClearanceAction = "CLEAR" | "REOPEN";

export interface ActionRequirements {
  expectedVersion: number;
  requiresReason?: boolean;
  cancellationReasonRequired?: boolean;
  rejectionReasonRequired?: boolean;
}

export interface SeparationCompletePreflight {
  readyToComplete: boolean;
  assetClearanceBlocked: boolean;
  mandatoryOutstanding: number;
  effects: string[];
}

export interface PageResult<T, TAction extends string = never> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  allowedActions?: TAction[];
}

export interface ActorSummary {
  id: string;
  employeeCode?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  department?: DepartmentSummary | null;
  designation?: DesignationSummary | null;
}

export interface BranchSummary {
  id: string;
  branchCode?: string | null;
  branchName: string;
}

export interface DepartmentSummary {
  id: string;
  departmentCode?: string | null;
  departmentName: string;
}

export interface DesignationSummary {
  id: string;
  designationCode?: string | null;
  designationName: string;
}

export interface HrRequestType {
  id: string;
  requestCode: string;
  requestName: string;
  workflowId?: string | null;
  workflow?: HrRequestWorkflowCandidate | null;
  requiresApproval?: boolean;
  isActive: boolean;
  allowedActions?: HrRequestTypeAction[];
}

export interface HrRequestWorkflowCandidate {
  id: string;
  workflowCode: string;
  workflowName: string;
}

export interface HrRequest {
  id: string;
  companyId: string;
  branchId?: string | null;
  employeeId: string;
  requestTypeId: string;
  requestNo: string;
  requestDate?: string;
  remarks?: string | null;
  fileObjectId?: string | null;
  attachment?: {
    present: boolean;
    fileName?: string | null;
    status?: string | null;
  } | null;
  status: HrRequestStatus;
  version: number;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  employee?: ActorSummary | null;
  branch?: BranchSummary | null;
  requestType?: HrRequestType | null;
  approvalTransaction?: {
    currentStep?: number | null;
    status?: string | null;
    pendingApprover?: ActorSummary | null;
  } | null;
  allowedActions?: HrRequestAction[];
  actionRequirements?: ActionRequirements;
}

export interface CreateHrRequestInput {
  requestTypeId: string;
  remarks?: string;
  attachmentUploadSessionId?: string;
  operationId: string;
}

export interface HrRequestCommandInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
}

export interface CreateHrRequestTypeInput {
  /** Optional — backend allocates HRT-00001 when omitted. */
  requestCode?: string;
  requestName: string;
  requiresApproval?: boolean;
  workflowId?: string;
}

export type UpdateHrRequestTypeInput = Partial<CreateHrRequestTypeInput>;

export interface EmployeeSeparation {
  id: string;
  companyId: string;
  branchId?: string | null;
  employeeId: string;
  separationType?: "RESIGNATION" | "TERMINATION" | "RETIREMENT" | string | null;
  lastWorkingDate: string;
  reason?: string | null;
  status: SeparationStatus;
  version: number;
  createdAt: string;
  updatedAt?: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  employee?: ActorSummary | null;
  branch?: BranchSummary | null;
  approvalProgress?: {
    currentStepName?: string | null;
    currentApproverLabel?: string | null;
  } | null;
  clearanceSummary?: {
    mandatoryTotal: number;
    mandatoryCleared: number;
    mandatoryOutstanding: number;
    assetClearanceBlocked: boolean;
  } | null;
  allowedActions?: SeparationAction[];
  actionRequirements?: ActionRequirements;
  completePreflight?: SeparationCompletePreflight;
  clearanceItems?: EmployeeClearanceItem[];
}

export interface EmployeeClearanceItem {
  id: string;
  separationId: string;
  executorDepartmentId?: string | null;
  executorDepartmentName?: string | null;
  itemType: "HR" | "FINANCE" | "IT" | "ADMIN" | "ASSET" | string;
  title: string;
  mandatory: boolean;
  status: "PENDING" | "CLEARED" | "REOPENED" | string;
  version: number;
  clearedAt?: string | null;
  clearedBy?: ActorSummary | null;
  employee?: ActorSummary | null;
  branch?: BranchSummary | null;
  separation?: {
    id: string;
    separationType?: string | null;
    reason?: string | null;
    lastWorkingDate?: string | null;
    createdAt?: string | null;
  } | null;
  allowedActions?: ClearanceAction[];
  actionRequirements?: ActionRequirements;
}

export interface CreateEmployeeSeparationInput {
  employeeId: string;
  separationType: "RESIGNATION" | "TERMINATION" | "RETIREMENT";
  lastWorkingDate: string;
  reason: string;
  clearanceDepartments: ClearanceDepartmentMapping[];
  operationId: string;
}

export type ManualClearanceType = "HR" | "FINANCE" | "IT" | "ADMIN";

export interface ClearanceDepartmentMapping {
  clearanceType: ManualClearanceType;
  executorDepartmentId: string;
  itemName?: string;
}

export interface ClearanceDepartmentCandidate {
  id: string;
  departmentCode?: string | null;
  departmentName: string;
}

export interface SeparationCommandInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
  remarks?: string;
  clearanceRemarks?: string;
}

export interface ClearanceCommandInput {
  expectedVersion: number;
  operationId: string;
  reason?: string;
  remarks?: string;
}

export type HrRequestFilters = {
  employeeId?: string;
  status?: HrRequestStatus;
  keyword?: string;
  page?: number;
  limit?: number;
};

export type SeparationFilters = {
  status?: SeparationStatus;
  keyword?: string;
  page?: number;
  limit?: number;
};
