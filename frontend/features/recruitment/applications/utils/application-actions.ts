import {
  JOB_APPLICATION_SOURCE,
  JOB_APPLICATION_STATUS,
  type JobApplicationStatus,
} from "../../types/enums";
import type { JobApplication } from "../types/job-application";

const TERMINAL_STATUSES = new Set<JobApplicationStatus>([
  JOB_APPLICATION_STATUS.REJECTED,
  JOB_APPLICATION_STATUS.WITHDRAWN,
  JOB_APPLICATION_STATUS.OFFER_DECLINED,
  JOB_APPLICATION_STATUS.HIRED,
]);

/** Happy-path lifecycle for the detail stepper (side exits shown separately). */
export const APPLICATION_LIFECYCLE_STEPS: JobApplicationStatus[] = [
  JOB_APPLICATION_STATUS.APPLIED,
  JOB_APPLICATION_STATUS.SHORTLISTED,
  JOB_APPLICATION_STATUS.SCREENING,
  JOB_APPLICATION_STATUS.INTERVIEW,
  JOB_APPLICATION_STATUS.MANAGER_REVIEW,
  JOB_APPLICATION_STATUS.SELECTED,
  JOB_APPLICATION_STATUS.OFFER_SENT,
  JOB_APPLICATION_STATUS.OFFER_ACCEPTED,
  JOB_APPLICATION_STATUS.HIRED,
];

export function isTerminalApplicationStatus(status: JobApplicationStatus) {
  return TERMINAL_STATUSES.has(status);
}

export function buildApplicationAllowedActions(
  status: JobApplicationStatus,
): JobApplication["allowedActions"] {
  if (TERMINAL_STATUSES.has(status)) {
    return {
      canShortlist: false,
      canStartScreening: false,
      canAdvanceToInterview: false,
      canAdvanceToManagerReview: false,
      canReject: false,
      canWithdraw: false,
    };
  }

  return {
    canShortlist: status === JOB_APPLICATION_STATUS.APPLIED,
    canStartScreening: status === JOB_APPLICATION_STATUS.SHORTLISTED,
    canAdvanceToInterview: status === JOB_APPLICATION_STATUS.SCREENING,
    canAdvanceToManagerReview: false,
    canReject: true,
    canWithdraw: (
      [
        JOB_APPLICATION_STATUS.APPLIED,
        JOB_APPLICATION_STATUS.SHORTLISTED,
        JOB_APPLICATION_STATUS.SCREENING,
        JOB_APPLICATION_STATUS.INTERVIEW,
        JOB_APPLICATION_STATUS.MANAGER_REVIEW,
      ] as JobApplicationStatus[]
    ).includes(status),
  };
}

export function buildApplicationNextAction(
  status: JobApplicationStatus,
): string | undefined {
  switch (status) {
    case JOB_APPLICATION_STATUS.APPLIED:
      return "Shortlist candidate";
    case JOB_APPLICATION_STATUS.SHORTLISTED:
      return "Start screening";
    case JOB_APPLICATION_STATUS.SCREENING:
      return "Advance to interview";
    case JOB_APPLICATION_STATUS.INTERVIEW:
      return "Complete interviews and evaluations";
    case JOB_APPLICATION_STATUS.MANAGER_REVIEW:
      return "Await hiring manager decision";
    case JOB_APPLICATION_STATUS.SELECTED:
      return "Prepare offer";
    case JOB_APPLICATION_STATUS.OFFER_SENT:
      return "Await candidate response";
    case JOB_APPLICATION_STATUS.OFFER_ACCEPTED:
      return "Convert to employee";
    case JOB_APPLICATION_STATUS.HIRED:
      return "Hired — no further recruitment action";
    case JOB_APPLICATION_STATUS.REJECTED:
      return "Rejected — process complete";
    case JOB_APPLICATION_STATUS.WITHDRAWN:
      return "Withdrawn — process complete";
    case JOB_APPLICATION_STATUS.OFFER_DECLINED:
      return "Offer declined — process complete";
    default:
      return undefined;
  }
}

export function buildApplicationCurrentOwner(
  status: JobApplicationStatus,
): string | undefined {
  switch (status) {
    case JOB_APPLICATION_STATUS.APPLIED:
    case JOB_APPLICATION_STATUS.SHORTLISTED:
    case JOB_APPLICATION_STATUS.SCREENING:
      return "HR";
    case JOB_APPLICATION_STATUS.INTERVIEW:
      return "Interview panel";
    case JOB_APPLICATION_STATUS.MANAGER_REVIEW:
      return "Hiring manager";
    case JOB_APPLICATION_STATUS.SELECTED:
    case JOB_APPLICATION_STATUS.OFFER_SENT:
    case JOB_APPLICATION_STATUS.OFFER_ACCEPTED:
      return "HR";
    default:
      return undefined;
  }
}

