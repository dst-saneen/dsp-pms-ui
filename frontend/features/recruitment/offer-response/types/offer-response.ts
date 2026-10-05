import type { JobOfferCompensation } from "../../offers/types/job-offer";

export type OfferResponseState =
  | "VALID"
  | "INVALID"
  | "EXPIRED"
  | "REVOKED"
  | "SUPERSEDED"
  | "ALREADY_ACCEPTED"
  | "ALREADY_DECLINED";

export interface PublicOfferSnapshot {
  roleTitle: string;
  companyName?: string;
  branchName?: string;
  designationName?: string;
  reportingManagerName?: string;
  employmentType: string;
  joiningDate: string;
  compensation: JobOfferCompensation;
  probationDays: number;
  expiryDate: string;
  terms?: string;
  versionNumber: number;
}

export interface OfferResponseInspection {
  state: OfferResponseState;
  message: string;
  offer?: PublicOfferSnapshot;
  canRespond: boolean;
  canDownloadPdf: boolean;
  downloadToken?: string;
  responseVersion?: number;
}

export interface OfferResponseInput {
  legalName: string;
  acknowledgement: boolean;
  responseVersion: number;
}

export interface DeclineOfferInput extends OfferResponseInput {
  reason?: string;
}

export interface OfferResponseResult {
  state: "ACCEPTED" | "DECLINED";
  message: string;
  respondedAt: string;
  verificationPending?: boolean;
}
