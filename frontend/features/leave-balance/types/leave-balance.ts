export interface LeaveBalanceEmployee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName?: string | null;
  companyId: string;
  branchId: string;
  designationId?: string | null;
  company?: {
    id: string;
    companyCode: string;
    companyName: string;
  };
  branch?: {
    id: string;
    branchCode: string;
    branchName: string;
  };
  designation?: {
    id: string;
    designationCode: string;
    designationName: string;
  } | null;
}

export interface LeaveBalanceLeaveType {
  id: string;
  leaveCode: string;
  leaveName: string;
  isPaid: boolean;
}

export interface EmployeeLeaveBalanceRow {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitlement: number;
  used: number;
  pending: number;
  balance: number;
  isActive: boolean;
  employee?: LeaveBalanceEmployee;
  leaveType?: LeaveBalanceLeaveType;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeLeaveBalanceGroup {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  companyName: string;
  branchName: string;
  designationName: string;
  balances: EmployeeLeaveBalanceRow[];
  totals: {
    entitlement: number;
    used: number;
    pending: number;
    available: number;
  };
}

export interface LeaveBalanceListFilters {
  year?: number;
  companyId?: string;
  branchId?: string;
  employeeId?: string;
  leaveTypeId?: string;
}

export interface LeaveBalanceGenerationIssue {
  employeeId?: string;
  leaveTypeId?: string;
  code?: string;
  message: string;
}

export interface LeaveBalanceGenerationResult {
  dryRun: boolean;
  year: number;
  eligibleEmployeeCount: number;
  applicablePolicyCount: number;
  balancesToCreate: number;
  existingBalancesToRetain: number;
  createdCount: number;
  configurationErrors: LeaveBalanceGenerationIssue[];
  employeesWithoutMatchingPolicy: LeaveBalanceGenerationIssue[];
  createPreview: Array<{
    employeeId: string;
    leaveTypeId: string;
    entitlement: number;
    balance: number;
  }>;
  retainPreview: Array<{
    employeeId: string;
    leaveTypeId: string;
    used: number;
    pending: number;
  }>;
}

export interface GenerateLeaveBalancesInput {
  year: number;
  companyId?: string;
  branchId?: string;
  employeeId?: string;
  dryRun?: boolean;
}
