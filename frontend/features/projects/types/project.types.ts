export type ProjectAction =
  | "EDIT"
  | "ACTIVATE"
  | "HOLD"
  | "RESUME"
  | "COMPLETE"
  | "CANCEL"
  | "ARCHIVE"
  | "MANAGE_STAGES"
  | "MANAGE_TEAM"
  | "MANAGE_TASKS";

export type ProjectTaskAction =
  | "ASSIGN"
  | "REASSIGN"
  | "UNASSIGN"
  | "START"
  | "SUBMIT_REVIEW"
  | "RETURN"
  | "COMPLETE"
  | "CANCEL"
  | "LOG_TIME"
  | "ATTACH_DOCUMENT";

export type WorkLogAction = "EDIT" | "SUBMIT" | "APPROVE" | "RETURN" | "CANCEL";

export type ProjectStatus =
  "DRAFT" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

export type ProjectType = "CLIENT" | "INTERNAL";

export type WorkLogStatus =
  "DRAFT" | "SUBMITTED" | "APPROVED" | "RETURNED" | "CANCELLED";

export interface ActionRequirements {
  expectedVersion: number;
}

export interface ProjectDetail {
  id: string;
  version: number;
  projectCode: string;
  projectName: string;
  description: string | null;
  projectType: ProjectType;
  status: ProjectStatus;
  companyId: string;
  branchId: string | null;
  projectManagerId: string | null;
  businessPartyId: string | null;
  currencyCode: string | null;
  expectedIncome: string | null;
  expenseBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  archivedAt: string | null;
  allowedActions: ProjectAction[];
  actionRequirements: ActionRequirements;
}

export interface ProjectStage {
  id: string;
  version: number;
  projectId: string;
  stageCode: string;
  stageName: string;
  description: string | null;
  sequenceNo: number;
  status: string;
  startDate: string | null;
  endDate: string | null;
  allowedActions: Array<"EDIT" | "ACTIVATE" | "COMPLETE" | "CANCEL">;
  actionRequirements: ActionRequirements;
}

export interface ProjectTeamMember {
  id: string;
  version: number;
  projectId: string;
  employeeId: string;
  displayName?: string | null;
  employeeCode?: string | null;
  role: string;
  status: "ACTIVE" | "ENDED";
  allocationPercentage: string;
  startDate: string | null;
  endDate: string | null;
  allowedActions: Array<"EDIT" | "END">;
  actionRequirements: ActionRequirements;
}

export interface WorkspaceCapabilities {
  clientProjectsEnabled: boolean;
  financeSummaryEnabled: boolean;
  businessPartyEnabled: boolean;
  allowedProjectTypes: Array<"INTERNAL" | "CLIENT">;
  canCreateProject: boolean;
  canManageProjects: boolean;
  canReadProjects: boolean;
  canSubmitTimesheets: boolean;
  canApproveTimesheets: boolean;
  myTasksEnabled: boolean;
}

export interface ActivationPreflight {
  ready: boolean;
  blockers: Array<{ code: string; message: string }>;
}

export interface ProjectTask {
  id: string;
  version: number;
  projectId: string;
  stageId: string;
  taskCode: string;
  taskName: string;
  description: string | null;
  parentTaskId: string | null;
  priority: string;
  plannedHours: string | null;
  completionPercentage: string | null;
  status: string;
  startDate: string | null;
  dueDate: string | null;
  /** Present on My Workspace assigned-task list. */
  projectCode?: string | null;
  projectName?: string | null;
  activeParticipantEmployeeIds: string[];
  allowedActions: ProjectTaskAction[];
  actionRequirements: ActionRequirements;
}

export interface ProjectTaskDocument {
  id: string;
  taskSubmissionId: string | null;
  documentPurpose: string;
  title: string | null;
  uploadedAt: string;
}

export interface ProjectTaskAssignmentHistoryEntry {
  id: string;
  employeeId: string;
  previousEmployeeId: string | null;
  role: string;
  action: string;
  remarks: string | null;
  createdAt: string;
}

export interface ProjectTaskReview {
  id: string;
  version: number;
  reviewerId: string;
  decision: string;
  comments: string | null;
  reviewRound: number;
  reviewedAt: string;
}

export interface ProjectTaskSubmission {
  id: string;
  version: number;
  versionNo: number;
  submissionNotes: string | null;
  status: string;
  submittedById: string;
  submittedAt: string;
  reviews: ProjectTaskReview[];
  documents: ProjectTaskDocument[];
}

export interface ProjectTaskDetail extends ProjectTask {
  submissions: ProjectTaskSubmission[];
  assignmentHistory: ProjectTaskAssignmentHistoryEntry[];
  documents: ProjectTaskDocument[];
}

export interface TimesheetLine {
  id: string;
  version: number;
  workDate: string;
  hours: string;
  taskId: string | null;
  workCategoryId: string | null;
  sourceType: string | null;
  remarks: string | null;
}

export interface Timesheet {
  id: string;
  version: number;
  companyId: string;
  branchId: string;
  employeeId: string;
  displayName?: string | null;
  employeeCode?: string | null;
  periodStart: string;
  periodEnd: string;
  totalHours: string;
  status: WorkLogStatus;
  remarks: string | null;
  reportingManagerEmployeeId: string | null;
  reportingManagerUserId: string | null;
  lines: TimesheetLine[];
  allowedActions: WorkLogAction[];
  actionRequirements: ActionRequirements;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface EligibilityCandidate {
  employeeId: string;
  displayName: string;
  employeeCode: string | null;
}

export interface ProjectSummary {
  project: ProjectDetail;
  stages: Record<string, number>;
  team: { activeMembers: number };
  tasks: Record<string, number>;
  documents: { count: number };
}

export interface ProjectTimeSummary {
  projectId: string;
  plannedHours: string;
  approvedHours: string;
  byEmployee: Array<{ employeeId: string; hours: string }>;
  byTask: Array<{ taskId: string; hours: string }>;
}

export interface ProjectFinanceSummary {
  projectId: string;
  enabled: boolean;
  currencyCode: string | null;
  expectedIncome: string | null;
  expenseBudget: string | null;
  approvedIncome: string | null;
  approvedExpenses: string | null;
  netOperationalCash: string | null;
  message?: string;
}

export interface VersionedCommand {
  expectedVersion: number;
  operationId: string;
  reason?: string;
}
