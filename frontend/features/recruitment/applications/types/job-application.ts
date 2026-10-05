import type {
  JobApplicationSource,
  JobApplicationStatus,
  RecruitmentDocumentKind,
} from "../../types/enums";

export interface RecruitmentDocument {
  id: string;
  kind: RecruitmentDocumentKind;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
}

export interface ApplicationTimelineEntry {
  id: string;
  fromStatus?: JobApplicationStatus;
  toStatus: JobApplicationStatus;
  summary: string;
  reasonCode?: string;
  comment?: string;
  actorName: string;
  occurredAt: string;
}

export interface JobApplicationAllowedActions {
  canShortlist: boolean;
  canStartScreening: boolean;
  canAdvanceToInterview: boolean;
  canAdvanceToManagerReview: boolean;
  canReject: boolean;
  canWithdraw: boolean;
}

export interface JobApplication {
  id: string;
  applicationNumber: string;
  candidateId: string;
  candidateFirstName: string;
  candidateLastName: string;
  candidateEmail: string;
  candidateMobile?: string;
  jobOpeningId: string;
  openingCode: string;
  openingTitle: string;
  branchId: string;
  branchName?: string;
  companyId: string;
  companyName?: string;
  status: JobApplicationStatus;
  source: JobApplicationSource;
  version: number;
  coverNote?: string;
  submittedAt: string;
  currentOwner?: string;
  nextAction?: string;
  relevantDeadline?: string;
  allowedActions: JobApplicationAllowedActions;
  documents: RecruitmentDocument[];
  timeline: ApplicationTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface JobApplicationSearch {
  search?: string;
  status?: JobApplicationStatus;
  jobOpeningId?: string;
  branchId?: string;
  submittedFrom?: string;
  submittedTo?: string;
  page?: number;
  limit?: number;
}

export interface JobApplicationPagedResult {
  items: JobApplication[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateInternalApplicationDto {
  jobOpeningId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  coverNote?: string;
  /** Optional CV file — uploaded and malware-scanned by the API. */
  cvFile?: File;
}


export interface CreatePublicApplicationDto {
  jobOpeningId: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  coverNote?: string;
  cvFileName: string;
  cvFileSize: number;
  supportingDocuments?: Array<{ fileName: string; fileSize: number }>;
}

export interface ApplicationTransitionDto {
  expectedVersion: number;
  operationId: string;
  reasonCode?: string;
  comment?: string;
}
