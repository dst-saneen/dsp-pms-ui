/** Maps publication checklist codes → form field / section element ids. */

export const OPENING_FORM_FIELD_IDS = {
  title: "opening-field-title",
  description: "opening-field-description",
  employmentType: "opening-field-employmentType",
  location: "opening-field-location",
  companyGroupId: "opening-field-companyGroupId",
  companyId: "opening-field-companyId",
  branchId: "opening-field-branchId",
  departmentId: "opening-field-departmentId",
  designationId: "opening-field-designationId",
  hiringManagerEmployeeId: "opening-field-hiringManagerEmployeeId",
  headcount: "opening-field-headcount",
  targetJoiningDate: "opening-field-targetJoiningDate",
  applicationDeadline: "opening-field-applicationDeadline",
  criteria: "opening-field-criteria",
} as const;

export const OPENING_FORM_SECTION_IDS = {
  role: "opening-section-role",
  organization: "opening-section-organization",
  hiring: "opening-section-hiring",
  dates: "opening-section-dates",
  criteria: "opening-section-criteria",
} as const;

export type OpeningFormFocusTarget =
  | (typeof OPENING_FORM_FIELD_IDS)[keyof typeof OPENING_FORM_FIELD_IDS]
  | (typeof OPENING_FORM_SECTION_IDS)[keyof typeof OPENING_FORM_SECTION_IDS];

/**
 * Resolve a checklist item code to a scroll/highlight target.
 * Accepts both live API codes and earlier mock aliases.
 */
export function resolvePublicationChecklistFocus(
  code: string,
): OpeningFormFocusTarget {
  switch (code) {
    case "ORGANIZATION_ACTIVE":
      return OPENING_FORM_SECTION_IDS.organization;
    case "HIRING_MANAGER_LINKED":
    case "HIRING_MANAGER_ACTIVE":
      return OPENING_FORM_FIELD_IDS.hiringManagerEmployeeId;
    case "HEADCOUNT_VALID":
      return OPENING_FORM_FIELD_IDS.headcount;
    case "DEADLINE_VALID":
      return OPENING_FORM_FIELD_IDS.applicationDeadline;
    case "CRITERIA_TOTAL_100":
    case "CRITERIA_TOTAL":
      return OPENING_FORM_SECTION_IDS.criteria;
    default:
      return OPENING_FORM_SECTION_IDS.role;
  }
}

export function focusOpeningFormTarget(targetId: string) {
  const element = document.getElementById(targetId);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable = element.matches(
    "input, textarea, select, button, [tabindex]",
  )
    ? element
    : element.querySelector<HTMLElement>(
        "input, textarea, select, button, [tabindex]",
      );

  focusable?.focus({ preventScroll: true });
}
