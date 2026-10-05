export type AuthorizationScopeLevel = "GLOBAL" | "COMPANY_GROUP" | "COMPANY" | "BRANCH";

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

export interface AuthUser {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  employeeId?: string;
  mustChangePassword: boolean;
  sessionId: string;
  authorization: AuthorizationSnapshot;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
}

export interface AuthSessionSummary {
  id: string;
  activeCompanyGroupId?: string;
  activeCompanyId?: string;
  activeBranchId?: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  revokedAt?: string;
  revocationReason?: string;
  createdAt: string;
}

export interface AuthCapabilities {
  selfRegistrationEnabled: boolean;
  platformSetupAvailable?: false;
  publicCareersEnabled: boolean;
}

export interface RegistrationStartResponse {
  registrationId: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  deliveryStatus: "SENT" | "BYPASSED" | "FAILED";
  developmentVerificationCode?: string;
}

export interface OrganizationRegistrationInput {
  organizationName: string;
  legalCountryCode: string;
  displayName: string;
  email: string;
  password: string;
}

export interface InvitationInspection {
  status: "VALID";
  displayName: string;
  maskedEmail: string;
  expiresAt: string;
  passwordPolicy: {
    minimumLength: number;
    maximumLength: number;
    mustDifferFromEmailOrUsername?: boolean;
  };
  scopeSelectionRequired?: true;
  availableScopes?: AvailableAuthorizationScope[];
}

export interface PasswordResetRequestResponse {
  accepted: true;
  message: string;
  developmentActionUrl?: string;
}
