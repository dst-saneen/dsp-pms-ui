import { CAREER_EVENT_TYPE, type CareerEventType } from "../types/career-timeline";

const LABELS: Record<CareerEventType, string> = {
  [CAREER_EVENT_TYPE.APPLICATION_SUBMITTED]: "Application submitted",
  [CAREER_EVENT_TYPE.INTERVIEWS_COMPLETED]: "Interviews completed",
  [CAREER_EVENT_TYPE.SELECTED]: "Selected",
  [CAREER_EVENT_TYPE.OFFER_ACCEPTED]: "Offer accepted",
  [CAREER_EVENT_TYPE.EMPLOYEE_CREATED]: "Employee created",
  [CAREER_EVENT_TYPE.ONBOARDING_STARTED]: "Onboarding started",
  [CAREER_EVENT_TYPE.ONBOARDING_COMPLETED]: "Onboarding completed",
  [CAREER_EVENT_TYPE.PROBATION_STARTED]: "Probation started",
  [CAREER_EVENT_TYPE.PROBATION_CONFIRMED]: "Probation confirmed",
  [CAREER_EVENT_TYPE.PROMOTION]: "Promotion",
  [CAREER_EVENT_TYPE.TRANSFER]: "Transfer",
  [CAREER_EVENT_TYPE.MANAGER_CHANGE]: "Manager change",
  [CAREER_EVENT_TYPE.SEPARATION]: "Separation",
};

export function formatCareerEventType(eventType: CareerEventType) {
  return LABELS[eventType] ?? eventType;
}
