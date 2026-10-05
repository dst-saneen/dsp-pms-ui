/** Career milestone types — API plan contract. */
export const CAREER_EVENT_TYPE = {
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  INTERVIEWS_COMPLETED: "INTERVIEWS_COMPLETED",
  SELECTED: "SELECTED",
  OFFER_ACCEPTED: "OFFER_ACCEPTED",
  EMPLOYEE_CREATED: "EMPLOYEE_CREATED",
  ONBOARDING_STARTED: "ONBOARDING_STARTED",
  ONBOARDING_COMPLETED: "ONBOARDING_COMPLETED",
  PROBATION_STARTED: "PROBATION_STARTED",
  PROBATION_CONFIRMED: "PROBATION_CONFIRMED",
  PROMOTION: "PROMOTION",
  TRANSFER: "TRANSFER",
  MANAGER_CHANGE: "MANAGER_CHANGE",
  SEPARATION: "SEPARATION",
} as const;

export type CareerEventType =
  (typeof CAREER_EVENT_TYPE)[keyof typeof CAREER_EVENT_TYPE];

export type CareerTimelineView = "HR" | "SANITIZED";

export interface CareerTimelineEvent {
  id: string;
  eventType: CareerEventType;
  occurredAt: string;
  summary: string;
  hrDetail?: string;
  sourceModule?: string;
  sourceRecordId?: string;
  actorName?: string;
}

export interface EmployeeCareerTimeline {
  employeeId: string;
  view: CareerTimelineView;
  events: CareerTimelineEvent[];
}
