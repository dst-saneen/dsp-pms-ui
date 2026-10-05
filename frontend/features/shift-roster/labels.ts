/** User-facing labels for Work Schedule (shift roster). */

export function friendlyRosterStatus(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "PUBLISHED":
      return "Published";
    case "LOCKED":
      return "Locked";
    case "ARCHIVED":
      return "Archived";
    default:
      return status.replace(/_/g, " ");
  }
}

export function friendlyDayType(dayType: string | null | undefined): string {
  switch (dayType) {
    case "WORKING":
      return "Working day";
    case "WEEK_OFF":
      return "Week off";
    case "HOLIDAY":
      return "Holiday";
    case "SCHEDULED_HALF_DAY":
      return "Half day";
    default:
      return dayType?.replace(/_/g, " ") || "—";
  }
}

export function friendlyDayPortion(
  dayPortion: string | null | undefined,
): string {
  switch (dayPortion) {
    case "FULL_DAY":
      return "Full day";
    case "FIRST_HALF":
      return "First half";
    case "SECOND_HALF":
      return "Second half";
    default:
      return dayPortion?.replace(/_/g, " ") || "";
  }
}

/** e.g. "Working day · Full day" */
export function friendlyDayLabel(
  dayType: string | null | undefined,
  dayPortion?: string | null,
): string {
  const type = friendlyDayType(dayType);
  const portion = friendlyDayPortion(dayPortion);
  if (!portion || dayPortion === "FULL_DAY") {
    if (dayType === "WORKING" && portion) return `${type} · ${portion}`;
    if (dayType === "WORKING") return type;
    return type;
  }
  return `${type} · ${portion}`;
}

export function friendlyGenerateSummaryKey(key: string): string {
  switch (key) {
    case "toCreate":
      return "New days to add";
    case "toUpdate":
      return "Days to update";
    case "toRetain":
      return "Days unchanged";
    case "toSkip":
      return "Days skipped";
    case "toDelete":
      return "Days to remove";
    default:
      return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  }
}
