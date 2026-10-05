/** Server-generated preflight check result — API plan contract. */
export type PreflightCheckStatus = "PASSED" | "BLOCKED" | "WARNING";

/** Known FE mock codes; live API may return additional codes as plain strings. */
export const PREFLIGHT_CHECK_CODES = {
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  POSITION_RESERVED: "POSITION_RESERVED",
  HEADCOUNT_RESERVED: "HEADCOUNT_RESERVED",
  NOT_ALREADY_CONVERTED: "NOT_ALREADY_CONVERTED",
  ALREADY_CONVERTED: "ALREADY_CONVERTED",
  CANDIDATE_EMAIL_AVAILABLE: "CANDIDATE_EMAIL_AVAILABLE",
  CANDIDATE_EMAIL_VALID: "CANDIDATE_EMAIL_VALID",
  ORGANIZATION_ACTIVE: "ORGANIZATION_ACTIVE",
  MANAGER_ACTIVE: "MANAGER_ACTIVE",
  ONBOARDING_TEMPLATE_RESOLVED: "ONBOARDING_TEMPLATE_RESOLVED",
  ONBOARDING_TEMPLATE_CONFIGURED: "ONBOARDING_TEMPLATE_CONFIGURED",
  IDENTITY_AVAILABLE: "IDENTITY_AVAILABLE",
  NO_CONFLICTING_USER: "NO_CONFLICTING_USER",
  CANDIDATE_NOT_ALREADY_EMPLOYEE: "CANDIDATE_NOT_ALREADY_EMPLOYEE",
  SIGNED_OFFER_VERIFIED: "SIGNED_OFFER_VERIFIED",
  DOCUMENT_TYPE_MAPPING: "DOCUMENT_TYPE_MAPPING",
} as const;

export type PreflightCheckCode = string;

export interface PreflightCheckItem {
  code: PreflightCheckCode;
  label: string;
  status: PreflightCheckStatus;
  message: string;
}

export interface ConversionPreflight {
  applicationId: string;
  candidateName: string;
  roleTitle: string;
  organizationSummary: string;
  joiningDate: string;
  onboardingTemplateName: string;
  reportingManagerName?: string;
  canConvert: boolean;
  existingEmployeeId?: string;
  existingUserId?: string;
  existingEmployeeOnboardingId?: string;
  invitationDeliveryStatus?: InvitationDeliveryStatus;
  checks: PreflightCheckItem[];
  applicationVersion: number;
  acceptedOfferId: string;
  acceptedOfferVersion: number;
}

export interface ConvertCandidateDto {
  applicationVersion: number;
  acceptedOfferVersion: number;
  confirmationNote?: string;
  /** Client command receipt key — repeat submit with same id returns the same conversion. */
  operationId: string;
}

export type InvitationDeliveryStatus = "DELIVERED" | "FAILED" | "PENDING";

export interface ConversionResult {
  employeeId: string;
  employeeCode: string;
  applicationId: string;
  userId?: string;
  employeeOnboardingId?: string;
  invitationId?: string;
  invitationDeliveryStatus: InvitationDeliveryStatus;
  isExistingConversion: boolean;
  operationId?: string;
}

export interface ReadyToHireQueueItem {
  applicationId: string;
  applicationNumber: string;
  candidateName: string;
  openingTitle: string;
  branchName?: string;
  acceptedAt?: string;
  canConvert: boolean;
  existingEmployeeId?: string;
}
