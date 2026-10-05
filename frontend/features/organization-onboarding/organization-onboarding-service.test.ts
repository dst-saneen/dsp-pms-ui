import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api-client";

import { organizationOnboardingService } from "./organization-onboarding-service";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

const selection = {
  companyId: "company-selected",
  branchId: "branch-selected",
  departmentId: "department-selected",
  designationId: "designation-selected",
};

describe("organizationOnboardingService owner selection", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { data: { id: "onboarding" } },
    });
  });

  it("posts all four selected IDs when completing", async () => {
    await organizationOnboardingService.complete(selection);

    expect(apiClient.post).toHaveBeenCalledWith("/organization-onboarding/complete", selection);
  });

  it("posts all four selected IDs when repairing", async () => {
    await organizationOnboardingService.repairOwnerEmployee(selection);

    expect(apiClient.post).toHaveBeenCalledWith(
      "/organization-onboarding/repair-owner-employee",
      selection
    );
  });
});
