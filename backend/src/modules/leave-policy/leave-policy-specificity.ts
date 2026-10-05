export type LeavePolicyMatchTier =
  | 'COMPANY_DEFAULT'
  | 'BRANCH_DEPARTMENT_DESIGNATION'
  | 'BRANCH_DESIGNATION'
  | 'BRANCH_DEPARTMENT'
  | 'BRANCH_DEFAULT';

export const LeavePolicySpecificity = {
  COMPANY_DEFAULT: 0,
  BRANCH_DEFAULT: 1,
  BRANCH_DEPARTMENT: 2,
  BRANCH_DESIGNATION: 3,
  BRANCH_DEPARTMENT_DESIGNATION: 4,
} as const;

export function scoreLeavePolicy(policy: {
  branchId: string | null;
  departmentId: string | null;
  designationId: string | null;
}): { tier: LeavePolicyMatchTier; specificity: number } {
  if (!policy.branchId) {
    return {
      tier: 'COMPANY_DEFAULT',
      specificity: LeavePolicySpecificity.COMPANY_DEFAULT,
    };
  }
  if (policy.departmentId && policy.designationId) {
    return {
      tier: 'BRANCH_DEPARTMENT_DESIGNATION',
      specificity: LeavePolicySpecificity.BRANCH_DEPARTMENT_DESIGNATION,
    };
  }
  if (policy.designationId) {
    return {
      tier: 'BRANCH_DESIGNATION',
      specificity: LeavePolicySpecificity.BRANCH_DESIGNATION,
    };
  }
  if (policy.departmentId) {
    return {
      tier: 'BRANCH_DEPARTMENT',
      specificity: LeavePolicySpecificity.BRANCH_DEPARTMENT,
    };
  }
  return {
    tier: 'BRANCH_DEFAULT',
    specificity: LeavePolicySpecificity.BRANCH_DEFAULT,
  };
}
