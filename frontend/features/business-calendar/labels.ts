/**
 * HR-facing labels for Business Calendar UI (Phase A).
 * Keep API enum values unchanged; map only for display.
 */

export function friendlyConfigStatus(status: string): string {
  switch (status) {
    case "READY":
      return "Ready";
    case "ACTIVE_MODE":
      return "New calendar in use";
    case "LEGACY_MODE":
      return "Using old holidays";
    case "SHADOW_MODE":
      return "Testing new calendar";
    case "INACTIVE":
      return "Inactive";
    case "MISSING_LOCATION":
      return "Location incomplete";
    default:
      return status
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function friendlyVersionStatus(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "IN_REVIEW":
      return "In review";
    case "PUBLISHED":
      return "Published";
    case "SUPERSEDED":
      return "Replaced";
    default:
      return status;
  }
}

export function friendlyDayStatus(status: string | undefined): string {
  switch (status) {
    case "WORKING":
      return "Working day";
    case "NON_WORKING":
      return "Non-working day";
    case "PARTIAL":
      return "Partial day";
    default:
      return status ?? "Unknown";
  }
}

export function friendlyDayPortion(portion: string | undefined): string {
  switch (portion) {
    case "FULL_DAY":
      return "Full day";
    case "FIRST_HALF":
      return "Morning half";
    case "SECOND_HALF":
      return "Afternoon half";
    default:
      return portion ?? "";
  }
}

export type PreviewDayKind = "WORKING" | "HOLIDAY" | "WEEK_OFF" | "HALF_DAY";

export function classifyPreviewDay(input: {
  dayStatus?: string;
  dayPortion?: string;
  reasonCode?: string;
}): PreviewDayKind {
  const status = input.dayStatus;
  const portion = input.dayPortion;
  const reason = input.reasonCode ?? "";

  // Half-day always uses HALF_DAY color (holiday or otherwise).
  if (
    portion === "FIRST_HALF" ||
    portion === "SECOND_HALF" ||
    status === "PARTIAL"
  ) {
    return "HALF_DAY";
  }

  if (status === "NON_WORKING") {
    return reason === "EVENT" || reason === "LEGACY_HOLIDAY"
      ? "HOLIDAY"
      : "WEEK_OFF";
  }

  return "WORKING";
}

export function friendlyPreviewKind(kind: PreviewDayKind): string {
  switch (kind) {
    case "WORKING":
      return "Working";
    case "HOLIDAY":
      return "Full-day holiday";
    case "WEEK_OFF":
      return "Week off";
    case "HALF_DAY":
      return "Half day";
  }
}

export function friendlyReasonCode(code: string | undefined): string {
  switch (code) {
    case "EVENT":
      return "Holiday / event on the calendar";
    case "LEGACY_HOLIDAY":
      return "Holiday from the previous holiday source";
    case "WEEK":
    case "COMPANY_WEEK":
    case "BRANCH_WEEK":
    case "LEGACY_WORKING_WEEK":
      return "Working week rule";
    case "LEGACY_WEEK_MISSING":
      return "No working-week rule found";
    default:
      return code
        ? code
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : "No reason recorded";
  }
}

/** Short label for month/week cells — prefer holiday name when present. */
export function previewCellLabel(input: {
  kind: PreviewDayKind;
  reasonText?: string | null;
}): string {
  const name = input.reasonText?.trim();
  if (
    (input.kind === "HOLIDAY" || input.kind === "HALF_DAY") &&
    name
  ) {
    return name;
  }
  return friendlyPreviewKind(input.kind);
}

export function friendlySourceKind(kind: string): string {
  switch (kind) {
    case "CSV":
      return "CSV file";
    case "EXCEL":
      return "Excel file";
    case "ICS":
      return "Calendar file (ICS)";
    case "GOVERNMENT":
      return "Government pack";
    default:
      return kind;
  }
}

export function friendlyImportBatchStatus(status: string): string {
  switch (status) {
    case "UPLOADED":
      return "Uploaded";
    case "VALIDATED":
      return "Validated";
    case "IN_REVIEW":
      return "In review";
    case "APPROVED":
      return "Approved";
    case "APPLIED":
      return "Added to draft";
    case "REJECTED":
      return "Rejected";
    case "FAILED":
      return "Failed";
    default:
      return status
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function friendlyImportRowStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "VALID":
      return "Ready";
    case "INVALID":
      return "Needs fix";
    case "DUPLICATE":
      return "Already on calendar";
    case "CHANGED":
      return "Changed";
    case "SELECTED":
      return "Approved";
    case "APPLIED":
      return "Added";
    case "SKIPPED":
      return "Skipped";
    default:
      return status;
  }
}

export function friendlyBusinessDayEffect(effect: string | undefined): string {
  switch (effect) {
    case "NON_WORKING_DAY":
      return "Full day holiday";
    case "FIRST_HALF_NON_WORKING":
      return "Morning half-day off";
    case "SECOND_HALF_NON_WORKING":
      return "Afternoon half-day off";
    case "WORKING_DAY_OVERRIDE":
      return "Force working day";
    case "NONE":
      return "Info only (no day change)";
    default:
      return effect ?? "";
  }
}

export function friendlyCalendarScope(scope: string | undefined): string {
  switch (scope) {
    case "COMPANY":
      return "Company calendar";
    case "BRANCH":
      return "Branch calendar";
    default:
      return scope ?? "Calendar";
  }
}

/** Map event business-day effect to Preview-aligned day kinds for color. */
export function eventEffectKind(
  effect: string | undefined,
): PreviewDayKind | "INFO" {
  switch (effect) {
    case "NON_WORKING_DAY":
      return "HOLIDAY";
    case "FIRST_HALF_NON_WORKING":
    case "SECOND_HALF_NON_WORKING":
      return "HALF_DAY";
    case "WORKING_DAY_OVERRIDE":
      return "WORKING";
    default:
      return "INFO";
  }
}

export const previewKindToneClass: Record<PreviewDayKind | "INFO", string> = {
  WORKING: "bg-emerald-50 text-emerald-900 border-emerald-200",
  HOLIDAY: "bg-amber-50 text-amber-950 border-amber-200",
  WEEK_OFF: "bg-slate-100 text-slate-700 border-slate-200",
  HALF_DAY: "bg-sky-50 text-sky-950 border-sky-200",
  INFO: "bg-background text-foreground border-border",
};

export function friendlyEntityType(type: string): string {
  switch (type) {
    case "LeaveRequest":
      return "Leave";
    case "ShiftRoster":
      return "Shift roster";
    default:
      return type;
  }
}

export function friendlyImpactCode(code: string): string {
  switch (code) {
    case "LEAVE_REVIEW":
      return "Leave may need follow-up";
    case "ROSTER_REVIEW":
      return "Shift roster may need follow-up";
    default:
      return code
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function friendlyImpactStatus(status: string): string {
  switch (status) {
    case "PENDING":
      return "Needs review";
    case "ACKNOWLEDGED":
      return "Seen";
    case "RESOLVED":
      return "Done";
    case "IGNORED":
      return "Ignored";
    default:
      return status;
  }
}

export function friendlyTraceLayer(layer: string): string {
  switch (layer) {
    case "COMPANY_WEEK":
      return "Company working week";
    case "COMPANY_EVENT":
      return "Company holiday / event";
    case "BRANCH_WEEK":
      return "Branch working week";
    case "BRANCH_EVENT":
      return "Branch holiday / event";
    default:
      return layer.replace(/_/g, " ").toLowerCase();
  }
}
