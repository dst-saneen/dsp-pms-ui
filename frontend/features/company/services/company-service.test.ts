import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api-client";

import { CompanyService } from "./company-service";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const responseData = {
  companyId: "company-1",
  entitlements: [
    { module: "FINANCE" as const, isEnabled: true },
    { module: "PAYROLL" as const, isEnabled: false },
  ],
};

describe("CompanyService module entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads Company-scoped module entitlements", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, data: responseData },
    });

    const getEntitlements = (
      CompanyService as unknown as {
        getModuleEntitlements(companyId: string): Promise<typeof responseData>;
      }
    ).getModuleEntitlements;
    const result = await getEntitlements("company-1");

    expect(result).toEqual(responseData);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/companies/company-1/module-entitlements",
    );
  });

  it("saves the complete Company module state", async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({
      data: { success: true, data: responseData },
    });
    const payload = {
      entitlements: responseData.entitlements,
    };

    const updateEntitlements = (
      CompanyService as unknown as {
        updateModuleEntitlements(
          companyId: string,
          data: typeof payload,
        ): Promise<typeof responseData>;
      }
    ).updateModuleEntitlements;
    const result = await updateEntitlements("company-1", payload);

    expect(result).toEqual(responseData);
    expect(apiClient.patch).toHaveBeenCalledWith(
      "/companies/company-1/module-entitlements",
      payload,
    );
  });
});
