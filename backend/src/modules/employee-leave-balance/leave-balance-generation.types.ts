export interface LeaveBalanceGenerationIssue {
  employeeId: string;
  employeeCode?: string;
  leaveTypeId?: string;
  code: string;
  message: string;
}

export interface LeaveBalanceGenerationCreateItem {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitlement: number;
  annualEntitlement: number;
  carryForward: number;
  policyId: string;
  companyId: string;
  branchId: string;
}

export interface LeaveBalanceGenerationRetainItem {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  balanceId: string;
  used: number;
  pending: number;
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
  createPreview: LeaveBalanceGenerationCreateItem[];
  retainPreview: LeaveBalanceGenerationRetainItem[];
}
