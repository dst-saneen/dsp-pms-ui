import type {
  ProjectStageStatus,
  ProjectStatus,
  ProjectTaskStatus,
  ProjectType,
} from '@prisma/client';

export type ProjectAction =
  | 'EDIT'
  | 'ACTIVATE'
  | 'HOLD'
  | 'RESUME'
  | 'COMPLETE'
  | 'CANCEL'
  | 'ARCHIVE'
  | 'MANAGE_STAGES'
  | 'MANAGE_TEAM'
  | 'MANAGE_TASKS';

export type ProjectTaskAction =
  | 'ASSIGN'
  | 'REASSIGN'
  | 'UNASSIGN'
  | 'START'
  | 'SUBMIT_REVIEW'
  | 'RETURN'
  | 'COMPLETE'
  | 'CANCEL'
  | 'LOG_TIME'
  | 'ATTACH_DOCUMENT';

export type WorkLogAction = 'EDIT' | 'SUBMIT' | 'APPROVE' | 'RETURN' | 'CANCEL';

export interface TimesheetLineView {
  id: string;
  version: number;
  workDate: string;
  hours: string;
  taskId: string | null;
  workCategoryId: string | null;
  sourceType: string | null;
  remarks: string | null;
}

export interface TimesheetView {
  id: string;
  version: number;
  companyId: string;
  branchId: string;
  employeeId: string;
  displayName: string | null;
  employeeCode: string | null;
  periodStart: string;
  periodEnd: string;
  totalHours: string;
  status: import('@prisma/client').WorkLogStatus;
  remarks: string | null;
  reportingManagerEmployeeId: string | null;
  reportingManagerUserId: string | null;
  lines: TimesheetLineView[];
  allowedActions: WorkLogAction[];
  actionRequirements: {
    expectedVersion: number;
  };
}

export interface ProjectsActorContext {
  userId: string;
  employeeId?: string;
  permissions: string[];
  companyId?: string;
  branchId?: string;
}

export interface ProjectDetailView {
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
  actionRequirements: {
    expectedVersion: number;
  };
}

export interface ProjectStageView {
  id: string;
  version: number;
  projectId: string;
  stageCode: string;
  stageName: string;
  description: string | null;
  sequenceNo: number;
  status: ProjectStageStatus;
  startDate: string | null;
  endDate: string | null;
  allowedActions: Array<'EDIT' | 'ACTIVATE' | 'COMPLETE' | 'CANCEL'>;
  actionRequirements: {
    expectedVersion: number;
  };
}

export interface ProjectTeamMemberView {
  id: string;
  version: number;
  projectId: string;
  employeeId: string;
  displayName: string | null;
  employeeCode: string | null;
  role: string;
  status: 'ACTIVE' | 'ENDED';
  allocationPercentage: string;
  startDate: string | null;
  endDate: string | null;
  allowedActions: Array<'EDIT' | 'END'>;
  actionRequirements: {
    expectedVersion: number;
  };
}

export interface ProjectTaskView {
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
  status: ProjectTaskStatus;
  startDate: string | null;
  dueDate: string | null;
  /** Present on My Workspace task list for linking. */
  projectCode?: string | null;
  projectName?: string | null;
  activeParticipantEmployeeIds: string[];
  allowedActions: ProjectTaskAction[];
  actionRequirements: {
    expectedVersion: number;
  };
}

export interface EligibilityCandidateView {
  employeeId: string;
  displayName: string;
  employeeCode: string | null;
}
