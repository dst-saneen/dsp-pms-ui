import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateDesignation } from "./use-update-designation";
import { DesignationService } from "../services/designation-service";
import type { Designation } from "../types/designation";
import type { DesignationFormValues } from "../validation/designation-schema";

vi.mock("../services/designation-service", () => ({
  DesignationService: { update: vi.fn() },
}));

const existingDesignation: Designation = {
  id: "designation-1",
  companyId: "company-1",
  designationCode: "DES-001",
  designationName: "Senior Analyst",
  level: 4,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  departmentId: "home-department-1",
  onboardingTemplate: {
    id: "template-1",
    versions: [
      {
        id: "version-1",
        departments: [
          {
            id: "link-1",
            departmentId: "onboarding-department-1",
            rowVersion: 1,
          },
        ],
      },
    ],
  },
};

const deactivatedFormData: DesignationFormValues = {
  companyId: "company-1",
  designationName: "Senior Analyst",
  level: 4,
  isActive: false,
  departmentId: "home-department-1",
  branchId: "branch-1",
  onboardingInvolvementDepartmentIds: ["onboarding-department-1"],
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  return function QueryClientWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useUpdateDesignation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not synchronize onboarding links when deactivation keeps the existing departments", async () => {
    vi.mocked(DesignationService.update).mockResolvedValue(existingDesignation);
    const { result } = renderHook(
      () => useUpdateDesignation({ suppressToast: true }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync({
        id: existingDesignation.id,
        data: deactivatedFormData,
        existing: existingDesignation,
      });
    });

    expect(DesignationService.update).toHaveBeenCalledWith(
      existingDesignation.id,
      {
        designationName: "Senior Analyst",
        level: 4,
        isActive: false,
        departmentId: "home-department-1",
      },
    );
    const [, payload] = vi.mocked(DesignationService.update).mock.calls[0]!;
    expect(payload).not.toHaveProperty("branchId");
    expect(payload).not.toHaveProperty("onboardingDepartmentIds");
    expect(payload).not.toHaveProperty("operationId");
  });
});
