export interface EmployeeLeaveSummary {
  totalEntitlement: number;

  totalUsed: number;

  totalPending: number;

  totalBalance: number;
}

export interface EmployeeLeaveBalance {
  leaveTypeId: string;

  leaveCode: string;

  leaveName: string;

  entitlement: number;

  used: number;

  pending: number;

  balance: number;
}

export interface EmployeeLeaveHistory {
  id: string;

  leaveType: string;

  fromDate: string;

  toDate: string;

  requestedDays: number;

  approvedDays?: number;

  status: string;

  createdAt: string;
}

export interface EmployeeUpcomingLeave {
  id: string;

  leaveType: string;

  fromDate: string;

  toDate: string;

  approvedDays: number;

  status: string;
}

export interface EmployeeLeaveProfileModel {
  summary: EmployeeLeaveSummary;
  balances: EmployeeLeaveBalance[];
  history: EmployeeLeaveHistory[];
  upcoming: EmployeeUpcomingLeave[];
}