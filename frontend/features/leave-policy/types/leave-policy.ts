export interface LeavePolicy {
  id: string;
  companyId: string;
  branchId: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  leaveTypeId: string;
  annualEntitlement: number;
  carryForwardLimit?: number | null;
  maxConsecutiveDays?: number | null;
  allowNegativeBalance: boolean;
  isActive: boolean;
  company?: { id: string; companyName: string };
  branch?: { id: string; branchName: string } | null;
  department?: { id: string; departmentName: string } | null;
  designation?: { id: string; designationName: string } | null;
  leaveType?: { id: string; leaveCode: string; leaveName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeavePolicyDto {
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  leaveTypeId: string;
  annualEntitlement: number;
  carryForwardLimit?: number;
  maxConsecutiveDays?: number;
  allowNegativeBalance: boolean;
}

export type UpdateLeavePolicyDto = Partial<CreateLeavePolicyDto>;

export interface LeavePolicyMatrixCell {
  designationId: string;
  leaveTypeId: string;
  enabled: boolean;
  annualEntitlement: number | null;
  policyId: string | null;
}

export interface LeavePolicyMatrixImpact {
  year: number;
  missingBalanceCount: number;
  entitlementChangedCount: number;
  missingBalances: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    leaveTypeId: string;
    leaveTypeName: string;
    designationId: string;
  }>;
  entitlementChanges: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    leaveTypeId: string;
    leaveTypeName: string;
    designationId: string;
    previousDays: number;
    nextDays: number;
  }>;
  balancesNotUpdated: true;
  saved?: {
    created: number;
    updated: number;
    disabled: number;
    unchanged: number;
  };
}

export interface LeavePolicyMatrix {
  companyId: string;
  branchId: string;
  departmentId: string | null;
  snapshotToken: string;
  leaveTypes: Array<{ id: string; leaveCode: string; leaveName: string }>;
  designations: Array<{
    id: string;
    designationCode: string;
    designationName: string;
  }>;
  cells: LeavePolicyMatrixCell[];
  impact: LeavePolicyMatrixImpact;
  saved?: {
    created: number;
    updated: number;
    disabled: number;
    unchanged: number;
  };
}

export interface ReplaceLeavePolicyMatrixDto {
  branchId: string;
  departmentId?: string;
  snapshotToken: string;
  reason: string;
  cells: Array<{
    designationId: string;
    leaveTypeId: string;
    enabled: boolean;
    annualEntitlement?: number;
  }>;
}
