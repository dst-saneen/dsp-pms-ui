import { describe, expect, it } from "vitest";

import {
  employeeOnboardingHref,
  resolveConversionRemediation,
  usersAdminHref,
} from "./conversion-remediation";

describe("resolveConversionRemediation", () => {
  const context = {
    applicationId: "app-1",
    jobOpeningId: "open-1",
    candidateId: "cand-1",
    existingEmployeeId: "emp-1",
  };

  it("links offer blockers to the application offer tab", () => {
    expect(resolveConversionRemediation("OFFER_ACCEPTED", context)).toMatchObject({
      href: "/hr/recruitment/applications/app-1?tab=offer",
      label: "Open offer",
    });
  });

  it("links headcount blockers to the opening", () => {
    expect(
      resolveConversionRemediation("HEADCOUNT_RESERVED", context),
    ).toMatchObject({
      href: "/hr/recruitment/openings/open-1",
      label: "Open job opening",
    });
  });

  it("links identity conflicts to user administration", () => {
    expect(
      resolveConversionRemediation("NO_CONFLICTING_USER", context),
    ).toMatchObject({
      href: "/administration/users",
    });
  });

  it("links already-converted warnings to the employee onboarding tab", () => {
    expect(
      resolveConversionRemediation("ALREADY_CONVERTED", context),
    ).toMatchObject({
      href: "/hr/employees/emp-1?tab=onboarding",
      label: "View employee",
    });
  });
});

describe("handoff helpers", () => {
  it("builds onboarding and users admin soft links", () => {
    expect(employeeOnboardingHref("onb-1")).toBe("/hr/employee-onboarding/onb-1");
    expect(usersAdminHref("user-1")).toContain("userId=user-1");
  });
});
