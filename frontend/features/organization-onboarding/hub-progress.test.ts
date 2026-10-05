import { describe, expect, it } from "vitest";

import { getOnboardingHubProgress } from "./hub-progress";
import type { OrganizationOnboardingStatus } from "./types";

function statusWithDesignation(designation: boolean): OrganizationOnboardingStatus {
  return {
    id: "onboarding",
    companyGroupId: "group",
    ownerUserId: "owner",
    status: "IN_PROGRESS",
    currentStep: "REVIEW",
    isOwner: true,
    companyGroup: {
      id: "group",
      groupCode: "QA",
      groupName: "QA Group",
    },
    company: {
      id: "company",
      companyCode: "QA-COMPANY",
      companyName: "QA Company",
    },
    counts: {
      branches: 1,
      departments: 1,
      designations: designation ? 1 : 0,
      shifts: 0,
    },
    requirements: {
      company: true,
      branch: true,
      department: true,
      designation,
    },
  };
}

describe("organization onboarding readiness", () => {
  it("does not allow workspace completion without a designation", () => {
    const progress = getOnboardingHubProgress(statusWithDesignation(false));

    expect(progress.canOpenWorkspace).toBe(false);
    expect(progress.remainingRequired).toBe(1);
    expect(progress.checklist.find((item) => item.id === "designations")).toMatchObject({
      state: "needed",
      detail: "Needed",
    });
  });

  it("allows completion after all required organization records exist", () => {
    const progress = getOnboardingHubProgress(statusWithDesignation(true));

    expect(progress.canOpenWorkspace).toBe(true);
    expect(progress.percent).toBe(100);
  });
});
