export interface LeaveRequestEmployee {
  id: string;
  employeeCode?: string;
  firstName?: string;
  lastName?: string | null;
}

export interface LeaveRequestLeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
}

export type LeaveApprovalQueue =
  | "manager"
  | "hr"
  | "completed"
  | "actionable";

export interface LeaveApprovalProgress {
  stage: string;
  currentStepName: string | null;
  previousStepName: string | null;
  canAct: boolean;
  isFinalStep: boolean;
  steps: Array<{
    name: string;
    status: string;
    decidedAt: string | null;
  }>;
  balancePreview: {
    year: number | null;
    entitlement: number | null;
    used: number;
    pending: number;
    available: number;
    afterApprove: { used: number; pending: number; available: number };
    afterReject: { used: number; pending: number; available: number };
  } | null;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  requestedDays: number | string;
  approvedDays?: number | string | null;
  isHalfDay: boolean;
  reason?: string | null;
  status: string;
  createdAt: string;
  employee?: LeaveRequestEmployee | null;
  leaveType?: LeaveRequestLeaveType | null;
  approvalProgress?: LeaveApprovalProgress | null;
}

export interface LeaveRequestFilters {
  employeeId?: string;
  leaveTypeId?: string;
  status?: string;
}
