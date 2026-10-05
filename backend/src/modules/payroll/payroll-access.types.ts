import type { AuthenticatedUser } from '../auth/auth.types';

export interface PayrollAccessContext {
  userId: string;
  permissions: string[];
  employeeId?: string;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  scopeLevel?: 'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';
  isGlobal?: boolean;
}

export function createPayrollAccessContext(
  user: AuthenticatedUser,
): PayrollAccessContext {
  return {
    userId: user.id,
    permissions: user.authorization.permissions,
    employeeId: user.employeeId,
    activeCompanyGroupId: user.authorization.activeCompanyGroupId,
    activeCompanyId: user.authorization.activeCompanyId,
    activeBranchId: user.authorization.activeBranchId,
    scopeLevel: user.authorization.scopeLevel,
    isGlobal: user.authorization.isGlobal,
  };
}
