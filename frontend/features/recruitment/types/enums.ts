/** Job Opening lifecycle — API plan state machine. */
export const JOB_OPENING_STATUS = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  ON_HOLD: "ON_HOLD",
  FILLED: "FILLED",
  CLOSED: "CLOSED",
} as const;

export type JobOpeningStatus =
  (typeof JOB_OPENING_STATUS)[keyof typeof JOB_OPENING_STATUS];

/** Job Application lifecycle — API plan state machine. */
export const JOB_APPLICATION_STATUS = {
  APPLIED: "APPLIED",
  SHORTLISTED: "SHORTLISTED",
  SCREENING: "SCREENING",
  INTERVIEW: "INTERVIEW",
  MANAGER_REVIEW: "MANAGER_REVIEW",
  SELECTED: "SELECTED",
  OFFER_SENT: "OFFER_SENT",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  HIRED: "HIRED",
  REJECTED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  OFFER_DECLINED: "OFFER_DECLINED",
} as const;

export type JobApplicationStatus =
  (typeof JOB_APPLICATION_STATUS)[keyof typeof JOB_APPLICATION_STATUS];

/** Versioned offer lifecycle — API plan. */
export const JOB_OFFER_STATUS = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED",
  SUPERSEDED: "SUPERSEDED",
} as const;

export type JobOfferStatus =
  (typeof JOB_OFFER_STATUS)[keyof typeof JOB_OFFER_STATUS];

/** Interview session lifecycle — API plan. */
export const INTERVIEW_SESSION_STATUS = {
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  RESCHEDULED: "RESCHEDULED",
} as const;

export type InterviewSessionStatus =
  (typeof INTERVIEW_SESSION_STATUS)[keyof typeof INTERVIEW_SESSION_STATUS];

/** Panel evaluation lifecycle — API plan. */
export const INTERVIEW_EVALUATION_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
} as const;

export type InterviewEvaluationStatus =
  (typeof INTERVIEW_EVALUATION_STATUS)[keyof typeof INTERVIEW_EVALUATION_STATUS];

/** Employee employment status during recruitment conversion — API plan. */
export const RECRUITMENT_EMPLOYEE_STATUS = {
  PENDING_ONBOARDING: "PENDING_ONBOARDING",
  PROBATION: "PROBATION",
  ACTIVE: "ACTIVE",
} as const;

export type RecruitmentEmployeeStatus =
  (typeof RECRUITMENT_EMPLOYEE_STATUS)[keyof typeof RECRUITMENT_EMPLOYEE_STATUS];

/** How an employee record was created — API plan. */
export const EMPLOYEE_CREATION_SOURCE = {
  RECRUITMENT: "RECRUITMENT",
  MANUAL: "MANUAL",
  LEGACY_IMPORT: "LEGACY_IMPORT",
  ORGANIZATION_SETUP: "ORGANIZATION_SETUP",
} as const;

export type EmployeeCreationSource =
  (typeof EMPLOYEE_CREATION_SOURCE)[keyof typeof EMPLOYEE_CREATION_SOURCE];

/** Application intake channel — API plan. */
export const JOB_APPLICATION_SOURCE = {
  PUBLIC_CAREERS: "PUBLIC_CAREERS",
  INTERNAL_HR: "INTERNAL_HR",
} as const;

export type JobApplicationSource =
  (typeof JOB_APPLICATION_SOURCE)[keyof typeof JOB_APPLICATION_SOURCE];

/** Interview delivery mode — API plan. */
export const INTERVIEW_MODE = {
  PHONE: "PHONE",
  VIDEO: "VIDEO",
  IN_PERSON: "IN_PERSON",
} as const;

export type InterviewMode =
  (typeof INTERVIEW_MODE)[keyof typeof INTERVIEW_MODE];

/** Recruitment document kinds — API plan. */
export const RECRUITMENT_DOCUMENT_KIND = {
  CV: "CV",
  SUPPORTING_DOCUMENT: "SUPPORTING_DOCUMENT",
  OFFER_PDF: "OFFER_PDF",
} as const;

export type RecruitmentDocumentKind =
  (typeof RECRUITMENT_DOCUMENT_KIND)[keyof typeof RECRUITMENT_DOCUMENT_KIND];
