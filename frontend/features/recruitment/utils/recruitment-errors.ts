import { getApiErrorCode, getApiErrorMessage } from "@/services/api-client";

const STALE_CODES = new Set([
  "STALE_STATE",
  "OPENING_STALE_VERSION",
  "APPLICATION_STALE_VERSION",
  "OFFER_STALE_VERSION",
]);

const TRANSITION_CODES = new Set([
  "INVALID_TRANSITION",
  "OPENING_INVALID_TRANSITION",
  "APPLICATION_INVALID_TRANSITION",
  "OFFER_NOT_DRAFT",
  "OFFER_NOT_REVISABLE",
  "APPLICATION_NOT_OFFER_READY",
]);

const HEADCOUNT_CODES = new Set([
  "HEADCOUNT_NOT_AVAILABLE",
  "HEADCOUNT_EXHAUSTED",
  "HEADCOUNT_UNAVAILABLE",
  "HEADCOUNT_RESERVATION_FAILED",
]);

export function recruitmentErrorCode(error: unknown): string {
  return (
    getApiErrorCode(error) ||
    (error instanceof Error ? error.message : "") ||
    ""
  );
}

export function getRecruitmentMutationMessage(
  error: unknown,
  fallback: string,
): string {
  const code = recruitmentErrorCode(error);

  if (STALE_CODES.has(code)) {
    return "This record was updated elsewhere. Refresh and try again.";
  }
  if (TRANSITION_CODES.has(code)) {
    return "This action is not allowed for the current status.";
  }
  if (HEADCOUNT_CODES.has(code)) {
    return "No headcount is available to reserve for this offer.";
  }
  if (code === "OPENING_CRITERIA_NOT_100" || code === "OPENING_CRITERIA_INVALID") {
    return "Publication checklist is not complete.";
  }
  if (code === "CONVERSION_PREFLIGHT_FAILED") {
    return "Conversion preflight failed. Resolve blockers and try again.";
  }
  if (code === "DUPLICATE_APPLICATION") {
    return "This candidate already has an application for that opening.";
  }
  if (code === "REASON_REQUIRED") {
    return "A reason is required for this action.";
  }
  if (code === "EVALUATION_IMMUTABLE") {
    return "Submitted evaluations cannot be edited.";
  }
  if (code === "REQUIRED_ROUNDS_INCOMPLETE" || code === "INTERVIEWS_NOT_READY") {
    return "Required interviews and evaluations must be complete first.";
  }
  if (code === "OFFER_TOKEN_INVALID" || code === "OFFER_TOKEN_EXPIRED") {
    return "This offer link is invalid or has expired.";
  }
  if (code === "OFFER_RESPONSE_CONSUMED" || code === "OFFER_ALREADY_RESPONDED") {
    return "This offer has already been responded to.";
  }

  return getApiErrorMessage(error, fallback);
}
