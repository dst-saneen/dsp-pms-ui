export interface ProbationDueQueueItem {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  designationName?: string;
  departmentName?: string;
  branchName?: string;
  probationStartDate: string;
  plannedEndDate: string;
  daysRemaining: number;
  canConfirmActive: boolean;
  allowEarlyOverride?: boolean;
  confirmBlockedReason?: string;
  version: number;
}

export interface ProbationConfirmationPreflight {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  plannedEndDate: string;
  earliestConfirmationDate: string;
  canConfirm: boolean;
  blockedReason?: string;
  allowEarlyOverride: boolean;
  version: number;
}

export interface ConfirmActiveDto {
  version: number;
  confirmationDate: string;
  note: string;
  reference?: string;
  earlyOverrideReason?: string;
}

export interface ConfirmActiveResult {
  employeeId: string;
  employmentStatus: string;
  actualConfirmationDate: string;
}
