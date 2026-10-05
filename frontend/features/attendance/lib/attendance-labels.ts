/** Plain-language labels for attendance status codes. */
export function friendlyAttendanceStatus(status: string | null | undefined): {
  label: string;
  hint?: string;
} {
  switch ((status ?? "").toUpperCase()) {
    case "PRESENT":
      return { label: "Full day", hint: "Hours meet the full-day threshold." };
    case "HALF_DAY":
      return {
        label: "Half day",
        hint: "Worked less than a full day vs the expected schedule (or under ~4 hours if no schedule was linked).",
      };
    case "ABSENT":
      return { label: "Absent", hint: "Not enough worked time for the day." };
    case "LEAVE":
      return { label: "On leave" };
    case "HOLIDAY":
      return { label: "Holiday" };
    case "WEEK_OFF":
      return { label: "Week off" };
    case "":
    case "NOT CHECKED IN":
      return { label: "Not checked in yet" };
    default:
      return { label: status || "—" };
  }
}

/** Plain-language labels for attendance exception types. */
export function friendlyExceptionType(type: string | null | undefined): {
  label: string;
  hint?: string;
} {
  switch ((type ?? "").toUpperCase()) {
    case "UNSCHEDULED_WORK":
      return {
        label: "Needs schedule review",
        hint: "Punch was saved, but the system did not link a published work-schedule row for that day. HR can propose a fix or correct.",
      };
    case "LATE":
      return {
        label: "Late check-in",
        hint: "Checked in after the scheduled start (beyond grace).",
      };
    case "EARLY_DEPARTURE":
      return {
        label: "Left early",
        hint: "Checked out before the scheduled end (beyond grace).",
      };
    case "MISSING_CHECK_IN":
      return { label: "Missing check-in" };
    case "MISSING_CHECK_OUT":
      return { label: "Missing check-out" };
    case "INSUFFICIENT_HOURS":
      return {
        label: "Short hours",
        hint: "Worked time was below the expected threshold.",
      };
    default:
      return { label: type || "Exception" };
  }
}

/** Status of an attendance exception / regularization request. */
export function friendlyExceptionStatus(status: string | null | undefined): {
  label: string;
  hint?: string;
  tone: "neutral" | "information" | "success" | "warning" | "progress";
} {
  switch ((status ?? "").toUpperCase()) {
    case "OPEN":
      return {
        label: "Needs a fix",
        hint: "Someone must propose corrected times (or HR can Correct on Daily).",
        tone: "warning",
      };
    case "SUBMITTED":
      return {
        label: "Waiting approval",
        hint: "A proposed fix was submitted. Approve or Reject it.",
        tone: "progress",
      };
    case "APPROVED":
      return {
        label: "Approved",
        hint: "The proposed times were accepted.",
        tone: "success",
      };
    case "REJECTED":
      return {
        label: "Rejected",
        hint: "The proposed fix was not accepted.",
        tone: "warning",
      };
    case "RESOLVED":
      return {
        label: "Resolved",
        hint: "This exception is closed.",
        tone: "success",
      };
    default:
      return { label: status || "—", tone: "neutral" };
  }
}

export function formatWorkedDuration(
  checkInTime: string | null | undefined,
  checkOutTime: string | null | undefined,
  workedMinutes?: number | null,
): string {
  if (typeof workedMinutes === "number" && workedMinutes >= 0) {
    const hours = Math.floor(workedMinutes / 60);
    const minutes = workedMinutes % 60;
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }
  if (!checkInTime || !checkOutTime) return "—";
  const start = new Date(checkInTime).getTime();
  const end = new Date(checkOutTime).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const minutes = Math.round((end - start) / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
}
