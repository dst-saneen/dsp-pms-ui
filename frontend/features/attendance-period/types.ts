export interface AttendancePeriod {
  id: string;
  companyId: string;
  branchId: string;
  periodYear: number;
  periodMonth: number;
  periodStart: string;
  periodEnd: string;
  status: string;
  version: number;
  reopenReason?: string | null;
  branch?: { id: string; branchCode?: string; branchName?: string } | null;
  company?: { id: string; companyCode?: string; companyName?: string } | null;
}

export interface AttendancePeriodFilters {
  branchId?: string;
  companyId?: string;
  status?: string;
}

export interface CreateAttendancePeriodInput {
  branchId: string;
  periodYear: number;
  periodMonth: number;
}

export type AttendancePeriodAction =
  | "review"
  | "lock"
  | "mark-payroll-pending"
  | "close"
  | "reopen";

export interface AttendancePeriodTransitionInput {
  expectedVersion: number;
  reopenReason?: string;
}
