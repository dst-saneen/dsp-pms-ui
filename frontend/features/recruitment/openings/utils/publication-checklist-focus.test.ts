import { describe, expect, it } from "vitest";

import {
  OPENING_FORM_FIELD_IDS,
  OPENING_FORM_SECTION_IDS,
  resolvePublicationChecklistFocus,
} from "./publication-checklist-focus";

describe("resolvePublicationChecklistFocus", () => {
  it("maps organization checklist to the organization section", () => {
    expect(resolvePublicationChecklistFocus("ORGANIZATION_ACTIVE")).toBe(
      OPENING_FORM_SECTION_IDS.organization,
    );
  });

  it("maps hiring manager codes to the hiring manager field", () => {
    expect(resolvePublicationChecklistFocus("HIRING_MANAGER_LINKED")).toBe(
      OPENING_FORM_FIELD_IDS.hiringManagerEmployeeId,
    );
    expect(resolvePublicationChecklistFocus("HIRING_MANAGER_ACTIVE")).toBe(
      OPENING_FORM_FIELD_IDS.hiringManagerEmployeeId,
    );
  });

  it("maps headcount and deadline to their fields", () => {
    expect(resolvePublicationChecklistFocus("HEADCOUNT_VALID")).toBe(
      OPENING_FORM_FIELD_IDS.headcount,
    );
    expect(resolvePublicationChecklistFocus("DEADLINE_VALID")).toBe(
      OPENING_FORM_FIELD_IDS.applicationDeadline,
    );
  });

  it("maps criteria total codes to the criteria section", () => {
    expect(resolvePublicationChecklistFocus("CRITERIA_TOTAL_100")).toBe(
      OPENING_FORM_SECTION_IDS.criteria,
    );
    expect(resolvePublicationChecklistFocus("CRITERIA_TOTAL")).toBe(
      OPENING_FORM_SECTION_IDS.criteria,
    );
  });
});
