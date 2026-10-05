import type { JobOfferStatus } from "../../types/enums";

export type OfferDeliveryStatus = "NOT_SENT" | "QUEUED" | "SENT" | "FAILED" | "BYPASSED";

export type CompensationPeriod = "MONTHLY" | "ANNUAL";

export interface JobOfferOrganizationSnapshot {
  companyId: string;
  companyName?: string;
  branchId: string;
  branchName?: string;
  departmentId: string;
  departmentName?: string;
  designationId: string;
  designationName?: string;
}

export interface JobOfferCompensation {
  amount: number;
  currency: string;
  period: CompensationPeriod;
}

export interface JobOfferDeliveryState {
  status: OfferDeliveryStatus;
  lastAttemptAt?: string;
  failureReason?: string;
  retryAvailable?: boolean;
}

export interface JobOfferHeadcountImpact {
  reservedBefore: number;
  reservedAfter: number;
  remainingBefore: number;
  remainingAfter: number;
}

export interface JobOfferAllowedActions {
  canEdit: boolean;
  canPreview: boolean;
  canSend: boolean;
  canRetryDelivery: boolean;
  canRevoke: boolean;
  canRevise: boolean;
}

export interface JobOffer {
  id: string;
  jobApplicationId: string;
  applicationNumber: string;
  candidateName: string;
  candidateEmail: string;
  jobOpeningId: string;
  openingCode: string;
  openingTitle: string;
  versionNumber: number;
  status: JobOfferStatus;
  version: number;
  roleTitle: string;
  organization: JobOfferOrganizationSnapshot;
  reportingManagerEmployeeId: string;
  reportingManagerName?: string;
  employmentType: string;
  joiningDate: string;
  compensation: JobOfferCompensation;
  probationDays: number;
  expiryDate: string;
  terms?: string;
  delivery: JobOfferDeliveryState;
  candidateResponseUrl?: string;
  headcountImpact?: JobOfferHeadcountImpact;
  sentAt?: string;
  sentByName?: string;
  revokedAt?: string;
  revokedByName?: string;
  responseAt?: string;
  supersededByVersion?: number;
  allowedActions: JobOfferAllowedActions;
  createdAt: string;
  updatedAt: string;
}

export interface JobOfferSearch {
  search?: string;
  status?: JobOfferStatus;
  jobOpeningId?: string;
  branchId?: string;
}

export interface OfferDraftInput {
  roleTitle: string;
  reportingManagerEmployeeId: string;
  reportingManagerName?: string;
  employmentType: string;
  joiningDate: string;
  compensationAmount: number;
  compensationCurrency: string;
  compensationPeriod: CompensationPeriod;
  probationDays: number;
  expiryDate: string;
  terms?: string;
}

export type CreateOfferDraftDto = OfferDraftInput;

export interface UpdateOfferDraftDto extends OfferDraftInput {
  version: number;
}

export interface SendOfferDto {
  version: number;
}

export interface RevokeOfferDto {
  version: number;
  reason: string;
}

export interface RetryOfferDeliveryDto {
  version: number;
  reason: string;
}
