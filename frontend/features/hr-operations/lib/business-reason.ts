/** Shared business-reason rule for HR requests, separations, and clearance. */
export const MIN_BUSINESS_REASON_LENGTH = 3;

export function isValidBusinessReason(value: string | null | undefined): boolean {
  return (value?.trim().length ?? 0) >= MIN_BUSINESS_REASON_LENGTH;
}

export function businessReasonHint(required: boolean): string {
  return required
    ? `Enter the actual business reason (at least ${MIN_BUSINESS_REASON_LENGTH} characters).`
    : "Optional notes for the audit trail.";
}
