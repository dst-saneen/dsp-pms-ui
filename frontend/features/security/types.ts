export type RoleScope = "GLOBAL" | "COMPANY_GROUP" | "COMPANY" | "BRANCH";
export type UserStatus = "INVITED" | "ACTIVE" | "LOCKED" | "DISABLED";

export interface SecurityRole {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  companyGroupId?: string;
  _count?: {
    assignments: number;
  };
  permissions?: Array<{
    permission: SecurityPermission;
  }>;
}

export interface SecurityPermission {
  id: string;
  code: string;
  name: string;
  description?: string;
  isTenantAssignable?: boolean;
}

export interface SecurityUserAssignment {
  id: string;
  scope: RoleScope;
  scopeKey: string;
  companyGroupId?: string;
  companyId?: string;
  branchId?: string;
  role: Pick<SecurityRole, "id" | "code" | "name">;
}

export interface SecurityUserAssignmentInput {
  roleId: string;
  scope: RoleScope;
  companyGroupId?: string;
  companyId?: string;
  branchId?: string;
}

export interface SecurityUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  status: UserStatus;
  mustChangePassword: boolean;
  employeeId?: string;
  lastLoginAt?: string;
  createdAt: string;
  roleAssignments: SecurityUserAssignment[];
}

export interface CreateSecurityUserInput {
  username?: string;
  displayName: string;
  email: string;
  employeeId?: string;
  defaultCompanyGroupId?: string;
  defaultCompanyId?: string;
  defaultBranchId?: string;
  roleAssignments: SecurityUserAssignmentInput[];
}

export interface SecurityDeliveryResult {
  deliveryStatus: "SENT" | "BYPASSED";
  expiresAt: string;
  resendAvailableAt: string;
  developmentActionUrl?: string;
}

export interface CreateSecurityRoleInput {
  name: string;
  description?: string;
  permissionIds: string[];
}

export interface SecurityUserSession {
  id: string;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  createdAt: string;
}