export type ApplicationPrimaryActionKind =
  | "shortlist"
  | "start_screening"
  | "advance_interview"
  | "advance_manager"
  | "open_interviews"
  | "open_hiring_decision"
  | "open_offer"
  | "await"
  | "terminal"
  | "blocked";

export interface ApplicationPrimaryAction {
  kind: ApplicationPrimaryActionKind;
  label: string;
  explanation: string;
  tab?: "interviews" | "offer" | "evaluations";
}

/**
 * Exactly one primary next step for the command center.
 * Secondary reject/withdraw stay separate when authorized.
 */
export function resolveApplicationPrimaryAction(
  application: Pick<JobApplication, "status" | "allowedActions" | "nextAction">,
  options?: { shortlistAvailable?: boolean },
): ApplicationPrimaryAction {
  const { status, allowedActions } = application;
  const shortlistAvailable = options?.shortlistAvailable ?? true;

  if (isTerminalApplicationStatus(status)) {
    return {
      kind: "terminal",
      label: buildApplicationNextAction(status) ?? "Process complete",
      explanation:
        status === JOB_APPLICATION_STATUS.HIRED
          ? "This candidate has been hired. Recruitment actions are closed."
          : "This application is in a terminal state. No further recruitment transitions are available.",
    };
  }

  if (allowedActions.canShortlist) {
    if (!shortlistAvailable) {
      return {
        kind: "blocked",
        label: "Shortlist unavailable",
        explanation:
          "Shortlist is not available for the active Company and Branch. Reject the application or contact an administrator.",
      };
    }
    return {
      kind: "shortlist",
      label: "Shortlist",
      explanation: "Move this applied candidate into shortlist for screening.",
    };
  }

  if (allowedActions.canStartScreening) {
    return {
      kind: "start_screening",
      label: "Start screening",
      explanation: "Begin HR screening for this shortlisted candidate.",
    };
  }

  if (allowedActions.canAdvanceToInterview) {
    return {
      kind: "advance_interview",
      label: "Advance to interview",
      explanation: "Screening is complete — open the interview stage.",
    };
  }

  if (status === JOB_APPLICATION_STATUS.INTERVIEW) {
    if (allowedActions.canAdvanceToManagerReview) {
      return {
        kind: "advance_manager",
        label: "Advance to manager review",
        explanation:
          "Required interviews and panel evaluations are complete.",
      };
    }
    return {
      kind: "open_interviews",
      label: "Manage interviews",
      explanation:
        "Schedule, complete, and evaluate interviews before manager review.",
      tab: "interviews",
    };
  }

  if (allowedActions.canAdvanceToManagerReview) {
    return {
      kind: "advance_manager",
      label: "Advance to manager review",
      explanation:
        "Required interviews and panel evaluations are complete.",
    };
  }

  if (status === JOB_APPLICATION_STATUS.MANAGER_REVIEW) {
    return {
      kind: "open_hiring_decision",
      label: "Open hiring decision",
      explanation:
        "Compare interview-ready candidates and record select or reject for this opening.",
    };
  }

  if (status === JOB_APPLICATION_STATUS.SELECTED) {
    return {
      kind: "open_offer",
      label: "Prepare offer",
      explanation: "Create or send the offer for this selected candidate.",
      tab: "offer",
    };
  }

  if (status === JOB_APPLICATION_STATUS.OFFER_SENT) {
    return {
      kind: "await",
      label: "Await candidate response",
      explanation: "Track offer delivery and wait for accept or decline.",
      tab: "offer",
    };
  }

  if (status === JOB_APPLICATION_STATUS.OFFER_ACCEPTED) {
    return {
      kind: "open_offer",
      label: "Ready to hire",
      explanation: "Complete conversion to employee from the offer / hire panel.",
      tab: "offer",
    };
  }

  return {
    kind: "blocked",
    label: application.nextAction ?? "No primary action",
    explanation: "No authorized primary transition is available right now.",
  };
}

export function formatApplicationSource(source: string) {
  if (source === JOB_APPLICATION_SOURCE.PUBLIC_CAREERS) {
    return "Public careers";
  }
  if (source === JOB_APPLICATION_SOURCE.INTERNAL_HR || source === "HR_INTERNAL") {
    return "Internal HR entry";
  }
  return source;
}

export function formatApplicationStatusLabel(status: JobApplicationStatus) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
