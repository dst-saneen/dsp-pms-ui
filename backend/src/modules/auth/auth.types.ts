import type { Request } from 'express';

export type AuthorizationScopeLevel =
  'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';

export interface AvailableAuthorizationScope {
  scope: AuthorizationScopeLevel;
  companyGroupId?: string;
  companyGroupName?: string;
  companyId?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
}

export interface OrganizationScopeSelection {
  companyGroupId?: string;
  companyId?: string;
  branchId?: string;
}

export interface AuthorizationSnapshot {
  roles: string[];
  permissions: string[];
  scopeLevel: AuthorizationScopeLevel;
  isGlobal: boolean;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  availableScopes: AvailableAuthorizationScope[];
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  employeeId?: string;
  mustChangePassword: boolean;
  sessionId: string;
  authorization: AuthorizationSnapshot;
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  ver: number;
  type: 'access';
}

export interface RequestSecurityMetadata {
  ip?: string;
  userAgent?: string;
}

export interface CachedSession {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  email?: string;
  employeeId?: string;
  mustChangePassword: boolean;
  userStatus: string;
  securityVersion: number;
  refreshTokenHash: string;
  authorization: AuthorizationSnapshot;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt?: string;
}
